package main

import (
	"context"
	"embed"
	"log"
	"log/slog"
	"os"
	"time"

	"weaviate-gui/internal/config"
	"weaviate-gui/internal/storage/sql"
	"weaviate-gui/internal/weaviate"

	"github.com/jmoiron/sqlx"
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

	db, err := sqlx.Open("sqlite", sql.GetStorageSource(cfg.FileName))
	if err != nil {
		log.Fatalf("failed opening sqlite: %v", err)
	}
	if err := sql.InitStorage(db); err != nil {
		log.Fatalf("failed initializing storage: %v", err)
	}

	sqlStorage := sql.NewStorage(db)
	w := weaviate.New(sqlStorage, weaviate.Configuration{
		StatusUpdateInterval: 30 * time.Second,
	})

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
			envInfo := runtime.Environment(ctx)
			logLevel := slog.LevelInfo

			if envInfo.BuildType == "dev" {
				logLevel = slog.LevelDebug
			}

			slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: logLevel,
			})))
		},
		OnShutdown: func(_ context.Context) {
			db.Close()
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
		},
	}); err != nil {
		println("Error:", err.Error())
	}
}
