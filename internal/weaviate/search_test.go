package weaviate

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	weaviate_grpc "github.com/weaviate/weaviate-go-client/v5/weaviate/grpc"
	weaviate_models "github.com/weaviate/weaviate/entities/models"
	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
	"github.com/weaviate/weaviate/usecases/byteops"
)

func TestRequireGrpcSearch(t *testing.T) {
	t.Run("should reject a server below the gRPC search floor", func(t *testing.T) {
		c := &WClient{
			version:     "1.28.16",
			features:    evaluateFeatures("1.28.16"),
			grpcHealthy: true,
		}

		assert.EqualError(
			t,
			c.requireGrpcSearch(),
			`search runs over gRPC and requires Weaviate 1.29.0 or newer, but this server reports "1.28.16": upgrade the server to search`,
		)
	})

	t.Run("should reject a server with an unparseable version", func(t *testing.T) {
		c := &WClient{
			version:     "unknown",
			features:    evaluateFeatures("unknown"),
			grpcHealthy: true,
		}

		assert.ErrorContains(t, c.requireGrpcSearch(), "requires Weaviate 1.29.0 or newer")
	})

	t.Run("should reject an unreachable grpc endpoint", func(t *testing.T) {
		c := &WClient{
			version:     "1.37.2",
			features:    evaluateFeatures("1.37.2"),
			grpcConfig:  weaviate_grpc.Config{Host: "localhost:50051"},
			grpcHealthy: false,
		}

		assert.EqualError(
			t,
			c.requireGrpcSearch(),
			"search runs over gRPC but the endpoint localhost:50051 was unreachable when this connection was established: fix the gRPC endpoint and reconnect",
		)
	})

	t.Run("should pass on a supported and reachable server", func(t *testing.T) {
		c := &WClient{
			version:     "1.29.0",
			features:    evaluateFeatures("1.29.0"),
			grpcHealthy: true,
		}

		assert.NoError(t, c.requireGrpcSearch())
	})
}

func TestProjectedProperties(t *testing.T) {
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

	tests := []struct {
		name       string
		props      []*weaviate_models.Property
		projection []string
		expected   []string
	}{
		{
			name:     "sends no projection when none was requested",
			props:    props,
			expected: nil,
		},
		{
			name:       "drops cross-references that were explicitly projected",
			props:      props,
			projection: []string{"title", "author", "mentions"},
			expected:   []string{"title"},
		},
		{
			name:       "keeps object properties by name so the server expands them",
			props:      props,
			projection: []string{"address", "tags"},
			expected:   []string{"tags", "address"},
		},
		{
			name:       "drops names that are not in the schema",
			props:      props,
			projection: []string{"title", "nope"},
			expected:   []string{"title"},
		},
		{
			name: "keeps properties without a data type",
			props: []*weaviate_models.Property{
				{Name: "orphan"},
				{Name: "blank", DataType: []string{""}},
			},
			projection: []string{"orphan", "blank"},
			expected:   []string{"orphan", "blank"},
		},
		{
			name: "returns an empty projection when only references were picked",
			props: []*weaviate_models.Property{
				{Name: "author", DataType: []string{"Author"}},
			},
			projection: []string{"author"},
			expected:   []string{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, projectedProperties(test.props, test.projection))
		})
	}
}

func TestSearchMetadata(t *testing.T) {
	tests := []struct {
		searchType string
		score      bool
		vector     bool
	}{
		{searchType: "bm25", score: true},
		{searchType: "hybrid", score: true},
		{searchType: "", score: true},
		{searchType: "nearText", vector: true},
		{searchType: "nearVector", vector: true},
		{searchType: "nearObject", vector: true},
	}

	for _, test := range tests {
		t.Run(test.searchType, func(t *testing.T) {
			metadata := searchMetadata(test.searchType)

			assert.True(t, metadata.ID)
			assert.True(t, metadata.CreationTimeUnix)
			assert.True(t, metadata.LastUpdateTimeUnix)
			assert.Equal(t, test.score, metadata.Score)
			assert.Equal(t, test.vector, metadata.Distance)
			assert.Equal(t, test.vector, metadata.Certainty)
		})
	}
}

