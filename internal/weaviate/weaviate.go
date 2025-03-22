package weaviate

import (
	"context"
	"fmt"
	"net/url"
	"time"
	"weaviate-gui/internal/models"

	"github.com/weaviate/weaviate-go-client/v5/weaviate"
	"github.com/weaviate/weaviate-go-client/v5/weaviate/auth"
)

type Weaviate struct {
	clients map[int64]*weaviate.Client
	storage Storage
}

type Storage interface {
	GetConnection(id int64) (*models.Connection, error)
}

func New(s Storage) *Weaviate {
	return &Weaviate{
		storage: s,
		clients: map[int64]*weaviate.Client{},
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

func (w *Weaviate) GetCollectionNames(id int64) ([]string, error) {
	client, exists := w.clients[id]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", id)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	s, err := client.Schema().Getter().Do(ctx)
	if err != nil {
		return nil, err
	}

	collectionNames := make([]string, len(s.Schema.Classes))
	for i, c := range s.Schema.Classes {
		collectionNames[i] = c.Class
	}

	return collectionNames, nil
}

func (w *Weaviate) Disconnect(id int64) error {
	_, exists := w.clients[id]
	if exists {
		return nil
	}

	delete(w.clients, id)
	return nil
}
