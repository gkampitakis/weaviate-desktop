package weaviate

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"weaviate-desktop/internal/utils"

	"github.com/weaviate/weaviate-go-client/v5/weaviate/filters"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
)

// WhereFilter is a serializable representation of a Weaviate where-filter clause.
// For a leaf clause, set Operator + Path + the single ValueXxx that matches ValueType.
// For grouping ("And"/"Or"), populate Operator + Operands instead.
type WhereFilter struct {
	Operator     string         `json:"operator"`
	Path         []string       `json:"path,omitempty"`
	ValueType    string         `json:"valueType,omitempty"`
	ValueText    string         `json:"valueText,omitempty"`
	ValueString  string         `json:"valueString,omitempty"`
	ValueInt     int64          `json:"valueInt,omitempty"`
	ValueNumber  float64        `json:"valueNumber,omitempty"`
	ValueBoolean bool           `json:"valueBoolean,omitempty"`
	ValueDate    string         `json:"valueDate,omitempty"`
	ValueTexts   []string       `json:"valueTexts,omitempty"`
	ValueInts    []int64        `json:"valueInts,omitempty"`
	ValueNumbers []float64      `json:"valueNumbers,omitempty"`
	Operands     []*WhereFilter `json:"operands,omitempty"`
}

// SearchOptions holds optional parameters for all search types.
// Zero values mean "use default / not set".
type SearchOptions struct {
	// Limit is the maximum number of results to return (default 100).
	Limit int
	// Offset is the number of results to skip (default 0). Used for paginated
	// search. Note: Weaviate enforces a server-side cap (default 10000) on
	// limit+offset.
	Offset int
	// Alpha controls the BM25/vector balance in Hybrid search (0.0–1.0, default 0.75).
	Alpha float32
	// FusionType is the fusion algorithm for Hybrid search: "rankedFusion" | "relativeScoreFusion".
	FusionType string
	// Distance threshold for nearText/nearVector (0 = not set).
	Distance float32
	// Certainty threshold for nearText/nearVector (0 = not set).
	Certainty float32
	// Where is the optional where-filter applied to all search types.
	Where *WhereFilter
	// Properties optionally narrows the projection. Empty = all schema properties.
	Properties []string
	// TargetVectors optionally selects which named vector(s) to query against.
	TargetVectors []string
}

func (w *Weaviate) Search(
	connectionID int64,
	collection, tenant, searchType, query string,
	opts SearchOptions,
) (*PaginatedObjectResponse, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()

	col, err := c.w.Schema().ClassGetter().WithClassName(collection).Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed retrieving schema for %s: %w", collection, err)
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 100
	}

	// Relevance searches return score/distance/certainty in _additional —
	// paginated browse does not, so we only request them here.
	gqlQuery := c.w.GraphQL().Get().
		WithClassName(collection).
		WithLimit(limit).
		WithFields(getGQLFields(col.Properties, opts.Properties, true)...)

	if opts.Offset > 0 {
		gqlQuery = gqlQuery.WithOffset(opts.Offset)
	}

	gqlQuery, err = applySearchOperator(gqlQuery, searchType, query, opts)
	if err != nil {
		return nil, err
	}

	if tenant != "" {
		gqlQuery = gqlQuery.WithTenant(tenant)
	}

	if wb, err := buildWhereBuilder(opts.Where); err != nil {
		return nil, fmt.Errorf("invalid where filter: %w", err)
	} else if wb != nil {
		gqlQuery = gqlQuery.WithWhere(wb)
	}

	result, err := gqlQuery.Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed executing %s search for %s: %w", searchType, query, err)
	}
	if len(result.Errors) > 0 {
		return nil, handleGQLError(result, searchType, query)
	}
	if len(result.Data) == 0 {
		slog.Debug(
			"no results found for search",
			slog.String("query", query),
			slog.String("searchType", searchType),
			slog.String("collection", collection),
		)
	}

	objects := result.Data["Get"].(map[string]any)[collection].([]any)

	if len(objects) == 0 {
		slog.Debug(
			"no objects found for search",
			slog.String("query", query),
			slog.String("searchType", searchType),
			slog.String("collection", collection),
		)
		return &PaginatedObjectResponse{
			Objects:       []WeaviateObject{},
			TotalResults:  0,
			ExecutionTime: time.Since(now).String(),
		}, nil
	}

	return &PaginatedObjectResponse{
		Objects:       buildSearchObjects(objects, collection, searchType),
		TotalResults:  len(objects),
		ExecutionTime: time.Since(now).String(),
	}, nil
}