func TestBuildSearchObjects(t *testing.T) {
	results := []graphql.SearchResult{
		{
			ID:         "4f9c",
			Properties: map[string]any{"title": "hello"},
			Metadata: graphql.MetadataResult{
				CreationTimeUnix:   1700000000,
				LastUpdateTimeUnix: 1700000001,
				Score:              0.5,
				Distance:           0.25,
				Certainty:          0.875,
			},
		},
	}

	t.Run("should keep only the score for keyword searches", func(t *testing.T) {
		objects := buildSearchObjects(results, "Article", "bm25", nil)

		assert.Len(t, objects, 1)
		assert.Equal(t, "4f9c", objects[0].ID)
		assert.Equal(t, "Article", objects[0].Class)
		assert.Equal(t, int64(1700000000), objects[0].CreationTimeUnix)
		assert.Equal(t, int64(1700000001), objects[0].LastUpdateTimeUnix)
		assert.Equal(t, map[string]any{"title": "hello"}, objects[0].Properties)
		assert.Equal(t, 0.5, *objects[0].Score)
		assert.Nil(t, objects[0].Distance)
		assert.Nil(t, objects[0].Certainty)
	})

	t.Run("should keep only the vector signals for vector searches", func(t *testing.T) {
		objects := buildSearchObjects(results, "Article", "nearText", nil)

		assert.Len(t, objects, 1)
		assert.Nil(t, objects[0].Score)
		assert.Equal(t, 0.25, *objects[0].Distance)
		assert.Equal(t, 0.875, *objects[0].Certainty)
	})

	t.Run("should return an empty slice for no results", func(t *testing.T) {
		assert.Equal(t, []WeaviateObject{}, buildSearchObjects(nil, "Article", "bm25", nil))
	})
}

func TestPlainProperties(t *testing.T) {
	t.Run("should pass scalars through", func(t *testing.T) {
		assert.Equal(t, map[string]any{
			"title":  "hello",
			"rating": 4.5,
			"count":  int64(3),
			"active": true,
		}, plainProperties(map[string]any{
			"title":  "hello",
			"rating": 4.5,
			"count":  int64(3),
			"active": true,
		}))
	})

	t.Run("should null out values it cannot represent", func(t *testing.T) {
		assert.Equal(
			t,
			map[string]any{"weird": nil},
			plainProperties(map[string]any{"weird": struct{}{}}),
		)
	})

	t.Run("should flatten geo coordinates", func(t *testing.T) {
		geo := &pb.GeoCoordinate{Latitude: 52.37, Longitude: 4.89}

		assert.Equal(t, map[string]any{
			"location": map[string]any{
				"latitude":  float32(52.37),
				"longitude": float32(4.89),
			},
		}, plainProperties(map[string]any{"location": geo}))
	})

	t.Run("should flatten phone numbers", func(t *testing.T) {
		phone := &pb.PhoneNumber{
			CountryCode:            31,
			DefaultCountry:         "NL",
			Input:                  "020 1234567",
			InternationalFormatted: "+31 20 1234567",
			National:               201234567,
			NationalFormatted:      "020 1234567",
			Valid:                  true,
		}

		assert.Equal(t, map[string]any{
			"countryCode":            uint64(31),
			"defaultCountry":         "NL",
			"input":                  "020 1234567",
			"internationalFormatted": "+31 20 1234567",
			"national":               uint64(201234567),
			"nationalFormatted":      "020 1234567",
			"valid":                  true,
		}, plainValue(phone))
	})

	t.Run("should flatten nested objects", func(t *testing.T) {
		nested := &pb.Properties{Fields: map[string]*pb.Value{
			"city": {Kind: &pb.Value_TextValue{TextValue: "Amsterdam"}},
			"geo": {Kind: &pb.Value_ObjectValue{ObjectValue: &pb.Properties{
				Fields: map[string]*pb.Value{
					"zip": {Kind: &pb.Value_IntValue{IntValue: 1011}},
				},
			}}},
			"missing": {Kind: &pb.Value_NullValue{}},
		}}

		assert.Equal(t, map[string]any{
			"address": map[string]any{
				"city":    "Amsterdam",
				"geo":     map[string]any{"zip": int64(1011)},
				"missing": nil,
			},
		}, plainProperties(map[string]any{"address": nested}))
	})
}

