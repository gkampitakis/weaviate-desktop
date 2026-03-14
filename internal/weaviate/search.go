package weaviate

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"weaviate-desktop/internal/utils"

	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
)

// SearchOptions holds optional parameters for all search types.
// Zero values mean "use default / not set".
type SearchOptions struct {
	// Limit is the maximum number of results to return (default 100).
	Limit int
	// Alpha controls the BM25/vector balance in Hybrid search (0.0–1.0, default 0.75).
	Alpha float32
	// FusionType is the fusion algorithm for Hybrid search: "rankedFusion" | "relativeScoreFusion".
	FusionType string
	// Distance threshold for nearText/nearVector (0 = not set).
	Distance float32
	// Certainty threshold for nearText/nearVector (0 = not set).
	Certainty float32
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

	gqlQuery := c.w.GraphQL().Get().
		WithClassName(collection).
		WithLimit(limit).
		WithFields(getGQLFields(col.Properties)...)

	switch searchType {
	case "hybrid":
		alpha := opts.Alpha
		if alpha == 0 {
			alpha = 0.75
		}
		h := (&graphql.HybridArgumentBuilder{}).WithQuery(query).WithAlpha(alpha)
		if opts.FusionType != "" {
			h = h.WithFusionType(graphql.FusionType(opts.FusionType))
		}
		gqlQuery = gqlQuery.WithHybrid(h)
	case "nearText":
		nt := (&graphql.NearTextArgumentBuilder{}).WithConcepts([]string{query})
		if opts.Distance > 0 {
			nt = nt.WithDistance(opts.Distance)
		}
		if opts.Certainty > 0 {
			nt = nt.WithCertainty(opts.Certainty)
		}
		gqlQuery = gqlQuery.WithNearText(nt)
	case "nearVector":
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
		gqlQuery = gqlQuery.WithNearVector(nv)
	default: // "bm25"
		gqlQuery = gqlQuery.WithBM25((&graphql.BM25ArgumentBuilder{}).WithQuery(query))
	}

	if tenant != "" {
		gqlQuery = gqlQuery.WithTenant(tenant)
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

	response := &PaginatedObjectResponse{
		Objects:       make([]WeaviateObject, 0, len(objects)),
		TotalResults:  len(objects),
		ExecutionTime: time.Since(now).String(),
	}

	for _, obj := range objects {
		if objMap, ok := obj.(map[string]any); ok {
			// Convert the object to models.Object
			object := WeaviateObject{
				Class: collection,
				LastUpdateTimeUnix: utils.MustParseInt[int64](
					objMap["_additional"].(map[string]any)["lastUpdateTimeUnix"].(string),
				),
				CreationTimeUnix: utils.MustParseInt[int64](
					objMap["_additional"].(map[string]any)["creationTimeUnix"].(string),
				),
				ID:         objMap["_additional"].(map[string]any)["id"].(string),
				Properties: objMap,
			}
			// Remove the _additional field from properties
			delete(object.Properties.(map[string]any), "_additional")
			// Add the object to the response
			response.Objects = append(response.Objects, object)
		}
	}

	return response, nil
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

func getGQLFields(props []*models.Property) []graphql.Field {
	fields := make([]graphql.Field, 0, len(props))
	for _, prop := range props {
		fields = append(fields, graphql.Field{
			Name:   prop.Name,
			Fields: getNestedFields(prop.NestedProperties),
		})
	}

	fields = append(fields, graphql.Field{
		Name: "_additional",
		Fields: []graphql.Field{
			{Name: "creationTimeUnix"},
			{Name: "id"},
			{Name: "lastUpdateTimeUnix"},
		},
	})
	return fields
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
