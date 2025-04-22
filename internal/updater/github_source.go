package updater

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/Masterminds/semver"
	"github.com/dustin/go-humanize"
	"github.com/tidwall/gjson"
	"golang.org/x/sync/errgroup"
)

var (
	macosFilename   = "%s.macos"
	windowsFilename = "%s.windows"
	linuxFilename   = "%s.linux"

	ghRemoteURL = "https://api.github.com/repos/gkampitakis/%s/releases/latest"

	//lint:ignore U1000 Ignore unused code
	ghOauthCertIssuer = "https://github.com/login/oauth" // this issuer is used when signing with cosign cli and github oidc
	ghTokenCertIssuer = "https://token.actions.githubusercontent.com"
	ghCertIdentity    = "https://github.com/gkampitakis/%s/.github/workflows/release.yml@refs/tags/"
)

type AssetVerifier interface {
	Verify(assetFilename, sigFilename, version string) error
}

type GithubPrivateSource struct {
	client        *http.Client
	ghToken       string
	appName       string
	fileName      string
	assetVerifier AssetVerifier
}

func getPlatform() string {
	switch runtime.GOOS {
	case "darwin":
		return macosFilename
	case "windows":
		return windowsFilename
	case "linux":
		return linuxFilename
	default:
		return ""
	}
}

func NewGithubPrivateSource(
	client *http.Client,
	fileName, appName, token string,
) *GithubPrivateSource {
	assetVerifier := NewSigStoreVerifier(
		ghTokenCertIssuer,
		fmt.Sprintf(ghCertIdentity, fileName),
	)

	return &GithubPrivateSource{
		appName:       appName,
		assetVerifier: assetVerifier,
		client:        client,
		fileName:      fileName,
		ghToken:       token,
	}
}

type downloadResponse struct {
	assetFilename string
	sigFilename   string
	version       string
}

func (g *GithubPrivateSource) downloadAssets(
	path string,
	progressCallback func(float64),
) (*downloadResponse, error) {
	info, err := g.getLatestReleaseInfo()
	if err != nil {
		return nil, fmt.Errorf("failed to get latest release info: %w", err)
	}

	assetFilename, err := g.getPlatformFilename()
	if err != nil {
		return nil, err
	}

	res := gjson.GetManyBytes(info,
		fmt.Sprintf(`assets.#(name=="%s").url`, assetFilename+".zip"),
		fmt.Sprintf(`assets.#(name=="%s").url`, assetFilename+".sig"),
		// tag_name is the version e.g. v1.0.0
		"tag_name",
	)

	for _, v := range res {
		if !v.Exists() {
			return nil, fmt.Errorf(
				"malformed github response, asset details not found %s",
				string(info),
			)
		}
	}

	assetDownloadURL := res[0].String()
	sigDownloadURL := res[1].String()
	releaseVersion := res[2].String()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	response := &downloadResponse{
		assetFilename: filepath.Join(path, assetFilename+".zip"),
		sigFilename:   filepath.Join(path, assetFilename+".sig"),
		version:       releaseVersion,
	}

	errg, ctx := errgroup.WithContext(ctx)

	// download the zip file with the binary
	errg.Go(func() error {
		slog.Debug("Downloading binary", "url", assetDownloadURL)

		req, err := http.NewRequestWithContext(ctx, "GET", assetDownloadURL, nil)
		if err != nil {
			return err
		}
		req.Header.Add("Authorization", fmt.Sprintf("token %s", g.ghToken))
		req.Header.Add("Accept", "application/octet-stream")

		resp, err := g.client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// consume the body to avoid resource leak
			_, _ = io.Copy(io.Discard, resp.Body)

			return fmt.Errorf("failed to download asset %s: %s", assetDownloadURL, resp.Status)
		}

		out, err := os.Create(response.assetFilename)
		if err != nil {
			return err
		}
		defer out.Close()

		pr := NewProgressReader(resp.Body, resp.ContentLength, progressCallback)
		_, err = io.Copy(out, pr)
		return err
	})

	// download the signature file
	errg.Go(func() error {
		slog.Debug("Downloading signature", "url", sigDownloadURL)

		req, err := http.NewRequestWithContext(ctx, "GET", sigDownloadURL, nil)
		if err != nil {
			return err
		}
		req.Header.Add("Authorization", fmt.Sprintf("token %s", g.ghToken))
		req.Header.Add("Accept", "application/octet-stream")

		resp, err := g.client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// consume the body to avoid resource leak
			_, _ = io.Copy(io.Discard, resp.Body)

			return fmt.Errorf("failed to download asset %s: %s", sigDownloadURL, resp.Status)
		}

		out, err := os.Create(response.sigFilename)
		if err != nil {
			return err
		}
		defer out.Close()

		_, err = io.Copy(out, resp.Body)
		return err
	})

	if err = errg.Wait(); err != nil {
		return nil, err
	}

	return response, nil
}