func TestPbValue(t *testing.T) {
	tests := []struct {
		name     string
		value    *pb.Value
		expected any
	}{
		{
			name:     "text",
			value:    &pb.Value{Kind: &pb.Value_TextValue{TextValue: "hello"}},
			expected: "hello",
		},
		{
			name:     "number",
			value:    &pb.Value{Kind: &pb.Value_NumberValue{NumberValue: 4.5}},
			expected: 4.5,
		},
		{
			name:     "int",
			value:    &pb.Value{Kind: &pb.Value_IntValue{IntValue: 7}},
			expected: int64(7),
		},
		{
			name:     "bool",
			value:    &pb.Value{Kind: &pb.Value_BoolValue{BoolValue: true}},
			expected: true,
		},
		{
			name:     "date",
			value:    &pb.Value{Kind: &pb.Value_DateValue{DateValue: "2026-01-01T00:00:00Z"}},
			expected: "2026-01-01T00:00:00Z",
		},
		{
			name:     "uuid",
			value:    &pb.Value{Kind: &pb.Value_UuidValue{UuidValue: "4f9c"}},
			expected: "4f9c",
		},
		{
			name:     "blob",
			value:    &pb.Value{Kind: &pb.Value_BlobValue{BlobValue: "aGk="}},
			expected: "aGk=",
		},
		{
			name:     "null",
			value:    &pb.Value{Kind: &pb.Value_NullValue{}},
			expected: nil,
		},
		{
			name:     "unset",
			value:    &pb.Value{},
			expected: nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, pbValue(test.value))
		})
	}
}

func TestPbList(t *testing.T) {
	tests := []struct {
		name     string
		list     *pb.ListValue
		expected any
	}{
		{
			name: "text values",
			list: &pb.ListValue{Kind: &pb.ListValue_TextValues{
				TextValues: &pb.TextValues{Values: []string{"a", "b"}},
			}},
			expected: []string{"a", "b"},
		},
		{
			name: "date values",
			list: &pb.ListValue{Kind: &pb.ListValue_DateValues{
				DateValues: &pb.DateValues{Values: []string{"2026-01-01T00:00:00Z"}},
			}},
			expected: []string{"2026-01-01T00:00:00Z"},
		},
		{
			name: "uuid values",
			list: &pb.ListValue{Kind: &pb.ListValue_UuidValues{
				UuidValues: &pb.UuidValues{Values: []string{"4f9c"}},
			}},
			expected: []string{"4f9c"},
		},
		{
			name: "bool values",
			list: &pb.ListValue{Kind: &pb.ListValue_BoolValues{
				BoolValues: &pb.BoolValues{Values: []bool{true, false}},
			}},
			expected: []bool{true, false},
		},
		{
			name: "number values are decoded from their packed bytes",
			list: &pb.ListValue{Kind: &pb.ListValue_NumberValues{
				NumberValues: &pb.NumberValues{
					Values: byteops.Fp64SliceToBytes([]float64{1.5, 2.5}),
				},
			}},
			expected: []float64{1.5, 2.5},
		},
		{
			name: "int values are decoded from their packed bytes",
			list: &pb.ListValue{Kind: &pb.ListValue_IntValues{
				IntValues: &pb.IntValues{
					Values: byteops.IntsToByteVector([]float64{3, 4}),
				},
			}},
			expected: []int64{3, 4},
		},
		{
			name: "object values",
			list: &pb.ListValue{Kind: &pb.ListValue_ObjectValues{
				ObjectValues: &pb.ObjectValues{Values: []*pb.Properties{
					{Fields: map[string]*pb.Value{
						"city": {Kind: &pb.Value_TextValue{TextValue: "Amsterdam"}},
					}},
				}},
			}},
			expected: []map[string]any{{"city": "Amsterdam"}},
		},
		{
			name:     "unset",
			list:     &pb.ListValue{},
			expected: nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, pbList(test.list))
		})
	}
}

func TestIsCrossReference(t *testing.T) {
	tests := []struct {
		name     string
		dataType []string
		expected bool
	}{
		{name: "no data type", dataType: nil, expected: false},
		{name: "blank data type", dataType: []string{""}, expected: false},
		{name: "primitive", dataType: []string{"text"}, expected: false},
		{name: "primitive array", dataType: []string{"text[]"}, expected: false},
		{name: "geo", dataType: []string{"geoCoordinates"}, expected: false},
		{name: "nested object", dataType: []string{"object"}, expected: false},
		{name: "single reference", dataType: []string{"Author"}, expected: true},
		{name: "multi reference", dataType: []string{"Article", "Blog"}, expected: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, isCrossReference(test.dataType))
		})
	}
}

