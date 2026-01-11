package weaviate

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	weaviate_models "github.com/weaviate/weaviate/entities/models"
)

func (w *Weaviate) BackupModulesEnabled(connectionID int64) ([]string, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	m, err := c.w.Misc().MetaGetter().Do(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed checking if backups are enabled: %w", err)
	}

	modules, ok := m.Modules.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("failed parsing modules: %w", err)
	}

	backends := []string{}
	for module := range modules {
		if strings.Contains(module, "backup") {
			backends = append(backends, module)
		}
	}

	return backends, nil
}

// Taken from Weaviate models
type Backup struct {
	Classes     []string `json:"classes"`
	CompletedAt string   `json:"completedAt,omitempty"`
	ID          string   `json:"id"`
	Size        float64  `json:"size,omitempty"`
	StartedAt   string   `json:"startedAt"`
	// Status of backup process.
	// Enum: [STARTED TRANSFERRING TRANSFERRED SUCCESS FAILED CANCELED]
	Status string `json:"status"`
	// added for tracking which backend the backup belongs to
	Backend string `json:"backend"`
}

func (w *Weaviate) ListBackups(connectionID int64, backends []string) ([]Backup, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	// NOTE: we have seen longer times for backups listing
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	backups := []Backup{}

	for _, backend := range backends {
		data, err := c.w.Backup().Lister().WithBackend(backend).Do(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed listing backups for backend %s: %w", backend, err)
		}

		for _, b := range data {
			// Sort classes for consistency
			slices.Sort(b.Classes)

			// Handle possible empty CompletedAt
			completedAt := ""
			if !b.CompletedAt.IsZero() {
				completedAt = b.CompletedAt.String()
			}

			backups = append(backups, Backup{
				Classes:     b.Classes,
				CompletedAt: completedAt,
				ID:          b.ID,
				Size:        b.Size,
				StartedAt:   b.StartedAt.String(),
				Status:      b.Status,
				Backend:     backend,
			})
		}
	}

	return backups, nil
}

type CreateBackupInput struct {
	Backend          string   `json:"backend"`
	ID               string   `json:"id"`
	Include          []string `json:"include,omitempty"`
	Exclude          []string `json:"exclude,omitempty"`
	CompressionLevel string   `json:"compressionLevel,omitempty"`
	CPUPercentage    int      `json:"cpuPercentage,omitempty"`
}

func (w *Weaviate) CreateBackup(connectionID int64, input CreateBackupInput) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	creator := c.w.Backup().Creator().
		WithBackend(input.Backend).
		WithWaitForCompletion(false).
		WithBackupID(input.ID)

	if len(input.Include) > 0 {
		creator = creator.WithIncludeClassNames(input.Include...)
	}

	if len(input.Exclude) > 0 {
		creator = creator.WithExcludeClassNames(input.Exclude...)
	}

	// Build config if needed
	if input.CompressionLevel != "" || input.CPUPercentage > 0 {
		config := &weaviate_models.BackupConfig{}

		if input.CPUPercentage > 0 {
			cpuPercentage := int64(input.CPUPercentage)
			config.CPUPercentage = cpuPercentage
		}

		if input.CompressionLevel != "" {
			compressionLevel := input.CompressionLevel
			config.CompressionLevel = compressionLevel
		}

		creator = creator.WithConfig(config)
	}

	_, err := creator.Do(ctx)
	if err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	return nil
}

type GetCreationStatusInput struct {
	Backend string `json:"backend"`
	ID      string `json:"id"`
}

func (w *Weaviate) GetCreationStatus(
	connectionID int64,
	input GetCreationStatusInput,
) (string, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return "", fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	status, err := c.w.Backup().
		CreateStatusGetter().
		WithBackend(input.Backend).
		WithBackupID(input.ID).
		Do(ctx)
	if err != nil {
		return "", fmt.Errorf("failed getting backup creation status: %w", err)
	}

	return *status.Status, nil
}

func (w *Weaviate) CancelBackup(connectionID int64, backend, id string) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	fmt.Println(backend, id)

	if err := c.w.Backup().
		Canceler().
		WithBackend(backend).
		WithBackupID(id).
		Do(ctx); err != nil {
		return fmt.Errorf("failed cancelling backup: %w", err)
	}

	return nil
}

type RestoreBackupInput struct {
	Backend             string   `json:"backend"`
	ID                  string   `json:"id"`
	Include             []string `json:"include,omitempty"`
	Exclude             []string `json:"exclude,omitempty"`
	IncludeRBACAndUsers bool     `json:"includeRBACAndUsers,omitempty"`
	OverwriteAlias      bool     `json:"overwriteAlias,omitempty"`
	CPUPercentage       int      `json:"cpuPercentage,omitempty"`
}

func (w *Weaviate) RestoreBackup(connectionID int64, input RestoreBackupInput) error {
	c, exists := w.clients[connectionID]
	if !exists {
		return fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	restorer := c.w.Backup().
		Restorer().
		WithWaitForCompletion(false).
		WithBackend(input.Backend).
		WithBackupID(input.ID)

	if input.OverwriteAlias {
		restorer = restorer.WithOverwriteAlias(true)
	}

	if len(input.Include) > 0 {
		restorer = restorer.WithIncludeClassNames(input.Include...)
	}

	if len(input.Exclude) > 0 {
		restorer = restorer.WithExcludeClassNames(input.Exclude...)
	}

	// This needs to be before WithRbacAndUsers as it sets the config object as a whole and will override it
	if input.CPUPercentage > 0 {
		restorer.WithConfig(&weaviate_models.RestoreConfig{
			CPUPercentage: int64(input.CPUPercentage),
		})
	}

	if input.IncludeRBACAndUsers {
		restorer = restorer.WithRBACAndUsers()
	}

	if _, err := restorer.Do(ctx); err != nil {
		return fmt.Errorf("failed restoring backup: %w", err)
	}

	return nil
}

type StatusResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

func (w *Weaviate) GetRestoreStatus(
	connectionID int64,
	backend, id string,
) (StatusResponse, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return StatusResponse{}, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	status, err := c.w.Backup().
		RestoreStatusGetter().
		WithBackend(backend).
		WithBackupID(id).
		Do(ctx)
	if err != nil {
		return StatusResponse{}, fmt.Errorf("failed getting backup restore status: %w", err)
	}

	return StatusResponse{
		Status: *status.Status,
		Error:  status.Error,
	}, nil
}
