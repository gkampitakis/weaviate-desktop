package weaviate

import (
	"context"
	"fmt"
	"time"

	"github.com/weaviate/weaviate-go-client/v5/weaviate/rbac"
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
		roles = append(roles, convertWeaviateRbacRoleToRole(rbacRole))
	}

	return roles, nil
}

func (w *Weaviate) CreateRole(connectionID int64, role Role) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := c.w.Roles().Creator().WithRole(convertRoleToWeaviateRbacRole(role)).Do(ctx); err != nil {
		return fmt.Errorf("failed creating role: %w", err)
	}

	return nil
}

func (w *Weaviate) DeleteRole(connectionID int64, roleName string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := c.w.Roles().Deleter().WithName(roleName).Do(ctx); err != nil {
		return fmt.Errorf("failed deleting role: %w", err)
	}

	return nil
}

func (w *Weaviate) AddRolePermissions(connectionID int64, roleName string, permissions Role) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rbacRole := convertRoleToWeaviateRbacRole(permissions)
	perms := extractPermissions(rbacRole)

	if len(perms) == 0 {
		return nil
	}

	if err := c.w.Roles().PermissionAdder().WithRole(roleName).WithPermissions(perms...).Do(ctx); err != nil {
		return fmt.Errorf("failed adding permissions to role: %w", err)
	}

	return nil
}

func (w *Weaviate) RemoveRolePermissions(
	connectionID int64,
	roleName string,
	permissions Role,
) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rbacRole := convertRoleToWeaviateRbacRole(permissions)
	perms := extractPermissions(rbacRole)

	if len(perms) == 0 {
		return nil
	}

	if err := c.w.Roles().PermissionRemover().WithRole(roleName).WithPermissions(perms...).Do(ctx); err != nil {
		return fmt.Errorf("failed removing permissions from role: %w", err)
	}

	return nil
}

// extractPermissions extracts all permissions from a role into a slice of Permission interfaces
func extractPermissions(role rbac.Role) []rbac.Permission {
	var perms []rbac.Permission

	for _, p := range role.Backups {
		perms = append(perms, p)
	}
	for _, p := range role.Cluster {
		perms = append(perms, p)
	}
	for _, p := range role.Collections {
		perms = append(perms, p)
	}
	for _, p := range role.Data {
		perms = append(perms, p)
	}
	for _, p := range role.Nodes {
		perms = append(perms, p)
	}
	for _, p := range role.Roles {
		perms = append(perms, p)
	}
	for _, p := range role.Replicate {
		perms = append(perms, p)
	}
	for _, p := range role.Alias {
		perms = append(perms, p)
	}
	for _, p := range role.Tenants {
		perms = append(perms, p)
	}
	for _, p := range role.Users {
		perms = append(perms, p)
	}
	for _, p := range role.Groups {
		perms = append(perms, p)
	}

	return perms
}