func TestReferenceTargets(t *testing.T) {
	props := []*weaviate_models.Property{
		{Name: "title", DataType: []string{"text"}},
		{Name: "author", DataType: []string{"Author"}},
		{Name: "mentions", DataType: []string{"Article", "Blog"}},
		{Name: "broken", DataType: []string{""}},
	}

	tests := []struct {
		name       string
		props      []*weaviate_models.Property
		projection []string
		expected   []referenceTarget
	}{
		{
			name:  "requests every reference when no projection was given",
			props: props,
			expected: []referenceTarget{
				{property: "author", collection: "Author"},
				{property: "mentions", collection: "Article"},
				{property: "mentions", collection: "Blog"},
			},
		},
		{
			name:       "requests only the projected references",
			props:      props,
			projection: []string{"title", "mentions"},
			expected: []referenceTarget{
				{property: "mentions", collection: "Article"},
				{property: "mentions", collection: "Blog"},
			},
		},
		{
			name:       "returns nothing when the projection has no reference",
			props:      props,
			projection: []string{"title"},
			expected:   []referenceTarget{},
		},
		{
			name:     "returns nothing for a collection without references",
			props:    []*weaviate_models.Property{{Name: "title", DataType: []string{"text"}}},
			expected: []referenceTarget{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, referenceTargets(test.props, test.projection))
		})
	}
}

func TestReferenceLabelProperty(t *testing.T) {
	tests := []struct {
		name     string
		props    []*weaviate_models.Property
		expected string
	}{
		{
			name: "prefers a conventionally named text property",
			props: []*weaviate_models.Property{
				{Name: "summary", DataType: []string{"text"}},
				{Name: "title", DataType: []string{"text"}},
			},
			expected: "title",
		},
		{
			name: "matches a preferred name case-insensitively",
			props: []*weaviate_models.Property{
				{Name: "body", DataType: []string{"text"}},
				{Name: "Name", DataType: []string{"string"}},
			},
			expected: "Name",
		},
		{
			name: "falls back to the first text property",
			props: []*weaviate_models.Property{
				{Name: "count", DataType: []string{"int"}},
				{Name: "summary", DataType: []string{"text"}},
				{Name: "body", DataType: []string{"text"}},
			},
			expected: "summary",
		},
		{
			name: "falls back to a scalar when there is no text property",
			props: []*weaviate_models.Property{
				{Name: "tags", DataType: []string{"text[]"}},
				{Name: "count", DataType: []string{"int"}},
			},
			expected: "count",
		},
		{
			name: "falls back to any non-reference property as a last resort",
			props: []*weaviate_models.Property{
				{Name: "tags", DataType: []string{"text[]"}},
			},
			expected: "tags",
		},
		{
			name: "never picks a reference or a blob",
			props: []*weaviate_models.Property{
				{Name: "author", DataType: []string{"Author"}},
				{Name: "cover", DataType: []string{"blob"}},
				{Name: "unknown"},
			},
			expected: "",
		},
		{
			name:     "returns nothing for a collection without properties",
			props:    nil,
			expected: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, referenceLabelProperty(test.props))
		})
	}
}

