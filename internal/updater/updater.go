package updater

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"weaviate-desktop/internal/http_util"

	"github.com/Masterminds/semver"
	wails_runtime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type Source interface {
	Download(progressCallback func(float64)) (string, error)
	NewVersionExists(*semver.Version) (*NewVersionExistsResponse, error)
}

var (
	// this is for testing
	osExecutable = os.Executable
	osDarwin     = "darwin"
	osLinux      = "linux"
)

type Updater struct {
	currentVersion *semver.Version
	httpClient     *http.Client
	appName        string
	fileName       string
	assetSource    Source
	runtimeCtx     context.Context
	shouldRestart  bool
}

func New(v *semver.Version, fileName, appName string) *Updater {
	httpClient := http_util.GetClient(15 * time.Minute)

	return &Updater{
		currentVersion: v,
		appName:        appName,
		fileName:       fileName,
		httpClient:     httpClient,
		assetSource:    NewGithubSource(httpClient, fileName, appName),
		shouldRestart:  false,
	}
}

// SetRuntimeContext sets the wails runtime context so we can emit events
// to the frontend
func (u *Updater) SetRuntimeContext(ctx context.Context) {
	u.runtimeCtx = ctx
}

func (u Updater) GetVersion() string {
	return u.currentVersion.Original()
}

// GetReleaseURL returns the URL to the release page on GitHub
// for the current version
func (u Updater) ReleaseByTagURL() string {
	return fmt.Sprintf(
		"https://github.com/gkampitakis/%s/releases/tag/%s",
		u.fileName,
		u.GetVersion(),
	)
}

// Run checks for updates, downloads the update if available, and applies it
// to the current executable. It returns an error if any step fails.
func (u *Updater) Run() error {
	if u.shouldRestart {
		slog.Debug("Update already applied, need to restart")

		return nil
	}

	resp, err := u.CheckForUpdates()
	if err != nil {
		return fmt.Errorf("failed to check for updates: %w", err)
	}
	if !resp.Exists {
		slog.Debug("No updates available", "version", u.currentVersion.Original())

		return nil
	}

	slog.Debug("Running update", "version", resp.LatestVersion)

	path, err := u.assetSource.Download(
		func(f float64) {
			slog.Debug("Download progress", "progress", f)
			wails_runtime.EventsEmit(u.runtimeCtx, "download-progress", f)
		},
	)
	if err != nil {
		slog.Error("Failed to download update", "error", err)

		return err
	}

	slog.Debug("Update downloaded", "path", path)

	if err := u.applyUpdate(path); err != nil {
		slog.Error("Failed to apply update", "error", err)
		return err
	}

	slog.Debug("Update applied", "path", path)
	u.shouldRestart = true

	return nil
}

func (u *Updater) Restart() error {
	if !u.shouldRestart {
		slog.Debug("No need to restart")

		return nil
	}

	exePath, err := u.executable()
	if err != nil {
		return err
	}

	wd, err := os.Getwd()
	if err != nil {
		return err
	}

	_, err = os.StartProcess(exePath, os.Args, &os.ProcAttr{
		Files: []*os.File{os.Stdin, os.Stdout, os.Stderr},
		Env:   os.Environ(),
		Dir:   wd,
	})
	if err != nil {
		return fmt.Errorf("failed to start new process: %w", err)
	}

	os.Exit(0)
	return nil
}

// applyUpdate applies the update to the current executable.
// It finds the current executable path, moves the downloaded file to the executable path as <name>.new,
// makes it executable, removes any .old, renames the current executable to <name>.old and
// renames <name>.new to the current executable. If rename fails, it renames the .old to the current executable and returns an error.
func (u *Updater) applyUpdate(path string) error {
	exePath, err := u.executable()
	if err != nil {
		return err
	}

	if runtime.GOOS == osDarwin {
		exePath = strings.TrimSuffix(exePath, fmt.Sprintf("/Contents/MacOS/%s", u.fileName))
	}

	// get directory and file of current executable
	updateDir := filepath.Dir(exePath)
	filename := filepath.Base(exePath)

	// create paths .<filename>.new and .<filename>.old for swapping the executables
	newPath := filepath.Join(updateDir, fmt.Sprintf(".%s.new", filename))
	oldPath := filepath.Join(updateDir, fmt.Sprintf(".%s.old", filename))
	downloadPath := filepath.Join(path, filename)

	// cleanup swapping files we have .new as well just in case
	defer func() {
		_ = os.RemoveAll(oldPath)
		_ = os.RemoveAll(newPath)
	}()

	// move the file that was downloaded to .<filename>.new
	if err := os.Rename(downloadPath, newPath); err != nil {
		return err
	}

	// make the binary executable
	chmodPath := newPath
	if runtime.GOOS == osDarwin {
		chmodPath = filepath.Join(newPath, fmt.Sprintf("/Contents/MacOS/%s", u.fileName))
	}
	if err := os.Chmod(chmodPath, 0o755); err != nil {
		return err
	}

	// do a cleanup of the old file just in case
	_ = os.RemoveAll(oldPath)
	// rename the current executable to .<filename>.old
	if err := os.Rename(exePath, oldPath); err != nil {
		return err
	}

	// rename the new executable to the current executable
	if err := os.Rename(newPath, exePath); err != nil {
		// if it fails we need to rename the old one back
		if err := os.Rename(oldPath, exePath); err != nil {
			return fmt.Errorf("failed rollback old executable: %w", err)
		}

		return err
	}

	return nil
}

func (u *Updater) executable() (string, error) {
	exe, err := osExecutable()
	if err != nil {
		return "", err
	}

	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}

	return exe, nil
}

type CheckForUpdatesResponse struct {
	Exists        bool
	LatestVersion string
	Size          string
	ReleaseTagURL string
}

// CheckForUpdates checks if a new version is available on the asset source
func (u *Updater) CheckForUpdates() (*CheckForUpdatesResponse, error) {
	slog.Debug("Checking for updates", "version", u.currentVersion.Original())

	resp, err := u.assetSource.NewVersionExists(u.currentVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to check for updates: %w", err)
	}

	slog.Debug(
		"Update check response",
		"exists",
		resp.exists,
		"version",
		resp.version.Original(),
		"size",
		resp.assetSize,
	)

	return &CheckForUpdatesResponse{
		Exists:        resp.exists,
		LatestVersion: resp.version.Original(),
		Size:          resp.assetSize,
		ReleaseTagURL: fmt.Sprintf(
			"https://github.com/gkampitakis/%s/releases/tag/%s",
			u.fileName,
			resp.version.Original(),
		),
	}, nil
}
