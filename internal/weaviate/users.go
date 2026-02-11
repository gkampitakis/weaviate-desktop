package weaviate

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"
)

func (w *Weaviate) UsersEnabled(connectionID int64) (bool, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return false, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := c.w.Users().DB().Getter().WithUserID("check-user").Do(ctx)
	if err != nil {
		// we are able to look the user but doesn't exist meaning users are enabled
		if strings.Contains(err.Error(), "404") {
			return true, nil
		}
		return false, fmt.Errorf("failed checking if users are enabled: %w", err)
	}

	return true, nil
}

type UserInfo struct {
	Active             bool   `json:"active"`
	CreatedAt          string `json:"createdAt"`
	UserType           string `json:"userType"`
	UserID             string `json:"userID"`
	Roles              []Role `json:"roles"`
	ApiKeyFirstLetters string `json:"apiKeyFirstLetters"`
	LastUsedAt         string `json:"lastUsedAt"`
}

func (w *Weaviate) ListUsers(connectionID int64) ([]UserInfo, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	users, err := c.w.Users().DB().Lister().WithLastUsedTime().Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed listing users: %w", err)
	}

	u := make([]UserInfo, len(users))
	for i, user := range users {
		u[i] = UserInfo{
			Active:             user.Active,
			CreatedAt:          user.CreatedAt.Format(time.RFC3339),
			UserType:           string(user.UserType),
			UserID:             user.UserID,
			Roles:              make([]Role, 0, len(user.Roles)),
			ApiKeyFirstLetters: user.ApiKeyFirstLetters,
		}
		if !user.LastUsedAt.IsZero() {
			u[i].LastUsedAt = user.LastUsedAt.Format(time.RFC3339)
		}

		for _, role := range user.Roles {
			u[i].Roles = append(u[i].Roles, Role{
				Name: role.Name,
			})
		}
	}

	slices.SortFunc(u, func(a, b UserInfo) int {
		if a.CreatedAt < b.CreatedAt {
			return -1
		}
		if a.CreatedAt > b.CreatedAt {
			return 1
		}
		return 0
	})

	return u, nil
}

func (w *Weaviate) DeleteUser(connectionID int64, userID string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	deleted, err := c.w.Users().DB().Deleter().WithUserID(userID).Do(ctx)
	if err != nil {
		return fmt.Errorf("failed deleting user: %w", err)
	}

	if !deleted {
		return fmt.Errorf("user with ID %s not found", userID)
	}

	return nil
}

func (w *Weaviate) CreateUser(connectionID int64, userID string) (string, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return "", fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	apiKey, err := c.w.Users().DB().Creator().WithUserID(userID).Do(ctx)
	if err != nil {
		return "", fmt.Errorf("failed creating user: %w", err)
	}

	return apiKey, nil
}

func (w *Weaviate) AssignRolesToUser(connectionID int64, userID string, roleNames []string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := c.w.Users().DB().RolesAssigner().WithUserID(userID).WithRoles(roleNames...).Do(ctx); err != nil {
		return fmt.Errorf("failed assigning roles to user: %w", err)
	}

	return nil
}

func (w *Weaviate) RevokeRolesFromUser(
	connectionID int64,
	userID string,
	roleNames []string,
) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := c.w.Users().DB().RolesRevoker().WithUserID(userID).WithRoles(roleNames...).Do(ctx); err != nil {
		return fmt.Errorf("failed revoking roles from user: %w", err)
	}

	return nil
}

func (w *Weaviate) RotateUserApiKey(connectionID int64, userID string) (string, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return "", fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	apiKey, err := c.w.Users().DB().KeyRotator().WithUserID(userID).Do(ctx)
	if err != nil {
		return "", fmt.Errorf("failed rotating user API key: %w", err)
	}

	return apiKey, nil
}

func (w *Weaviate) DeactivateApiKey(connectionID int64, userID string, revokeKey bool) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	found, err := c.w.Users().DB().Deactivator().WithRevokeKey(revokeKey).WithUserID(userID).Do(ctx)
	if err != nil {
		return fmt.Errorf("failed deactivating user API key: %w", err)
	}
	if !found {
		return fmt.Errorf("user with ID %s not found", userID)
	}

	return nil
}

func (w *Weaviate) ActivateApiKey(connectionID int64, userID string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	found, err := c.w.Users().DB().Activator().WithUserID(userID).Do(ctx)
	if err != nil {
		return fmt.Errorf("failed activating user API key: %w", err)
	}
	if !found {
		return fmt.Errorf("user with ID %s not found", userID)
	}

	return nil
}