func TestBuildReferences(t *testing.T) {
	t.Run("should carry the id, collection and projection of each target", func(t *testing.T) {
		references := buildReferences(
			[]graphql.ReferenceResult{{
				Name: "author",
				ReferenceProperties: []graphql.ReferencePropertiesResult{
					{
						Properties: map[string]any{"name": "Jane"},
						Metadata:   graphql.ReferenceMetadataResult{ID: "a1"},
					},
					{
						Properties: map[string]any{"name": "John"},
						Metadata:   graphql.ReferenceMetadataResult{ID: "a2"},
					},
				},
			}},
			[]referenceTarget{{property: "author", collection: "Author"}},
		)

		assert.Equal(t, []ObjectReference{{
			Property: "author",
			Targets: []ReferenceTarget{
				{ID: "a1", Collection: "Author", Properties: map[string]any{"name": "Jane"}},
				{ID: "a2", Collection: "Author", Properties: map[string]any{"name": "John"}},
			},
		}}, references)
	})

	t.Run("should merge the groups of a multi-target reference", func(t *testing.T) {
		references := buildReferences(
			[]graphql.ReferenceResult{
				{
					Name: "mentions",
					ReferenceProperties: []graphql.ReferencePropertiesResult{{
						Properties: map[string]any{"title": "an article"},
						Metadata:   graphql.ReferenceMetadataResult{ID: "r1"},
					}},
				},
				{
					Name: "mentions",
					ReferenceProperties: []graphql.ReferencePropertiesResult{{
						Properties: map[string]any{"name": "a blog"},
						Metadata:   graphql.ReferenceMetadataResult{ID: "r2"},
					}},
				},
			},
			[]referenceTarget{
				{property: "mentions", collection: "Article"},
				{property: "mentions", collection: "Blog"},
			},
		)

		assert.Equal(t, []ObjectReference{{
			Property: "mentions",
			Targets: []ReferenceTarget{
				{ID: "r1", Collection: "Article", Properties: map[string]any{"title": "an article"}},
				{ID: "r2", Collection: "Blog", Properties: map[string]any{"name": "a blog"}},
			},
		}}, references)
	})

	t.Run("should keep the first occurrence of a repeated target", func(t *testing.T) {
		references := buildReferences(
			[]graphql.ReferenceResult{
				{
					Name: "mentions",
					ReferenceProperties: []graphql.ReferencePropertiesResult{{
						Properties: map[string]any{"title": "an article"},
						Metadata:   graphql.ReferenceMetadataResult{ID: "r1"},
					}},
				},
				{
					Name: "mentions",
					ReferenceProperties: []graphql.ReferencePropertiesResult{{
						Properties: map[string]any{"name": nil},
						Metadata:   graphql.ReferenceMetadataResult{ID: "r1"},
					}},
				},
			},
			[]referenceTarget{
				{property: "mentions", collection: "Article"},
				{property: "mentions", collection: "Blog"},
			},
		)

		assert.Equal(t, []ObjectReference{{
			Property: "mentions",
			Targets: []ReferenceTarget{
				{ID: "r1", Collection: "Article", Properties: map[string]any{"title": "an article"}},
			},
		}}, references)
	})

	t.Run("should drop unresolvable values and targets without an id", func(t *testing.T) {
		references := buildReferences(
			[]graphql.ReferenceResult{{
				Name: "author",
				ReferenceProperties: []graphql.ReferencePropertiesResult{
					{
						Properties: map[string]any{"name": nil},
						Metadata:   graphql.ReferenceMetadataResult{ID: "a1"},
					},
					{Properties: map[string]any{"name": "Nobody"}},
				},
			}},
			[]referenceTarget{{property: "author", collection: "Author"}},
		)

		assert.Equal(t, []ObjectReference{{
			Property: "author",
			Targets:  []ReferenceTarget{{ID: "a1", Collection: "Author"}},
		}}, references)
	})

	t.Run("should flatten composite projected values", func(t *testing.T) {
		references := buildReferences(
			[]graphql.ReferenceResult{{
				Name: "author",
				ReferenceProperties: []graphql.ReferencePropertiesResult{{
					Properties: map[string]any{"aliases": &pb.ListValue{
						Kind: &pb.ListValue_TextValues{
							TextValues: &pb.TextValues{Values: []string{"j", "jd"}},
						},
					}},
					Metadata: graphql.ReferenceMetadataResult{ID: "a1"},
				}},
			}},
			[]referenceTarget{{property: "author", collection: "Author"}},
		)

		assert.Equal(
			t,
			map[string]any{"aliases": []string{"j", "jd"}},
			references[0].Targets[0].Properties,
		)
	})

	t.Run("should leave the collection empty when a group was not requested", func(t *testing.T) {
		references := buildReferences(
			[]graphql.ReferenceResult{{
				Name: "author",
				ReferenceProperties: []graphql.ReferencePropertiesResult{{
					Metadata: graphql.ReferenceMetadataResult{ID: "a1"},
				}},
			}},
			nil,
		)

		assert.Equal(t, []ObjectReference{{
			Property: "author",
			Targets:  []ReferenceTarget{{ID: "a1"}},
		}}, references)
	})

	t.Run("should return nothing when no reference resolved", func(t *testing.T) {
		assert.Nil(t, buildReferences(nil, []referenceTarget{
			{property: "author", collection: "Author"},
		}))
		assert.Nil(t, buildReferences([]graphql.ReferenceResult{{Name: "author"}}, nil))
	})
}

func TestBuildSearchObjectsReferences(t *testing.T) {
	objects := buildSearchObjects(
		[]graphql.SearchResult{
			{
				ID:         "4f9c",
				Properties: map[string]any{"title": "hello"},
				References: []graphql.ReferenceResult{{
					Name: "author",
					ReferenceProperties: []graphql.ReferencePropertiesResult{{
						Properties: map[string]any{"name": "Jane"},
						Metadata:   graphql.ReferenceMetadataResult{ID: "a1"},
					}},
				}},
			},
			{ID: "8b2d", Properties: map[string]any{"title": "world"}},
		},
		"Article",
		"bm25",
		[]referenceTarget{{property: "author", collection: "Author"}},
	)

	assert.Len(t, objects, 2)
	assert.Equal(t, []ObjectReference{{
		Property: "author",
		Targets: []ReferenceTarget{
			{ID: "a1", Collection: "Author", Properties: map[string]any{"name": "Jane"}},
		},
	}}, objects[0].References)
	assert.Nil(t, objects[1].References)
}
