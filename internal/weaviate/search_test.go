package weaviate

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	weaviate_models "github.com/weaviate/weaviate/entities/models"
)

func fieldNames(fields []graphql.Field) []string {
	names := make([]string, 0, len(fields))
	for _, f := range fields {
		names = append(names, f.Name)
	}
	return names
}

func findField(fields []graphql.Field, name string) *graphql.Field {
	for i := range fields {
		if fields[i].Name == name {
			return &fields[i]
		}
	}
	return nil
}

func TestGetGQLFields(t *testing.T) {
	props := []*weaviate_models.Property{
		{Name: "title", DataType: []string{"text"}},
		{Name: "count", DataType: []string{"int"}},
		{Name: "tags", DataType: []string{"text[]"}},
		{Name: "location", DataType: []string{"geoCoordinates"}},
		{Name: "author", DataType: []string{"Author"}},
		{Name: "mentions", DataType: []string{"Article", "Blog"}},
		{
			Name:     "address",
			DataType: []string{"object"},
			NestedProperties: []*weaviate_models.NestedProperty{
				{Name: "city", DataType: []string{"text"}},
			},
		},
	}

	t.Run("should skip cross-reference properties", func(t *testing.T) {
		tests := []struct {
			name       string
			props      []*weaviate_models.Property
			projection []string
			expected   []string
		}{
			{
				name:     "drops references from the full projection",
				props:    props,
				expected: []string{"title", "count", "tags", "location", "address", "_additional"},
			},
			{
				name:       "drops references that were explicitly projected",
				props:      props,
				projection: []string{"title", "author", "mentions"},
				expected:   []string{"title", "_additional"},
			},
			{
				name: "keeps properties without a data type",
				props: []*weaviate_models.Property{
					{Name: "orphan"},
					{Name: "blank", DataType: []string{""}},
				},
				expected: []string{"orphan", "blank", "_additional"},
			},
			{
				name: "drops a collection whose only property is a reference",
				props: []*weaviate_models.Property{
					{Name: "author", DataType: []string{"Author"}},
				},
				expected: []string{"_additional"},
			},
		}

		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				fields := getGQLFields(test.props, test.projection, false)

				assert.Equal(t, test.expected, fieldNames(fields))
			})
		}
	})

	t.Run("should keep nested fields for object properties", func(t *testing.T) {
		fields := getGQLFields(props, nil, false)

		address := findField(fields, "address")

		assert.NotNil(t, address)
		assert.Equal(t, []string{"city"}, fieldNames(address.Fields))
	})

	t.Run("should request relevance signals only when asked", func(t *testing.T) {
		withRelevance := findField(getGQLFields(props, nil, true), "_additional")
		withoutRelevance := findField(getGQLFields(props, nil, false), "_additional")

		assert.NotNil(t, withRelevance)
		assert.NotNil(t, withoutRelevance)
		assert.Equal(t, []string{
			"creationTimeUnix",
			"id",
			"lastUpdateTimeUnix",
			"score",
			"distance",
			"certainty",
		}, fieldNames(withRelevance.Fields))
		assert.Equal(
			t,
			[]string{"creationTimeUnix", "id", "lastUpdateTimeUnix"},
			fieldNames(withoutRelevance.Fields),
		)
	})
}
