package weaviate

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/Masterminds/semver"
)

type FeatureKey string

const (
	FeatureIncrementalBackup FeatureKey = "incrementalBackup"
)

var featureMinVersions = map[FeatureKey]*semver.Version{
	FeatureIncrementalBackup: semver.MustParse("1.37.0"),
}

type Features map[FeatureKey]bool

func evaluateFeatures(version string) Features {
	out := make(Features, len(featureMinVersions))
	for key := range featureMinVersions {
		out[key] = false
	}

	v, err := parseServerVersion(version)
	if err != nil {
		slog.Warn(
			"failed parsing server version, all gated features disabled",
			slog.String("version", version),
			slog.Any("error", err),
		)
		return out
	}

	for key, min := range featureMinVersions {
		out[key] = !v.LessThan(min)
	}

	return out
}

// parseServerVersion accepts Weaviate version strings like "1.37.0", "1.37.0-rc.0",
// or "v1.37.0" and normalises them so semver.NewVersion succeeds.
func parseServerVersion(version string) (*semver.Version, error) {
	v := strings.TrimSpace(version)
	v = strings.TrimPrefix(v, "v")
	if v == "" {
		return nil, fmt.Errorf("empty version")
	}
	return semver.NewVersion(v)
}

func (w *Weaviate) GetFeatures(connectionID int64) (Features, error) {
	c, exists := w.clients[connectionID]
	if !exists {
		return nil, fmt.Errorf("connection doesn't exist %d", connectionID)
	}

	return c.features, nil
}
