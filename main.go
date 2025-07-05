package main

import (
	"context"
	"embed"
	"log"
	"log/slog"
	"os"
	"time"

	"weaviate-desktop/internal/config"
	"weaviate-desktop/internal/encrypter"
	"weaviate-desktop/internal/storage/sql"
	"weaviate-desktop/internal/updater"
	"weaviate-desktop/internal/weaviate"

	"github.com/leaanthony/u"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed wails.json
var wailsConfig string

func main() {
	cfg := config.New(wailsConfig)

	sqlStorage, dbCloser, err := sql.NewStorage(cfg.FileName, encrypter.New())
	if err != nil {
		log.Fatalf("failed initializing storage: %v", err)
	}

	w := weaviate.New(sqlStorage, weaviate.Configuration{
		StatusUpdateInterval: 30 * time.Second,
	})

	appUpdater := updater.New(
		cfg.Version,
		cfg.FileName,
		cfg.AppName,
		"<will drop this when app is public>",
	)

	// Create application with options
	if err := wails.Run(&options.App{
		Title:     cfg.AppName,
		Width:     1440,
		Height:    1024,
		MinHeight: 640,
		MinWidth:  1024,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: func(ctx context.Context) {
			// Setup logger
			envInfo := runtime.Environment(ctx)
			logLevel := slog.LevelInfo

			if envInfo.BuildType == "dev" {
				logLevel = slog.LevelDebug
			}

			slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: logLevel,
			})))

			// Pass runtime context to those in need
			appUpdater.SetRuntimeContext(ctx)
		},
		OnShutdown: func(_ context.Context) {
			_ = dbCloser()
		},
		DragAndDrop: &options.DragAndDrop{
			DisableWebViewDrop: true,
		},
		LogLevel: logger.INFO,
		Mac: &mac.Options{
			Preferences: &mac.Preferences{
				FullscreenEnabled: u.True,
			},
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		Bind: []any{
			w,
			sqlStorage,
			appUpdater,
		},
	}); err != nil {
		println("Error:", err.Error())
	}
}
