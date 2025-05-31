package weaviate

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"
	"weaviate-gui/internal/utils"

	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	"github.com/weaviate/weaviate/entities/models"
)

// TODO: support different types of searches
func (w *Weaviate) Search(
	connectionID int64,
	pageSize int,
	offset int,
	collection, tenant, term string,
) (*PaginatedObjectResponse, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	col, err := c.w.Schema().ClassGetter().WithClassName(collection).Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed retrieving schema for %s: %w", collection, err)
	}

	gqlQuery := c.w.GraphQL().Get().
		WithClassName(collection).
		WithLimit(pageSize).
		WithOffset(offset).
		WithFields(getGQLFields(col.Properties)...).
		WithBM25((&graphql.BM25ArgumentBuilder{}).WithQuery(term))
	if tenant != "" {
		gqlQuery = gqlQuery.WithTenant(tenant)
	}

	now := time.Now()

	result, err := gqlQuery.Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed executing keyword search for %s: %w", term, err)
	}
	if len(result.Errors) > 0 {
		return nil, handleGQLError(result, term)
	}
	if len(result.Data) == 0 {
		slog.Debug("no results found for keyword search", slog.String("term", term), slog.String("collection", collection))
	}

	objects := result.Data["Get"].(map[string]any)[collection].([]any)

	if len(objects) == 0 {
		slog.Debug("no objects found for keyword search", slog.String("term", term), slog.String("collection", collection))
		return nil, nil
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
				Class:              collection,
				LastUpdateTimeUnix: utils.MustParseInt[int64](objMap["_additional"].(map[string]any)["lastUpdateTimeUnix"].(string)),
				CreationTimeUnix:   utils.MustParseInt[int64](objMap["_additional"].(map[string]any)["creationTimeUnix"].(string)),
				ID:                 objMap["_additional"].(map[string]any)["id"].(string),
				Properties:         objMap,
			}
			// Remove the _additional field from properties
			delete(object.Properties.(map[string]any), "_additional")
			// Add the object to the response
			response.Objects = append(response.Objects, object)
		}
	}

	return response, nil
}

func handleGQLError(result *models.GraphQLResponse, term string) error {
	errMsg := strings.Builder{}
	for _, e := range result.Errors {
		errMsg.WriteString(e.Message)
		errMsg.WriteString(", ")
	}

	return fmt.Errorf("weaviate returned errors for keyword search %s: %s", term, errMsg.String())
}

func getGQLFields(props []*models.Property) []graphql.Field {
	fields := make([]graphql.Field, 0, len(props))
	for _, prop := range props {
		fields = append(fields, graphql.Field{Name: prop.Name})
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
