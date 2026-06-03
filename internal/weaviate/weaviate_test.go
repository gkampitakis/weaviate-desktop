package weaviate

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"weaviate-desktop/internal/http_util"
	"weaviate-desktop/internal/models"
	"weaviate-desktop/internal/utils"

	"github.com/stretchr/testify/assert"
	weaviate_models "github.com/weaviate/weaviate/entities/models"
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

	t.Run("TestConnection", func(t *testing.T) {
		t.Run("should return nil if request is successful", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.Contains(r.URL.Path, "/v1/meta") &&
						r.Method == http.MethodGet {
						assert.Equal(t, "Bearer mock-api-key", r.Header.Get("Authorization"))
						w.WriteHeader(http.StatusOK)
						w.Write([]byte(`{}`))

						return
					}

					t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
					t.Fail()
				}),
			)
			t.Cleanup(mockServer.Close)

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			err := weaviate.TestConnection(TestConnectionInput{
				URI:    mockServer.URL,
				ApiKey: utils.Pointer("mock-api-key"),
			})

			assert.NoError(t, err)
			mockStorage.AssertExpectations(t)
		})
	})

	t.Run("Connect & Disconnect", func(t *testing.T) {
		t.Run("disconnect should remove client from map", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			// Add a client manually to the map
			weaviate.clients[connectionID] = &WClient{
				healthy: true,
				w:       nil,
			}

			// Verify client exists
			assert.Contains(t, weaviate.clients, connectionID)

			// Disconnect
			err := weaviate.Disconnect(connectionID)

			// Verify client no longer exists and no error was returned
			assert.NoError(t, err)
			assert.NotContains(t, weaviate.clients, connectionID)
		})

		t.Run("disconnect should return nil if client doesn't exist", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			// Verify client doesn't exist
			assert.NotContains(t, weaviate.clients, connectionID)

			// Disconnect
			err := weaviate.Disconnect(connectionID)

			// Verify no error was returned
			assert.NoError(t, err)
		})

		t.Run("should return nil if client already exists", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			// Manually add a client to the map
			weaviate.clients[connectionID] = &WClient{
				healthy: true,
				w:       nil, // Not needed for this test
			}

			assert.NoError(t, weaviate.Connect(connectionID))
			mockStorage.AssertExpectations(t)
		})

		t.Run("should return error if connection doesn't exist", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			mockStorage.EXPECT().
				GetConnection(connectionID, true).
				Return(nil, fmt.Errorf("mock-error"))

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			assert.EqualError(t, weaviate.Connect(connectionID), "mock-error")
			mockStorage.AssertExpectations(t)
		})

		t.Run("should initialize client and verify connection health", func(t *testing.T) {
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.Contains(r.URL.Path, "/v1/meta") &&
						r.Method == http.MethodGet {
						assert.Equal(t, "Bearer mock-api-key", r.Header.Get("Authorization"))
						w.WriteHeader(http.StatusOK)
						w.Write([]byte(`{}`))
						return
					}

					t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
					t.Fail()
				}),
			)
			t.Cleanup(mockServer.Close)

			mockStorage := NewMockStorage(t)
			mockStorage.EXPECT().
				GetConnection(connectionID, true).
				Return(&models.Connection{
					URI:    mockServer.URL,
					ApiKey: utils.Pointer("mock-api-key"),
				}, nil)

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			assert.NoError(t, weaviate.Connect(connectionID))
			assert.Contains(t, weaviate.clients, connectionID)
			assert.True(t, weaviate.clients[connectionID].healthy)
			mockStorage.AssertExpectations(t)
		})

		t.Run("should return error if connection verification fails", func(t *testing.T) {
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if strings.Contains(r.URL.Path, "/v1/meta") &&
						r.Method == http.MethodGet {
						w.WriteHeader(http.StatusInternalServerError)
						w.Write([]byte(`{"error": "mock server error"}`))
						return
					}

					t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
					t.Fail()
				}),
			)
			t.Cleanup(mockServer.Close)

			mockStorage := NewMockStorage(t)
			mockStorage.EXPECT().
				GetConnection(connectionID, true).
				Return(&models.Connection{
					URI: mockServer.URL,
				}, nil)

			weaviate := New(mockStorage, Configuration{
				StatusUpdateInterval: time.Hour,
			})

			err := weaviate.Connect(connectionID)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed connecting to")
			assert.NotContains(t, weaviate.clients, connectionID)
			mockStorage.AssertExpectations(t)
		})
	})

	t.Run("CreateCollection", func(t *testing.T) {
		t.Run("should return error if connection doesn't exist", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			weaviate := New(mockStorage, Configuration{StatusUpdateInterval: time.Hour})

			err := weaviate.CreateCollection(connectionID, &weaviate_models.Class{Class: "Foo"})

			assert.EqualError(t, err, "connection doesn't exist 1")
		})

		t.Run("should return error if class is nil or unnamed", func(t *testing.T) {
			weaviate := connectedWeaviate(t, connectionID, nil)

			err := weaviate.CreateCollection(connectionID, nil)
			assert.EqualError(t, err, "collection name is required")

			err = weaviate.CreateCollection(connectionID, &weaviate_models.Class{})
			assert.EqualError(t, err, "collection name is required")
		})

		t.Run("should POST class definition to /v1/schema", func(t *testing.T) {
			var received weaviate_models.Class
			weaviate := connectedWeaviate(t, connectionID, func(w http.ResponseWriter, r *http.Request) bool {
				if r.URL.Path == "/v1/schema" && r.Method == http.MethodPost {
					body, _ := io.ReadAll(r.Body)
					assert.NoError(t, json.Unmarshal(body, &received))
					w.WriteHeader(http.StatusOK)
					w.Write(body)
					return true
				}
				return false
			})

			class := &weaviate_models.Class{
				Class:       "Movies",
				Description: "Movie collection",
				Vectorizer:  "none",
			}

			assert.NoError(t, weaviate.CreateCollection(connectionID, class))
			assert.Equal(t, "Movies", received.Class)
			assert.Equal(t, "Movie collection", received.Description)
			assert.Equal(t, "none", received.Vectorizer)
		})

		t.Run("should surface server error message", func(t *testing.T) {
			weaviate := connectedWeaviate(t, connectionID, func(w http.ResponseWriter, r *http.Request) bool {
				if r.URL.Path == "/v1/schema" && r.Method == http.MethodPost {
					w.WriteHeader(http.StatusUnprocessableEntity)
					w.Write([]byte(`{"error":[{"message":"class name already exists"}]}`))
					return true
				}
				return false
			})

			err := weaviate.CreateCollection(connectionID, &weaviate_models.Class{Class: "Movies"})

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed creating collection Movies")
			assert.Contains(t, err.Error(), "class name already exists")
		})
	})

	t.Run("UpdateCollection", func(t *testing.T) {
		t.Run("should return error if connection doesn't exist", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			weaviate := New(mockStorage, Configuration{StatusUpdateInterval: time.Hour})

			err := weaviate.UpdateCollection(connectionID, &weaviate_models.Class{Class: "Foo"})

			assert.EqualError(t, err, "connection doesn't exist 1")
		})

		t.Run("should return error if class is nil or unnamed", func(t *testing.T) {
			weaviate := connectedWeaviate(t, connectionID, nil)

			assert.EqualError(t,
				weaviate.UpdateCollection(connectionID, nil),
				"collection name is required",
			)
		})

		t.Run("should PUT class definition to /v1/schema/{class}", func(t *testing.T) {
			var received weaviate_models.Class
			weaviate := connectedWeaviate(t, connectionID, func(w http.ResponseWriter, r *http.Request) bool {
				if r.URL.Path == "/v1/schema/Movies" && r.Method == http.MethodPut {
					body, _ := io.ReadAll(r.Body)
					assert.NoError(t, json.Unmarshal(body, &received))
					w.WriteHeader(http.StatusOK)
					w.Write(body)
					return true
				}
				return false
			})

			class := &weaviate_models.Class{Class: "Movies", Description: "Updated"}

			assert.NoError(t, weaviate.UpdateCollection(connectionID, class))
			assert.Equal(t, "Movies", received.Class)
			assert.Equal(t, "Updated", received.Description)
		})

		t.Run("should surface server error message", func(t *testing.T) {
			weaviate := connectedWeaviate(t, connectionID, func(w http.ResponseWriter, r *http.Request) bool {
				if r.URL.Path == "/v1/schema/Movies" && r.Method == http.MethodPut {
					w.WriteHeader(http.StatusUnprocessableEntity)
					w.Write([]byte(`{"error":[{"message":"vectorizer is immutable"}]}`))
					return true
				}
				return false
			})

			err := weaviate.UpdateCollection(connectionID, &weaviate_models.Class{Class: "Movies"})

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed updating collection Movies")
			assert.Contains(t, err.Error(), "vectorizer is immutable")
		})
	})

	t.Run("AddProperty", func(t *testing.T) {
		t.Run("should return error if connection doesn't exist", func(t *testing.T) {
			mockStorage := NewMockStorage(t)
			weaviate := New(mockStorage, Configuration{StatusUpdateInterval: time.Hour})

			err := weaviate.AddProperty(connectionID, "Movies", &weaviate_models.Property{Name: "title"})

			assert.EqualError(t, err, "connection doesn't exist 1")
		})

		t.Run("should return error if property is nil or unnamed", func(t *testing.T) {
			weaviate := connectedWeaviate(t, connectionID, nil)

			assert.EqualError(t,
				weaviate.AddProperty(connectionID, "Movies", nil),
				"property name is required",
			)
			assert.EqualError(t,
				weaviate.AddProperty(connectionID, "Movies", &weaviate_models.Property{}),
				"property name is required",
			)
		})

		t.Run("should POST property to /v1/schema/{class}/properties", func(t *testing.T) {
			var received weaviate_models.Property
			weaviate := connectedWeaviate(t, connectionID, func(w http.ResponseWriter, r *http.Request) bool {
				if r.URL.Path == "/v1/schema/Movies/properties" && r.Method == http.MethodPost {
					body, _ := io.ReadAll(r.Body)
					assert.NoError(t, json.Unmarshal(body, &received))
					w.WriteHeader(http.StatusOK)
					w.Write(body)
					return true
				}
				return false
			})

			prop := &weaviate_models.Property{Name: "title", DataType: []string{"text"}}

			assert.NoError(t, weaviate.AddProperty(connectionID, "Movies", prop))
			assert.Equal(t, "title", received.Name)
			assert.Equal(t, []string{"text"}, received.DataType)
		})

		t.Run("should surface server error message", func(t *testing.T) {
			weaviate := connectedWeaviate(t, connectionID, func(w http.ResponseWriter, r *http.Request) bool {
				if r.URL.Path == "/v1/schema/Movies/properties" && r.Method == http.MethodPost {
					w.WriteHeader(http.StatusUnprocessableEntity)
					w.Write([]byte(`{"error":[{"message":"property already exists"}]}`))
					return true
				}
				return false
			})

			err := weaviate.AddProperty(connectionID, "Movies", &weaviate_models.Property{Name: "title"})

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "failed adding property title to Movies")
			assert.Contains(t, err.Error(), "property already exists")
		})
	})
}

// connectedWeaviate builds a Weaviate with a real SDK client pointed at a mock
// HTTP server. The handler is invoked for every request; if it returns false
// the test fails. /v1/meta is always served to satisfy Connect().
func connectedWeaviate(
	t *testing.T,
	connectionID int64,
	handler func(http.ResponseWriter, *http.Request) bool,
) *Weaviate {
	t.Helper()

	mockServer := http_util.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/meta" && r.Method == http.MethodGet {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"version":"1.37.0"}`))
			return
		}
		if handler != nil && handler(w, r) {
			return
		}
		t.Logf("unexpected request to %s with method %s", r.URL.Path, r.Method)
		t.Fail()
	}))
	t.Cleanup(mockServer.Close)

	mockStorage := NewMockStorage(t)
	mockStorage.EXPECT().GetConnection(connectionID, true).Return(&models.Connection{
		URI: mockServer.URL,
	}, nil)

	weaviate := New(mockStorage, Configuration{StatusUpdateInterval: time.Hour})
	if err := weaviate.Connect(connectionID); err != nil {
		t.Fatalf("failed to connect: %v", err)
	}

	return weaviate
}
