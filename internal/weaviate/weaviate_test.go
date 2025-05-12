package weaviate

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"weaviate-gui/internal/http_util"
	"weaviate-gui/internal/models"
	"weaviate-gui/internal/utils"

	"github.com/stretchr/testify/assert"
)

func TestWeaviate(t *testing.T) {
	connectionID := int64(1)
	collection := "TestCollection"
	limit := 10
	cursor := "mock-cursor"
	tenant := "mock-tenant"

	t.Run("GetObjectsPaginated", func(t *testing.T) {
		t.Run("should return error if connection doesn't exist", func(t *testing.T) {
			mockStorage := NewMockStorage(t)

			mockStorage.EXPECT().
				GetConnection(connectionID, true).
				Return(nil, fmt.Errorf("mock-error"))

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			objects, err := weaviate.GetObjectsPaginated(
				connectionID,
				10,
				"TestCollection",
				"mock-cursor",
				"mock-tenant",
			)

			assert.Nil(t, objects)
			assert.EqualError(t, err, "failed retrieving connection 1: mock-error")
		})

		t.Run(
			"should set class/limit/after/tenant on the query and returns paginated objects",
			func(t *testing.T) {
				mockServer := http_util.NewServer(
					http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						if strings.Contains(r.URL.Path, "/v1/objects") &&
							r.Method == http.MethodGet {

							assert.Equal(t, collection, r.URL.Query().Get("class"))
							assert.Equal(t, fmt.Sprintf("%d", limit), r.URL.Query().Get("limit"))
							assert.Equal(t, cursor, r.URL.Query().Get("after"))
							assert.Equal(t, tenant, r.URL.Query().Get("tenant"))

							w.WriteHeader(http.StatusOK)
							w.Write([]byte(`{
						"totalResults": 1,
						"objects": [
							{
								"class": "TestClass0"
							},
							{
								"class": "TestClass1"
							},
							{
								"class": "TestClass2"
							}
						]
					}`))

							return
						}

						t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
						t.Fail()
					}),
				)
				t.Cleanup(mockServer.Close)

				mockStorage := NewMockStorage(t)

				mockStorage.EXPECT().GetConnection(connectionID, true).Return(&models.Connection{
					URI: mockServer.URL + "/v1/objects",
				}, nil)

				weaviate := New(mockStorage, Configuration{
					StatusUpdateInterval: time.Hour,
				})

				objects, err := weaviate.GetObjectsPaginated(
					connectionID,
					limit,
					collection,
					cursor,
					tenant,
				)

				assert.NoError(t, err)
				assert.Len(t, objects.Objects, 3)
				assert.Equal(t, 1, objects.TotalResults)
				assert.Equal(t, "TestClass0", objects.Objects[0].Class)
				assert.Equal(t, "TestClass1", objects.Objects[1].Class)
				assert.Equal(t, "TestClass2", objects.Objects[2].Class)
				mockStorage.AssertExpectations(t)
			},
		)

		t.Run("should pass auth header if api key is set", func(t *testing.T) {
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.Contains(r.URL.Path, "/v1/objects") && r.Method == http.MethodGet {

						assert.Equal(t, collection, r.URL.Query().Get("class"))
						assert.Equal(t, fmt.Sprintf("%d", limit), r.URL.Query().Get("limit"))
						assert.Equal(t, cursor, r.URL.Query().Get("after"))
						assert.False(t, r.URL.Query().Has("tenant"))
						assert.Equal(t, "Bearer mock-api-key", r.Header.Get("Authorization"))

						w.WriteHeader(http.StatusOK)
						w.Write([]byte(`{
						"totalResults": 1,
						"objects": [
							{
								"class": "TestClass0"
							},
							{
								"class": "TestClass1"
							},
							{
								"class": "TestClass2"
							}
						]
					}`))

						return
					}

					t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
					t.Fail()
				}),
			)
			t.Cleanup(mockServer.Close)

			mockStorage := NewMockStorage(t)

			mockStorage.EXPECT().GetConnection(connectionID, true).Return(&models.Connection{
				URI:    mockServer.URL + "/v1/objects",
				ApiKey: utils.Pointer("mock-api-key"),
			}, nil)

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			objects, err := weaviate.GetObjectsPaginated(
				connectionID,
				limit,
				collection,
				cursor,
				"",
			)

			assert.NoError(t, err)
			assert.Len(t, objects.Objects, 3)
			assert.Equal(t, 1, objects.TotalResults)
			assert.Equal(t, "TestClass0", objects.Objects[0].Class)
			assert.Equal(t, "TestClass1", objects.Objects[1].Class)
			assert.Equal(t, "TestClass2", objects.Objects[2].Class)
			mockStorage.AssertExpectations(t)
		})

		t.Run("should return error if bad code status", func(t *testing.T) {
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.Contains(r.URL.Path, "/v1/objects") && r.Method == http.MethodGet {

						assert.Equal(t, collection, r.URL.Query().Get("class"))
						assert.Equal(t, fmt.Sprintf("%d", limit), r.URL.Query().Get("limit"))
						assert.Equal(t, cursor, r.URL.Query().Get("after"))
						assert.Equal(t, tenant, r.URL.Query().Get("tenant"))

						w.WriteHeader(http.StatusBadRequest)
						w.Write([]byte(`{
						"error": [{
							"message": "Bad request"
						}]
					}`))

						return
					}

					t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
					t.Fail()
				}),
			)
			t.Cleanup(mockServer.Close)

			mockStorage := NewMockStorage(t)

			mockStorage.EXPECT().GetConnection(connectionID, true).Return(&models.Connection{
				URI: mockServer.URL + "/v1/objects",
			}, nil)

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			objects, err := weaviate.GetObjectsPaginated(
				connectionID,
				limit,
				collection,
				cursor,
				tenant,
			)

			assert.Nil(t, objects)
			assert.EqualError(
				t,
				err,
				"weaviate return non successful http status code 400 Bad Request for after=mock-cursor&class=TestCollection&limit=10&tenant=mock-tenant: Bad request",
			)
			mockStorage.AssertExpectations(t)
		})
	})
}
