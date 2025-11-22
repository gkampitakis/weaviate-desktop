package updater

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Masterminds/semver"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestUpdater(t *testing.T) {
	t.Run("ReleaseByTagURL", func(t *testing.T) {
		t.Run("should return the correct URL", func(t *testing.T) {
			tag := "v1.0.1"

			u := New(
				semver.MustParse(tag),
				"test-app",
				"Test App",
			)

			assert.Equal(
				t,
				"https://github.com/gkampitakis/test-app/releases/tag/v1.0.1",
				u.ReleaseByTagURL(),
			)
		})
	})

	t.Run("CheckForUpdate", func(t *testing.T) {
		t.Run("should return true if a new version exists", func(t *testing.T) {
			m := NewMockSource(t)

			currentVersion := semver.MustParse("v1.0.0")
			u := New(
				currentVersion,
				"test-app",
				"Test App",
			)
			// mock asset source
			u.assetSource = m

			v := semver.MustParse("v2.0.0")

			m.EXPECT().NewVersionExists(currentVersion).Return(
				&NewVersionExistsResponse{
					exists:    true,
					version:   v,
					assetSize: "124 kB",
				}, nil,
			)

			updateResponse, err := u.CheckForUpdates()

			assert.NoError(t, err)
			assert.True(t, updateResponse.Exists)
			assert.Equal(t, "v2.0.0", updateResponse.LatestVersion)
			assert.Equal(t, "124 kB", updateResponse.Size)

			m.AssertExpectations(t)
		})

		t.Run("should return false if no new version exists", func(t *testing.T) {
			m := NewMockSource(t)

			currentVersion := semver.MustParse("v2.0.0")
			u := New(
				currentVersion,
				"test-app",
				"Test App",
			)
			// mock asset source
			u.assetSource = m

			v := semver.MustParse("v2.0.0")

			m.EXPECT().NewVersionExists(currentVersion).Return(
				&NewVersionExistsResponse{
					exists:    false,
					version:   v,
					assetSize: "124 kB",
				}, nil,
			)

			updateResponse, err := u.CheckForUpdates()

			assert.NoError(t, err)
			assert.False(t, updateResponse.Exists)
			assert.Equal(t, "v2.0.0", updateResponse.LatestVersion)
			assert.Equal(t, "124 kB", updateResponse.Size)

			m.AssertExpectations(t)
		})
	})

	t.Run("Run", func(t *testing.T) {
		t.Run("should return early if no new version exists", func(t *testing.T) {
			m := NewMockSource(t)

			currentVersion := semver.MustParse("v2.0.0")
			u := New(
				currentVersion,
				"test-app",
				"Test App",
			)
			// mock asset source
			u.assetSource = m

			v := semver.MustParse("v2.0.0")

			m.EXPECT().NewVersionExists(currentVersion).Return(
				&NewVersionExistsResponse{
					exists:    false,
					version:   v,
					assetSize: "124 kB",
				}, nil,
			)

			assert.NoError(t, u.Run())
			m.AssertExpectations(t)
		})

		t.Run("should return early if the update already applied", func(t *testing.T) {
			currentVersion := semver.MustParse("v2.0.0")
			u := New(
				currentVersion,
				"test-app",
				"Test App",
			)
			u.shouldRestart = true

			assert.NoError(t, u.Run())
		})

		t.Run("should return an error if download fails", func(t *testing.T) {
			m := NewMockSource(t)

			currentVersion := semver.MustParse("v1.0.0")
			u := New(
				currentVersion,
				"test-app",
				"Test App",
			)
			// mock asset source
			u.assetSource = m

			v := semver.MustParse("v2.0.0")

			m.EXPECT().NewVersionExists(currentVersion).Return(
				&NewVersionExistsResponse{
					exists:    true,
					version:   v,
					assetSize: "124 kB",
				}, nil,
			)

			m.EXPECT().Download(mock.Anything).Return("", errors.New("mock error"))

			assert.EqualError(t, u.Run(), "mock error")
			m.AssertExpectations(t)
		})

		t.Run("should apply the update", func(t *testing.T) {
			// setup test files
			macosContentPath := "/Contents/MacOS"
			appFilename := "test-app"
			wd, _ := os.Getwd()

			testAppPath := filepath.Join(wd, "/testdata", appFilename)
			testAppUpdatedPath := filepath.Join(wd, "/testdata/downloaded", appFilename)
			if runtime.GOOS == osDarwin {
				testAppPath = filepath.Join(testAppPath, macosContentPath, appFilename)
				testAppUpdatedPath = filepath.Join(
					testAppUpdatedPath,
					macosContentPath,
					appFilename,
				)
			}

			t.Cleanup(func() {
				_ = os.RemoveAll(filepath.Join(wd, "/testdata"))
			})

			assert.NoError(t,
				os.MkdirAll(filepath.Dir(testAppUpdatedPath), os.ModePerm),
			)
			assert.NoError(t,
				os.MkdirAll(filepath.Dir(testAppPath), os.ModePerm),
			)
			assert.NoError(
				t,
				// read+write+execute perms
				os.WriteFile(testAppPath, []byte("test app"), 0o755),
			)
			assert.NoError(
				t,
				// read+write perms, not executable
				os.WriteFile(testAppUpdatedPath, []byte("test app updated"), 0o644),
			)

			osExecutable = func() (string, error) {
				return testAppPath, nil
			}

			m := NewMockSource(t)

			currentVersion := semver.MustParse("v1.0.0")
			u := New(
				currentVersion,
				appFilename,
				"Test App",
			)
			// mock asset source
			u.assetSource = m

			v := semver.MustParse("v2.0.0")

			m.EXPECT().NewVersionExists(currentVersion).Return(
				&NewVersionExistsResponse{
					exists:    true,
					version:   v,
					assetSize: "124 kB",
				}, nil,
			)

			m.EXPECT().Download(mock.Anything).Return(
				filepath.Join(wd, "/testdata/downloaded"),
				nil,
			)

			assert.NoError(t, u.Run())

			if runtime.GOOS == osDarwin || runtime.GOOS == osLinux {
				// verify the app is executable
				fileInfo, err := os.Lstat(testAppPath)
				require.NoError(t, err)
				assert.Equal(t, "-rwxr-xr-x", fileInfo.Mode().String())
			}

			// verify the app has been updated
			data, err := os.ReadFile(testAppPath)
			require.NoError(t, err)
			assert.Equal(t, "test app updated", string(data))

			// verify the old app has been removed
			oldDir := filepath.Join("testdata", fmt.Sprintf(".%s.old", appFilename))
			assert.NoDirExists(t, oldDir)

			m.AssertExpectations(t)
		})
	})
}