func applySearchOperator(
	gqlQuery *graphql.GetBuilder,
	searchType, query string,
	opts SearchOptions,
) (*graphql.GetBuilder, error) {
	switch searchType {
	case "hybrid":
		return gqlQuery.WithHybrid(buildHybridArgument(query, opts)), nil
	case "nearText":
		return gqlQuery.WithNearText(buildNearTextArgument(query, opts)), nil
	case "nearVector":
		nv, err := buildNearVectorArgument(query, opts)
		if err != nil {
			return nil, err
		}
		return gqlQuery.WithNearVector(nv), nil
	case "nearObject":
		return gqlQuery.WithNearObject(buildNearObjectArgument(query, opts)), nil
	default: // "bm25"
		return gqlQuery.WithBM25((&graphql.BM25ArgumentBuilder{}).WithQuery(query)), nil
	}
}

func buildHybridArgument(query string, opts SearchOptions) *graphql.HybridArgumentBuilder {
	alpha := opts.Alpha
	if alpha == 0 {
		alpha = 0.75
	}
	h := (&graphql.HybridArgumentBuilder{}).WithQuery(query).WithAlpha(alpha)
	if opts.FusionType != "" {
		h = h.WithFusionType(graphql.FusionType(opts.FusionType))
	}
	if len(opts.TargetVectors) > 0 {
		h = h.WithTargetVectors(opts.TargetVectors...)
	}

	return h
}

func buildNearTextArgument(query string, opts SearchOptions) *graphql.NearTextArgumentBuilder {
	nt := (&graphql.NearTextArgumentBuilder{}).WithConcepts([]string{query})
	if opts.Distance > 0 {
		nt = nt.WithDistance(opts.Distance)
	}
	if opts.Certainty > 0 {
		nt = nt.WithCertainty(opts.Certainty)
	}
	if len(opts.TargetVectors) > 0 {
		nt = nt.WithTargetVectors(opts.TargetVectors...)
	}

	return nt
}

func buildNearVectorArgument(
	query string,
	opts SearchOptions,
) (*graphql.NearVectorArgumentBuilder, error) {
	vector, err := parseVectorQuery(query)
	if err != nil {
		return nil, err
	}
	nv := (&graphql.NearVectorArgumentBuilder{}).WithVector(vector)
	if opts.Distance > 0 {
		nv = nv.WithDistance(opts.Distance)
	}
	if opts.Certainty > 0 {
		nv = nv.WithCertainty(opts.Certainty)
	}
	if len(opts.TargetVectors) > 0 {
		nv = nv.WithTargetVectors(opts.TargetVectors...)
	}

	return nv, nil
}

func buildNearObjectArgument(query string, opts SearchOptions) *graphql.NearObjectArgumentBuilder {
	no := (&graphql.NearObjectArgumentBuilder{}).WithID(query)
	if opts.Distance > 0 {
		no = no.WithDistance(opts.Distance)
	}
	if opts.Certainty > 0 {
		no = no.WithCertainty(opts.Certainty)
	}
	if len(opts.TargetVectors) > 0 {
		no = no.WithTargetVectors(opts.TargetVectors...)
	}

	return no
}

func buildSearchObjects(objects []any, collection, searchType string) []WeaviateObject {
	// Weaviate populates _additional.score for bm25/hybrid and
	// _additional.distance/certainty for the near* family. It will, however,
	// still return zero-valued fields for the signals that don't apply (e.g.
	// score=0 on a nearObject result) — surfacing those would render a
	// misleading "Score 0" badge. Only keep the signals that are actually
	// meaningful for the chosen search type.
	keepScore, keepVectorSignals := relevantSignals(searchType)

	out := make([]WeaviateObject, 0, len(objects))
	for _, obj := range objects {
		objMap, ok := obj.(map[string]any)
		if !ok {
			continue
		}

		additional, _ := objMap["_additional"].(map[string]any)
		object := WeaviateObject{
			Class: collection,
			LastUpdateTimeUnix: utils.MustParseInt[int64](
				additional["lastUpdateTimeUnix"].(string),
			),
			CreationTimeUnix: utils.MustParseInt[int64](
				additional["creationTimeUnix"].(string),
			),
			ID:         additional["id"].(string),
			Properties: objMap,
		}
		if keepScore {
			object.Score = coerceFloat(additional["score"])
		}
		if keepVectorSignals {
			object.Distance = coerceFloat(additional["distance"])
			object.Certainty = coerceFloat(additional["certainty"])
		}
		// Remove the _additional field from properties
		delete(object.Properties.(map[string]any), "_additional")
		// Add the object to the response
		out = append(out, object)
	}

	return out
}

