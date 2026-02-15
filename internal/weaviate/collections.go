package weaviate

import (
	"context"
	"fmt"
	"time"

	"github.com/weaviate/weaviate/entities/models"
)

func (w *Weaviate) GetCollection(connectionID int64, collection string) (*models.Class, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	col, err := c.w.Schema().ClassGetter().WithClassName(collection).Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed retrieving collection %s: %w", collection, err)
	}

	return col, nil
}

func (w *Weaviate) DeleteCollection(connectionID int64, collection string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := c.w.Schema().ClassDeleter().WithClassName(collection).Do(ctx); err != nil {
		return fmt.Errorf("failed deleting collection: %w", err)
	}

	return nil
}
