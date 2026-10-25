package weaviate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"weaviate-desktop/internal/http_util"
	"weaviate-desktop/internal/models"

	"github.com/weaviate/weaviate-go-client/v5/weaviate"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/auth"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/graphql"
	weaviate_grpc "github.com/weaviate/weaviate-go-client/v5/weaviate/grpc"
	weaviate_models "github.com/weaviate/weaviate/entities/models"
	"google.golang.org/grpc"
)

type WClient struct {
	w           *weaviate.Client
	healthy     bool
	grpcHealthy bool
	grpcConfig  weaviate_grpc.Config
	grpcConn    *grpc.ClientConn
	grpcClient  grpcAggregator
	grpcHeaders map[string]string
	version     string
	features    Features
}

type Weaviate struct {
	clients    map[int64]*WClient
	storage    Storage
	httpClient *http.Client
}

type WeaviateObject struct {
	ID                 string   `json:"id"`
	Class              string   `json:"class"`
	LastUpdateTimeUnix int64    `json:"lastUpdateTimeUnix,omitempty"`
	CreationTimeUnix   int64    `json:"creationTimeUnix,omitempty"`
	Tenant             string   `json:"tenant,omitempty"`
	Properties         any      `json:"properties,omitempty"`
	Score              *float64 `json:"score,omitempty"`
	Distance           *float64 `json:"distance,omitempty"`
	Certainty          *float64 `json:"certainty,omitempty"`
}

type Storage interface {
	GetConnection(id int64, decrypt bool) (*models.Connection, error)
}

type Configuration struct {
	StatusUpdateInterval time.Duration
}

func New(s Storage, c Configuration) (*Weaviate, func()) {
	w := &Weaviate{
		storage:    s,
		clients:    map[int64]*WClient{},
		httpClient: http_util.GetClient(30 * time.Second),
	}

	go w.updateClusterStatus(c.StatusUpdateInterval)

	return w, w.closeClients
}

func (w *Weaviate) closeClients() {
	for _, c := range w.clients {
		c.closeGrpc()
	}
}

func (c *WClient) closeGrpc() {
	if c.grpcConn == nil {
		return
	}

	closeGrpcConn(c.grpcConn)
	c.grpcConn = nil
	c.grpcClient = nil
	c.grpcHealthy = false
}

func (w *Weaviate) updateClusterStatus(d time.Duration) {
	ticker := time.NewTicker(d)
	var err error

	for range ticker.C {
		if len(w.clients) == 0 {
			continue
		}

		slog.Debug("running status updater", slog.Int("clientsConnected", len(w.clients)))

		for id, cl := range w.clients {
			cl.healthy, err = cl.w.Misc().LiveChecker().Do(context.Background())
			if err != nil {
				slog.Error(
					"failed querying status",
					slog.Int64("connectionID", id),
					slog.Any("error", err),
				)
			}
		}
	}
}

type TestConnectionInput struct {
	URI    string
	ApiKey *string
}

func (w Weaviate) TestConnection(i TestConnectionInput) error {
	c, err := w.getClientFromConnection(&models.Connection{
		URI:    i.URI,
		ApiKey: i.ApiKey,
	})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = c.w.Misc().MetaGetter().Do(ctx)

	return err
}

func (w *Weaviate) getClientFromConnection(c *models.Connection) (*WClient, error) {
	u, err := url.Parse(c.URI)
	if err != nil {
		return nil, fmt.Errorf("failed parsing connection URI: %w", err)
	}

	grpcConfig := resolveGrpcConfig(u, c.GrpcEndpoint)

	cfg := weaviate.Config{
		Host:       u.Host,
		Scheme:     u.Scheme,
		GrpcConfig: &grpcConfig,
	}
	if c.ApiKey != nil {
		cfg.AuthConfig = auth.ApiKey{Value: *c.ApiKey}
	}

	client, err := weaviate.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed creating client: %w", err)
	}

	return &WClient{
		healthy:     true,
		w:           client,
		grpcConfig:  grpcConfig,
		grpcHeaders: grpcHeaders(c.ApiKey),
	}, nil
}

func grpcHeaders(apiKey *string) map[string]string {
	if apiKey == nil || strings.TrimSpace(*apiKey) == "" {
		return nil
	}

	return map[string]string{"authorization": "Bearer " + *apiKey}
}

