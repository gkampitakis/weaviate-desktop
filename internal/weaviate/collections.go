package weaviate

import (
	"context"
	"fmt"
	"time"
)

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
