package weaviate

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/weaviate/weaviate-go-client/v5/weaviate/filters"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
	"github.com/weaviate/weaviate/usecases/byteops"
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

// requireGrpcSearch enforces the two preconditions of the gRPC search path.
// Both failures are reported separately because the remedies differ: an old
// server needs upgrading, an unreachable endpoint needs its host/port fixed.
func (c *WClient) requireGrpcSearch() error {
	if !c.features[FeatureGrpcSearch] {
		return fmt.Errorf(
			"search runs over gRPC and requires Weaviate %s or newer, but this server reports %q: upgrade the server to search",
			featureMinVersions[FeatureGrpcSearch],
			c.version,
		)
	}

	if !c.grpcHealthy {
		return fmt.Errorf(
			"search runs over gRPC but the endpoint %s was unreachable when this connection was established: fix the gRPC endpoint and reconnect",
			c.grpcConfig.Host,
		)
	}

	return nil
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

	if err := c.requireGrpcSearch(); err != nil {
		return nil, err
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

	search := c.w.Experimental().Search().
		WithCollection(collection).
		WithTenant(tenant).
		WithLimit(limit).
		WithOffset(opts.Offset).
		WithMetadata(searchMetadata(searchType)).
		WithProperties(projectedProperties(col.Properties, opts.Properties)...)

	search, err = applySearchOperator(search, searchType, query, opts)
	if err != nil {
		return nil, err
	}

	wb, err := buildWhereBuilder(opts.Where)
	if err != nil {
		return nil, fmt.Errorf("invalid where filter: %w", err)
	}
	if wb != nil {
		search = search.WithWhere(wb)
	}

	results, err := search.Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed executing %s search for %s: %w", searchType, query, err)
	}

	if len(results) == 0 {
		slog.Debug(
			"no objects found for search",
			slog.String("query", query),
			slog.String("searchType", searchType),
			slog.String("collection", collection),
		)
	}

	return &PaginatedObjectResponse{
		Objects:       buildSearchObjects(results, collection, searchType),
		TotalResults:  len(results),
		ExecutionTime: time.Since(now).String(),
	}, nil
}

