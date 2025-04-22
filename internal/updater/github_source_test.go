package updater

import (
	"archive/zip"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"weaviate-gui/internal/http_util"

	"github.com/Masterminds/semver"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestGithubSource(t *testing.T) {
	t.Run("NewVersionExists", func(t *testing.T) {
		t.Run("should return true if version exists", func(t *testing.T) {
			// Create a mock server
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/repos/test-app/releases/latest", r.URL.Path)
					assert.Equal(t, "token test-token", r.Header.Get("Authorization"))

					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`{
            "tag_name": "v1.2.3",
            "assets": [
                {"name": "test-app.macos.zip", "size": 123456},
                {"name": "test-app.windows.zip", "size": 123456},
                {"name": "test-app.linux.zip", "size": 123456}
            ]
        }`))
				}),
			)
			defer mockServer.Close()

			// Override the ghRemoteURL variable
			ghRemoteURL = mockServer.URL + "/repos/%s/releases/latest"

			// Create a GithubPrivateSource instance
			client := &http.Client{}
			source := NewGithubPrivateSource(client, "test-app", "Test App", "test-token")

			// Call NewVersionExists
			currentVersion := semver.MustParse("v1.0.0")
			resp, err := source.NewVersionExists(currentVersion)

			// Assertions
			assert.NoError(t, err)
			assert.True(t, resp.exists)
			assert.Equal(t, "v1.2.3", resp.version.Original())
			assert.Equal(t, "124 kB", resp.assetSize)
		})

		t.Run("should return false if version does not exist", func(t *testing.T) {
			// Create a mock server
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/repos/test-app/releases/latest", r.URL.Path)
					assert.Equal(t, "token test-token", r.Header.Get("Authorization"))

					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`{
					"tag_name": "v0.9.0",
					"assets": [
						{"name": "test-app.macos.zip", "size": 800001},
						{"name": "test-app.windows.zip", "size": 800001},
						{"name": "test-app.linux.zip", "size": 800001}
					]
			}`))
				}),
			)
			defer mockServer.Close()

			// Override the ghRemoteURL variable
			ghRemoteURL = mockServer.URL + "/repos/%s/releases/latest"

			// Create a GithubPrivateSource instance
			client := &http.Client{}
			source := NewGithubPrivateSource(client, "test-app", "Test App", "test-token")

			// Call NewVersionExists
			currentVersion := semver.MustParse("v1.0.0")
			resp, err := source.NewVersionExists(currentVersion)

			// Assertions
			assert.NoError(t, err)
			assert.False(t, resp.exists)
			assert.Equal(t, "v0.9.0", resp.version.Original())
			assert.Equal(t, "800 kB", resp.assetSize)
		})

		t.Run("should return error if status code not OK", func(t *testing.T) {
			// Create a mock server
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/repos/test-app/releases/latest", r.URL.Path)
					assert.Equal(t, "token test-token", r.Header.Get("Authorization"))

					w.WriteHeader(http.StatusInternalServerError)
					w.Write([]byte(`{"message": "Internal Server Error"}`))
				}),
			)
			defer mockServer.Close()

			// Override the ghRemoteURL variable
			ghRemoteURL = mockServer.URL + "/repos/%s/releases/latest"

			// Create a GithubPrivateSource instance
			client := &http.Client{}
			source := NewGithubPrivateSource(client, "test-app", "Test App", "test-token")

			// Call NewVersionExists
			currentVersion := semver.MustParse("v1.0.0")
			resp, err := source.NewVersionExists(currentVersion)

			// Assertions
			assert.Error(t, err)
			assert.Nil(t, resp)
			assert.Equal(
				t,
				"failed to get latest release info: unsuccessful request 500 Internal Server Error {\"message\": \"Internal Server Error\"}",
				err.Error(),
			)
		})

		t.Run("should return error if malformed response", func(t *testing.T) {
			// Create a mock server
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/repos/test-app/releases/latest", r.URL.Path)
					assert.Equal(t, "token test-token", r.Header.Get("Authorization"))

					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`{"tag_name": "v1.2.3"}`))
				}),
			)
			defer mockServer.Close()

			// Override the ghRemoteURL variable
			ghRemoteURL = mockServer.URL + "/repos/%s/releases/latest"

			// Create a GithubPrivateSource instance
			client := &http.Client{}
			source := NewGithubPrivateSource(client, "test-app", "Test App", "test-token")

			// Call NewVersionExists
			currentVersion := semver.MustParse("v1.0.0")
			resp, err := source.NewVersionExists(currentVersion)

			// Assertions
			assert.Error(t, err)
			assert.Nil(t, resp)
			assert.Equal(
				t,
				"malformed response, asset details not found {\"tag_name\": \"v1.2.3\"}",
				err.Error(),
			)
		})

		t.Run("should return error if version parsing fails", func(t *testing.T) {
			// Create a mock server
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/repos/test-app/releases/latest", r.URL.Path)
					assert.Equal(t, "token test-token", r.Header.Get("Authorization"))

					w.WriteHeader(http.StatusOK)
					w.Write([]byte(`{
					"tag_name": "invalid-version",
					"assets": [
						{"name": "test-app.macos.zip", "size": 800001},
						{"name": "test-app.windows.zip", "size": 800001},
						{"name": "test-app.linux.zip", "size": 800001}
					]
			}`))
				}),
			)
			defer mockServer.Close()

			// Override the ghRemoteURL variable
			ghRemoteURL = mockServer.URL + "/repos/%s/releases/latest"

			// Create a GithubPrivateSource instance
			client := &http.Client{}
			source := NewGithubPrivateSource(client, "test-app", "Test App", "test-token")

			// Call NewVersionExists
			currentVersion := semver.MustParse("v1.0.0")
			resp, err := source.NewVersionExists(currentVersion)

			// Assertions
			assert.Error(t, err)
			assert.Nil(t, resp)
			assert.Equal(
				t,
				"failed to parse version: Invalid Semantic Version invalid-version",
				err.Error(),
			)
		})
	})

	t.Run("Download", func(t *testing.T) {
		t.Run("should download the file successfully", func(t *testing.T) {
			address := "127.0.0.1:8081"

			// Create a mock server
			mockServer := http_util.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.URL.Path == "/repos/test-app/releases/latest" {
						assert.Equal(t, "token test-token", r.Header.Get("Authorization"))

						w.WriteHeader(http.StatusOK)
						w.Write(fmt.Appendf(nil, `{
							"tag_name": "v1.2.3",
							"assets": [
								{"name": "test-app.macos.zip", "url": "http://%s/test-app.macos.zip"},
								{"name": "test-app.macos.sig", "url": "http://%s/test-app.macos.sig"},
								{"name": "test-app.windows.zip", "url": "http://%s/test-app.windows.zip"},
								{"name": "test-app.windows.sig", "url": "http://%s/test-app.windows.sig"},
								{"name": "test-app.linux.zip", "url": "http://%s/test-app.linux.zip"},
								{"name": "test-app.linux.sig", "url": "http://%s/test-app.linux.sig"}
							]
						}`, address, address, address, address, address, address))
						return
					}

					if strings.HasSuffix(r.URL.Path, ".zip") {
						w.WriteHeader(http.StatusOK)

						// Create a simple zip file in memory
						zipWriter := zip.NewWriter(w)
						defer zipWriter.Close()

						// Add a file to the zip
						fileWriter, err := zipWriter.Create("mock-file.txt")
						if err != nil {
							t.Fatalf("failed to create zip file entry: %v", err)
						}

						_, err = fileWriter.Write([]byte("This is a mock file content"))
						if err != nil {
							t.Fatalf("failed to write to zip file entry: %v", err)
						}

						return
					}

					if strings.HasSuffix(r.URL.Path, ".sig") {
						w.WriteHeader(http.StatusOK)
						w.Write([]byte("mock signature content"))

						return
					}

					t.Error("unexpected request to " + r.URL.Path)
				}),
				http_util.Options{
					Address: address,
				},
			)
			defer mockServer.Close()

			// Override the ghRemoteURL variable
			ghRemoteURL = mockServer.URL + "/repos/%s/releases/latest"

			v := NewMockAssetVerifier(t)

			v.EXPECT().Verify(
				mock.MatchedBy(func(v any) bool {
					return strings.HasSuffix(
						v.(string),
						filepath.Clean(
							fmt.Sprintf("/test-app/%s.zip", fmt.Sprintf(getPlatform(), "test-app")),
						),
					)
				}),
				mock.MatchedBy(func(v any) bool {
					return strings.HasSuffix(
						v.(string),
						filepath.Clean(
							fmt.Sprintf("/test-app/%s.sig", fmt.Sprintf(getPlatform(), "test-app")),
						),
					)
				}),
				"v1.2.3",
			).Once().Return(nil)

			// Create a GithubPrivateSource instance
			client := &http.Client{}
			source := &GithubPrivateSource{
				client:        client,
				ghToken:       "test-token",
				appName:       "Test App",
				fileName:      "test-app",
				assetVerifier: v,
			}

			// Call Download
			progressCallback := func(progress float64) {}
			downloadPath, err := source.Download(progressCallback)

			// Assertions
			assert.NoError(t, err)
			assert.Contains(t, downloadPath, "test-app")

			// check file has been unzipped to the download path
			data, err := os.ReadFile(filepath.Join(downloadPath, "mock-file.txt"))
			assert.NoError(t, err)
			assert.Equal(t, "This is a mock file content", string(data))

			v.AssertExpectations(t)
		})
	})
}
