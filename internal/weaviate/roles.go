package weaviate

import (
	"context"
	"fmt"
	"time"
)

func (w *Weaviate) ListRoles(connectionID int64) ([]Role, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rbacRoles, err := c.w.Roles().AllGetter().Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed listing roles: %w", err)
	}

	roles := make([]Role, 0, len(rbacRoles)) // Exclude non assignable read-only role
	for _, rbacRole := range rbacRoles {
		if rbacRole.Name == "read-only" {
			continue
		}
		roles = append(roles, convertRbacRoleToRole(rbacRole))
	}

	return roles, nil
}