func (w *Weaviate) Connect(id int64) error {
	if _, exists := w.clients[id]; exists {
		return nil
	}

	connection, err := w.storage.GetConnection(id, true)
	if err != nil {
		return err
	}

	client, err := w.getClientFromConnection(connection)
	if err != nil {
		return err
	}

	// verify connection is healthy
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	meta, err := client.w.Misc().MetaGetter().Do(ctx)
	if err != nil {
		return fmt.Errorf("failed connecting to %s: %w", connection.URI, err)
	}

	client.version = meta.Version
	client.features = evaluateFeatures(meta.Version)

	w.attachGrpc(id, client)

	w.clients[id] = client
	return nil
}

func (w *Weaviate) GetTotalObjects(connectionID int64, collection, tenant string) (int64, error) {
	c, exists := w.clients[connectionID]
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

	get := c.w.GraphQL().Aggregate().
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

	return int64(
		result.Data["Aggregate"].(map[string]any)[collection].([]any)[0].(map[string]any)["meta"].(map[string]any)["count"].(float64),
	), nil
}

// GetObject fetches a single object by id from a collection (optionally
// scoped to a tenant). Used by the "Show similar" preview in the UI so the
// user can inspect the source object that the nearObject search was anchored
// to. Properties are surfaced as a generic map so the existing JSON tree
// renderer can display them without further marshalling.
func (w *Weaviate) GetObject(
	connectionID int64,
	collection, id, tenant string,
) (*WeaviateObject, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	getter := c.w.Data().ObjectsGetter().
		WithClassName(collection).
		WithID(id)
	if tenant != "" {
		getter = getter.WithTenant(tenant)
	}

	objs, err := getter.Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed retrieving object %s/%s: %w", collection, id, err)
	}
	if len(objs) == 0 {
		return nil, fmt.Errorf("object not found: %s/%s", collection, id)
	}

	obj := objs[0]
	return &WeaviateObject{
		ID:                 string(obj.ID),
		Class:              obj.Class,
		LastUpdateTimeUnix: obj.LastUpdateTimeUnix,
		CreationTimeUnix:   obj.CreationTimeUnix,
		Tenant:             obj.Tenant,
		Properties:         obj.Properties,
	}, nil
}

func (w *Weaviate) DeleteObject(connectionID int64, collection, id, tenant string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	deleteObject := c.w.Data().Deleter().WithClassName(collection).WithID(id)
	if tenant != "" {
		deleteObject = deleteObject.WithTenant(tenant)
	}

	return deleteObject.Do(ctx)
}

func (w *Weaviate) UpdateObject(
	connectionID int64,
	collection, id, tenant string,
	properties map[string]any,
) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	updater := c.w.Data().Updater().
		WithMerge().
		WithClassName(collection).
		WithID(id).
		WithProperties(properties)
	if tenant != "" {
		updater = updater.WithTenant(tenant)
	}

	return updater.Do(ctx)
}

type PaginatedObjectResponse struct {
	Objects       []WeaviateObject
	ExecutionTime string
	TotalResults  int
}

func (w *Weaviate) GetObjectsPaginated(
	connectionID int64,
	pageSize int,
	collection, cursor, tenant string,
) (*PaginatedObjectResponse, error) {
	connection, err := w.storage.GetConnection(connectionID, true)
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

		return nil, fmt.Errorf(
			"weaviate return non successful http status code %s for %s: %s",
			resp.Status,
			u.RawQuery,
			errMessage,
		)
	}

	var paginatedResult PaginatedObjectResponse
	if err := json.Unmarshal(data, &paginatedResult); err != nil {
		return nil, fmt.Errorf("failed un-marshalling response %w", err)
	}

	return &paginatedResult, nil
}

func (w *Weaviate) GetTenants(
	connectionID int64,
	collection string,
) ([]weaviate_models.Tenant, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return c.w.Schema().TenantsGetter().WithClassName(collection).Do(ctx)
}

func (w *Weaviate) NodesStatus(connectionID int64) (*weaviate_models.NodesStatusResponse, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := c.w.Cluster().NodesStatusGetter().WithOutput("verbose").Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed querying node status: %w", err)
	}

	return res, nil
}

func (w *Weaviate) GetModules(connectionID int64) (any, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := c.w.Misc().MetaGetter().Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed querying modules: %w", err)
	}

	return res.Modules, nil
}

func (w *Weaviate) ClusterStatus(connectionID int64) (bool, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return false, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	return c.healthy, nil
}

func (w *Weaviate) GetCollections(connectionID int64) ([]*weaviate_models.Class, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	s, err := c.w.Schema().Getter().Do(ctx)
	if err != nil {
		return nil, err
	}

	return s.Classes, nil
}

func (w *Weaviate) Disconnect(id int64) error {
	c, exists := w.clients[id]
	if !exists {
		return nil
	}

	c.closeGrpc()
	delete(w.clients, id)
	return nil
}