func (g *GithubPrivateSource) unzip(path string) error {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer zr.Close()

	slog.Info("Unzipping", "files", len(zr.File))

	for _, f := range zr.File {
		path := filepath.Join(filepath.Dir(path), f.Name)

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(path, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		out, err := os.Create(path)
		if err != nil {
			rc.Close()
			return err
		}

		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

func (g *GithubPrivateSource) Download(progressCallback func(float64)) (string, error) {
	downloadPath := filepath.Join(os.TempDir(), g.fileName)

	// cleanup old files
	_ = os.RemoveAll(downloadPath)
	if err := os.MkdirAll(downloadPath, 0o755); err != nil {
		return "", fmt.Errorf("failed to create temp dir: %w", err)
	}

	// download the assets, app binary and signature
	res, err := g.downloadAssets(downloadPath, progressCallback)
	if err != nil {
		return "", err
	}
	defer func() {
		// clear zip file and the signature no longer needed
		_ = os.Remove(res.assetFilename)
		_ = os.Remove(res.sigFilename)
	}()

	// verify the signature
	if err := g.assetVerifier.Verify(
		res.assetFilename,
		res.sigFilename,
		res.version,
	); err != nil {
		return "", fmt.Errorf("failed to verify downloaded asset %s: %w", res.version, err)
	}

	// unzip the asset
	if err := g.unzip(res.assetFilename); err != nil {
		return "", fmt.Errorf("failed to unzip: %w", err)
	}

	return downloadPath, nil
}

type NewVersionExistsResponse struct {
	version   *semver.Version
	exists    bool
	assetSize string
}

func (g *GithubPrivateSource) NewVersionExists(
	current *semver.Version,
) (*NewVersionExistsResponse, error) {
	info, err := g.getLatestReleaseInfo()
	if err != nil {
		return nil, fmt.Errorf("failed to get latest release info: %w", err)
	}

	assetFilename, err := g.getPlatformFilename()
	if err != nil {
		return nil, err
	}

	res := gjson.GetManyBytes(info,
		// tag_name is the version e.g. v1.0.0
		"tag_name",
		fmt.Sprintf(`assets.#(name=="%s").size`, assetFilename+".zip"),
	)

	for _, v := range res {
		if !v.Exists() {
			return nil, fmt.Errorf("malformed response, asset details not found %s", string(info))
		}
	}

	strVersion := res[0].String()
	assetSize := humanize.Bytes(res[1].Uint())

	version, err := semver.NewVersion(strVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to parse version: %w %s", err, strVersion)
	}

	return &NewVersionExistsResponse{
		exists:    version.GreaterThan(current),
		version:   version,
		assetSize: assetSize,
	}, nil
}

func (g *GithubPrivateSource) getLatestReleaseInfo() ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf(ghRemoteURL, g.fileName), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", fmt.Sprintf("token %s", g.ghToken))

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unsuccessful request %s %s", resp.Status, string(data))
	}

	return data, nil
}

// returns the asset name for the current platform: e.g. weaviate-gui.macos.%s
func (g *GithubPrivateSource) getPlatformFilename() (string, error) {
	platform := getPlatform()
	if platform == "" {
		return "", fmt.Errorf("unsupported platform %s", runtime.GOOS)
	}
	return fmt.Sprintf(platform, g.fileName), nil
}