// relevantSignals returns which relevance signals are meaningful for a given
// search type. Weaviate's GraphQL response always includes every requested
// _additional field, but the unrelated ones come back as zero — e.g. a
// nearObject result has score=0, and a bm25 result has distance=0. Returning
// those would render a misleading "Score 0" / "Distance 0" badge in the UI,
// so we discard them here.
//
//   - bm25 / hybrid: score is the merged relevance signal.
//   - nearText / nearVector / nearObject: distance + certainty describe the
//     vector match; score is not populated.
func relevantSignals(searchType string) (keepScore, keepVectorSignals bool) {
	switch searchType {
	case "nearText", "nearVector", "nearObject":
		return false, true
	case "hybrid":
		// Hybrid mixes bm25 + vector, so the merged "score" is the primary
		// signal; distance/certainty are not populated by Weaviate for
		// hybrid results.
		return true, false
	default: // "bm25"
		return true, false
	}
}

// coerceFloat converts a value coming back from the Weaviate GraphQL response
// into a *float64. The client sometimes returns a json.Number, sometimes a
// float64, sometimes a string ("0.482"), and sometimes nil when the field is
// not present. Returns nil for any of those "not present / not parseable"
// cases so callers can use a pointer-nil check downstream.
func coerceFloat(v any) *float64 {
	switch n := v.(type) {
	case nil:
		return nil
	case float64:
		return &n
	case float32:
		f := float64(n)
		return &f
	case json.Number:
		f, err := n.Float64()
		if err != nil {
			return nil
		}
		return &f
	case string:
		if n == "" {
			return nil
		}
		f, err := strconv.ParseFloat(n, 64)
		if err != nil {
			return nil
		}
		return &f
	default:
		return nil
	}
}

func handleGQLError(result *models.GraphQLResponse, searchType, query string) error {
	errMsg := strings.Builder{}
	for _, e := range result.Errors {
		errMsg.WriteString(e.Message)
		errMsg.WriteString(", ")
	}

	return fmt.Errorf("weaviate returned errors for %s search %s: %s", searchType, query, errMsg.String())
}

func parseVectorQuery(query string) ([]float32, error) {
	var vector []float32
	if err := json.Unmarshal([]byte(query), &vector); err != nil {
		return nil, fmt.Errorf("invalid vector: expected a JSON array of floats (e.g. [0.1, 0.2, ...]): %w", err)
	}
	return vector, nil
}

func getGQLFields(props []*models.Property, projection []string, includeRelevance bool) []graphql.Field {
	var allowed map[string]struct{}
	if len(projection) > 0 {
		allowed = make(map[string]struct{}, len(projection))
		for _, p := range projection {
			allowed[p] = struct{}{}
		}
	}

	fields := make([]graphql.Field, 0, len(props))
	for _, prop := range props {
		if allowed != nil {
			if _, ok := allowed[prop.Name]; !ok {
				continue
			}
		}
		if isCrossReference(prop.DataType) {
			continue
		}
		fields = append(fields, graphql.Field{
			Name:   prop.Name,
			Fields: getNestedFields(prop.NestedProperties),
		})
	}

	additional := []graphql.Field{
		{Name: "creationTimeUnix"},
		{Name: "id"},
		{Name: "lastUpdateTimeUnix"},
	}
	if includeRelevance {
		// Weaviate returns whichever of these are meaningful for the chosen
		// search type and omits the rest — requesting them all is safe.
		additional = append(additional,
			graphql.Field{Name: "score"},
			graphql.Field{Name: "distance"},
			graphql.Field{Name: "certainty"},
		)
	}

	fields = append(fields, graphql.Field{
		Name:   "_additional",
		Fields: additional,
	})
	return fields
}

