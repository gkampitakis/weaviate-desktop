package weaviate

import (
	"context"
	"fmt"
	"strings"
	"time"
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
	ID          string   `json:"id,omitempty"`
	Size        float64  `json:"size,omitempty"`
	StartedAt   string   `json:"startedAt,omitempty"`
	// Status of backup process.
	// Enum: [STARTED TRANSFERRING TRANSFERRED SUCCESS FAILED CANCELED]
	Status  string `json:"status,omitempty"`
	Backend string `json:"backend,omitempty"`
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
			backups = append(backups, Backup{
				Classes:     b.Classes,
				CompletedAt: b.CompletedAt.String(),
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
