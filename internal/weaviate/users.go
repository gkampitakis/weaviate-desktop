package weaviate

import (
	"context"
	"fmt"
	"time"
)

func (w *Weaviate) UsersEnabled(connectionID int64) (bool, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return false, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := c.w.Users().DB().Lister().Do(ctx)
	if err != nil {
		return false, fmt.Errorf("failed checking if users are enabled: %w", err)
	}

	return true, nil
}