// buildWhereBuilder recursively converts a serializable WhereFilter into the
// Weaviate go-client's filters.WhereBuilder. Returns (nil, nil) when input is nil.
func buildWhereBuilder(f *WhereFilter) (*filters.WhereBuilder, error) {
	if f == nil {
		return nil, nil
	}
	op := filters.WhereOperator(f.Operator)
	wb := filters.Where().WithOperator(op)

	// Grouping clauses: And / Or
	if op == filters.And || op == filters.Or {
		if len(f.Operands) == 0 {
			return nil, fmt.Errorf("operator %s requires at least one operand", f.Operator)
		}
		operands := make([]*filters.WhereBuilder, 0, len(f.Operands))
		for _, child := range f.Operands {
			built, err := buildWhereBuilder(child)
			if err != nil {
				return nil, err
			}
			if built == nil {
				continue
			}
			operands = append(operands, built)
		}
		if len(operands) == 0 {
			return nil, nil
		}
		if len(operands) == 1 {
			// Collapse single-operand group — Weaviate rejects And/Or with a single child.
			return operands[0], nil
		}
		return wb.WithOperands(operands), nil
	}

	if len(f.Path) == 0 {
		return nil, fmt.Errorf("leaf filter requires a path")
	}
	wb = wb.WithPath(f.Path)

	// IsNull is a boolean predicate regardless of the underlying property type.
	if op == filters.IsNull {
		return wb.WithValueBoolean(f.ValueBoolean), nil
	}

	return applyLeafValue(wb, f, op)
}

func applyLeafValue(
	wb *filters.WhereBuilder,
	f *WhereFilter,
	op filters.WhereOperator,
) (*filters.WhereBuilder, error) {
	if op == filters.ContainsAny || op == filters.ContainsAll {
		return applyContainsValue(wb, f)
	}

	return applySingleValue(wb, f)
}

func applyContainsValue(wb *filters.WhereBuilder, f *WhereFilter) (*filters.WhereBuilder, error) {
	switch f.ValueType {
	case "text":
		vals := f.ValueTexts
		if len(vals) == 0 && f.ValueText != "" {
			vals = []string{f.ValueText}
		}
		return wb.WithValueText(vals...), nil
	case "string":
		vals := f.ValueTexts
		if len(vals) == 0 && f.ValueString != "" {
			vals = []string{f.ValueString}
		}
		return wb.WithValueString(vals...), nil
	case "int":
		vals := f.ValueInts
		if len(vals) == 0 {
			vals = []int64{f.ValueInt}
		}
		return wb.WithValueInt(vals...), nil
	case "number":
		vals := f.ValueNumbers
		if len(vals) == 0 {
			vals = []float64{f.ValueNumber}
		}
		return wb.WithValueNumber(vals...), nil
	default:
		return applySingleValue(wb, f)
	}
}

func applySingleValue(wb *filters.WhereBuilder, f *WhereFilter) (*filters.WhereBuilder, error) {
	switch f.ValueType {
	case "text":
		return wb.WithValueText(f.ValueText), nil
	case "string":
		return wb.WithValueString(f.ValueString), nil
	case "int":
		return wb.WithValueInt(f.ValueInt), nil
	case "number":
		return wb.WithValueNumber(f.ValueNumber), nil
	case "boolean":
		return wb.WithValueBoolean(f.ValueBoolean), nil
	case "date":
		if f.ValueDate == "" {
			return nil, fmt.Errorf("date filter requires a value")
		}
		t, err := time.Parse(time.RFC3339, f.ValueDate)
		if err != nil {
			return nil, fmt.Errorf("invalid date %q: %w", f.ValueDate, err)
		}
		return wb.WithValueDate(t), nil
	default:
		return nil, fmt.Errorf("unsupported valueType %q", f.ValueType)
	}
}

func isCrossReference(dataType []string) bool {
	if len(dataType) == 0 || dataType[0] == "" {
		return false
	}
	r, _ := utf8.DecodeRuneInString(dataType[0])
	return unicode.IsUpper(r)
}

func getNestedFields(nestedProps []*models.NestedProperty) []graphql.Field {
	nestedFields := make([]graphql.Field, 0, len(nestedProps))

	for _, nestedProp := range nestedProps {
		nestedFields = append(nestedFields, graphql.Field{
			Name:   nestedProp.Name,
			Fields: getNestedFields(nestedProp.NestedProperties),
		})
	}

	return nestedFields
}
