package weaviate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"weaviate-gui/internal/models"

	"github.com/weaviate/weaviate-go-client/v5/weaviate"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/auth"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	weaviate_models "github.com/weaviate/weaviate/entities/models"
)

type Weaviate struct {
	clients    map[int64]*weaviate.Client
	storage    Storage
	httpClient *http.Client
}

type Storage interface {
	GetConnection(id int64) (*models.Connection, error)
}

func customHttpClient() *http.Client {
	cl := http.DefaultClient
	tr := http.DefaultTransport.(*http.Transport)
	cl.Transport = tr

	tr.MaxIdleConnsPerHost = 10
	tr.MaxIdleConns = 100
	cl.Timeout = 10 * time.Second

	return cl
}

func New(s Storage) *Weaviate {
	return &Weaviate{
		storage:    s,
		clients:    map[int64]*weaviate.Client{},
		httpClient: customHttpClient(),
	}
}

type TestConnectionInput struct {
	URI    string
	ApiKey *string
}

func (w Weaviate) TestConnection(i TestConnectionInput) error {
	client, err := w.getClientFromConnection(&models.Connection{
		URI:    i.URI,
		ApiKey: i.ApiKey,
	})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = client.Misc().ReadyChecker().Do(ctx)
	return err
}

func (w *Weaviate) getClientFromConnection(c *models.Connection) (*weaviate.Client, error) {
	u, err := url.Parse(c.URI)
	if err != nil {
		return nil, fmt.Errorf("failed parsing connection URI: %w", err)
	}

	cfg := weaviate.Config{
		Host:   u.Host,
		Scheme: u.Scheme,
	}
	if c.ApiKey != nil {
		cfg.AuthConfig = auth.ApiKey{Value: *c.ApiKey}
	}

	client, err := weaviate.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed creating client: %w", err)
	}

	return client, nil
}

func (w *Weaviate) Connect(id int64) error {
	if _, exists := w.clients[id]; exists {
		return nil
	}

	connection, err := w.storage.GetConnection(id)
	if err != nil {
		return err
	}

	w.clients[id], err = w.getClientFromConnection(connection)
	if err != nil {
		return err
	}

	return nil
}

// NOTE: better error handling
func (w *Weaviate) GetTotalObjects(connectionID int64, collection, tenant string) (int64, error) {
	client, exists := w.clients[connectionID]
	if !exists {
		return -1, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	meta := graphql.Field{
		Name: "meta", Fields: []graphql.Field{
			{Name: "count"},
		},
	}

	get := client.GraphQL().Aggregate().
		WithClassName(collection).
		WithFields(meta)

	if tenant != "" {
		get = get.WithTenant(tenant)
	}

	result, err := get.Do(ctx)
	if err != nil {
		return -1, fmt.Errorf("failed aggregating total objects for %s: %w", collection, err)
	}
	if len(result.Errors) != 0 {
		err := strings.Builder{}

		for _, e := range result.Errors {
			err.WriteString(e.Message)
			err.WriteString(",")
		}

		return -1, errors.New(err.String())
	}

	return int64(result.Data["Aggregate"].(map[string]any)[collection].([]any)[0].(map[string]any)["meta"].(map[string]any)["count"].(float64)), nil
}

type PaginatedObjectResponse struct {
	Objects      []weaviate_models.Object
	TotalResults int
}

func (w *Weaviate) GetObjectsPaginated(connectionID int64, pageSize int, collection, cursor, tenant string) (*PaginatedObjectResponse, error) {
	connection, err := w.storage.GetConnection(connectionID)
	if err != nil {
		return nil, fmt.Errorf("failed retrieving connection %d: %w", connectionID, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	u, err := url.Parse(fmt.Sprintf("%s/v1/objects", connection.URI))
	if err != nil {
		return nil, fmt.Errorf("failed parsing connection URI %s: %w", connection.URI, err)
	}
	q := u.Query()
	q.Set("class", collection)
	q.Set("limit", strconv.Itoa(pageSize))
	q.Set("after", cursor)
	if tenant != "" {
		q.Set("tenant", tenant)
	}
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed creating paginated request: %w", err)
	}
	if connection.ApiKey != nil {
		req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", *connection.ApiKey))
	}

	resp, err := w.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed on paginated objects request: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed reading response body: %w", err)
	}

	if resp.StatusCode > 299 || resp.StatusCode < 200 {
		var errResponse struct {
			Error []struct{ Message string }
		}
		if err := json.Unmarshal(data, &errResponse); err != nil {
			return nil, fmt.Errorf("failed un-marshalling error response %w", err)
		}

		errMessage := ""
		if len(errResponse.Error) > 0 {
			errMessage = errResponse.Error[0].Message
		}

		return nil, fmt.Errorf("weaviate return non successful http status code %s for %s: %s", resp.Status, u.String(), errMessage)
	}

	var paginatedResult PaginatedObjectResponse
	if err := json.Unmarshal(data, &paginatedResult); err != nil {
		return nil, fmt.Errorf("failed un-marshalling response %w", err)
	}

	return &paginatedResult, nil
}

func (w *Weaviate) GetTenants(connectionID int64, collection string) ([]weaviate_models.Tenant, error) {
	client, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return client.Schema().TenantsGetter().WithClassName(collection).Do(ctx)
}

func (w *Weaviate) GetCollections(connectionID int64) ([]*weaviate_models.Class, error) {
	client, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	s, err := client.Schema().Getter().Do(ctx)
	if err != nil {
		return nil, err
	}

	return s.Schema.Classes, nil
}

func (w *Weaviate) Disconnect(id int64) error {
	_, exists := w.clients[id]
	if exists {
		return nil
	}

	delete(w.clients, id)
	return nil
}