func applySearchOperator(
	search *graphql.Search,
	searchType, query string,
	opts SearchOptions,
) (*graphql.Search, error) {
	switch searchType {
	case "hybrid":
		return search.WithHybrid(buildHybridArgument(query, opts)), nil
	case "nearText":
		return search.WithNearText(buildNearTextArgument(query, opts)), nil
	case "nearVector":
		nv, err := buildNearVectorArgument(query, opts)
		if err != nil {
			return nil, err
		}
		return search.WithNearVector(nv), nil
	case "nearObject":
		return search.WithNearObject(buildNearObjectArgument(query, opts)), nil
	default: // "bm25"
		return search.WithBM25((&graphql.BM25ArgumentBuilder{}).WithQuery(query)), nil
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

// searchMetadata requests only the relevance signals that are meaningful for
// the chosen search type — see relevantSignals for why the rest are skipped.
func searchMetadata(searchType string) *graphql.Metadata {
	keepScore, keepVectorSignals := relevantSignals(searchType)

	return &graphql.Metadata{
		ID:                 true,
		CreationTimeUnix:   true,
		LastUpdateTimeUnix: true,
		Score:              keepScore,
		Distance:           keepVectorSignals,
		Certainty:          keepVectorSignals,
	}
}

// projectedProperties narrows the returned properties to the requested
// projection, dropping cross-references: gRPC returns references through a
// separate reference request, so naming one as a plain property would make the
// server resolve it as a primitive. An empty result means "all non-ref
// properties", which is what the client sends when no projection is given.
func projectedProperties(props []*models.Property, projection []string) []string {
	if len(projection) == 0 {
		return nil
	}

	allowed := make(map[string]struct{}, len(projection))
	for _, p := range projection {
		allowed[p] = struct{}{}
	}

	out := make([]string, 0, len(projection))
	for _, prop := range props {
		if _, ok := allowed[prop.Name]; !ok {
			continue
		}
		if isCrossReference(prop.DataType) {
			continue
		}
		out = append(out, prop.Name)
	}

	return out
}

func buildSearchObjects(
	results []graphql.SearchResult,
	collection, searchType string,
) []WeaviateObject {
	keepScore, keepVectorSignals := relevantSignals(searchType)

	out := make([]WeaviateObject, 0, len(results))
	for _, result := range results {
		object := WeaviateObject{
			ID:                 result.ID,
			Class:              collection,
			CreationTimeUnix:   result.Metadata.CreationTimeUnix,
			LastUpdateTimeUnix: result.Metadata.LastUpdateTimeUnix,
			Properties:         plainProperties(result.Properties),
		}
		if keepScore {
			object.Score = signalValue(result.Metadata.Score)
		}
		if keepVectorSignals {
			object.Distance = signalValue(result.Metadata.Distance)
			object.Certainty = signalValue(result.Metadata.Certainty)
		}
		out = append(out, object)
	}

	return out
}

func signalValue(v float32) *float64 {
	f := float64(v)
	return &f
}

// relevantSignals returns which relevance signals are meaningful for a given
// search type. The server populates whatever metadata the request asks for,
// including the signals that do not apply — a nearObject result still comes
// back with ScorePresent=true and score=0, and a bm25 result with distance=0.
// Returning those would render a misleading "Score 0" / "Distance 0" badge in
// the UI, so we neither request nor surface them.
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

// plainProperties converts the properties of a gRPC search result into plain
// JSON-marshallable Go values. The client hands back the raw protobuf wrappers
// for the composite datatypes, which would otherwise leak their wire shape
// (oneof envelopes, byte-packed numeric arrays) into the frontend.
func plainProperties(props map[string]any) map[string]any {
	out := make(map[string]any, len(props))
	for name, value := range props {
		out[name] = plainValue(value)
	}

	return out
}

func plainValue(value any) any {
	switch v := value.(type) {
	case string, float64, int64, bool:
		return v
	case *pb.Properties:
		return pbProperties(v)
	case *pb.ListValue:
		return pbList(v)
	case *pb.GeoCoordinate:
		return pbGeo(v)
	case *pb.PhoneNumber:
		return pbPhone(v)
	default:
		return nil
	}
}

func pbProperties(props *pb.Properties) map[string]any {
	fields := props.GetFields()
	out := make(map[string]any, len(fields))
	for name, value := range fields {
		out[name] = pbValue(value)
	}

	return out
}

func pbValue(value *pb.Value) any {
	switch value.GetKind().(type) {
	case *pb.Value_TextValue:
		return value.GetTextValue()
	case *pb.Value_NumberValue:
		return value.GetNumberValue()
	case *pb.Value_IntValue:
		return value.GetIntValue()
	case *pb.Value_BoolValue:
		return value.GetBoolValue()
	case *pb.Value_DateValue:
		return value.GetDateValue()
	case *pb.Value_UuidValue:
		return value.GetUuidValue()
	case *pb.Value_BlobValue:
		return value.GetBlobValue()
	case *pb.Value_GeoValue:
		return pbGeo(value.GetGeoValue())
	case *pb.Value_PhoneValue:
		return pbPhone(value.GetPhoneValue())
	case *pb.Value_ObjectValue:
		return pbProperties(value.GetObjectValue())
	case *pb.Value_ListValue:
		return pbList(value.GetListValue())
	default:
		return nil
	}
}

func pbList(list *pb.ListValue) any {
	switch list.GetKind().(type) {
	case *pb.ListValue_TextValues:
		return list.GetTextValues().GetValues()
	case *pb.ListValue_DateValues:
		return list.GetDateValues().GetValues()
	case *pb.ListValue_UuidValues:
		return list.GetUuidValues().GetValues()
	case *pb.ListValue_BoolValues:
		return list.GetBoolValues().GetValues()
	case *pb.ListValue_NumberValues:
		return byteops.Fp64SliceFromBytes(list.GetNumberValues().GetValues())
	case *pb.ListValue_IntValues:
		return byteops.IntsFromByteVector(list.GetIntValues().GetValues())
	case *pb.ListValue_ObjectValues:
		return pbObjectList(list.GetObjectValues().GetValues())
	default:
		return nil
	}
}

func pbObjectList(objects []*pb.Properties) []map[string]any {
	out := make([]map[string]any, 0, len(objects))
	for _, object := range objects {
		out = append(out, pbProperties(object))
	}

	return out
}

func pbGeo(geo *pb.GeoCoordinate) map[string]any {
	return map[string]any{
		"latitude":  geo.GetLatitude(),
		"longitude": geo.GetLongitude(),
	}
}

func pbPhone(phone *pb.PhoneNumber) map[string]any {
	return map[string]any{
		"countryCode":            phone.GetCountryCode(),
		"defaultCountry":         phone.GetDefaultCountry(),
		"input":                  phone.GetInput(),
		"internationalFormatted": phone.GetInternationalFormatted(),
		"national":               phone.GetNational(),
		"nationalFormatted":      phone.GetNationalFormatted(),
		"valid":                  phone.GetValid(),
	}
}

func parseVectorQuery(query string) ([]float32, error) {
	var vector []float32
	if err := json.Unmarshal([]byte(query), &vector); err != nil {
		return nil, fmt.Errorf(
			"invalid vector: expected a JSON array of floats (e.g. [0.1, 0.2, ...]): %w",
			err,
		)
	}
	return vector, nil
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
