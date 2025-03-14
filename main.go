package main

import (
	"context"
	"embed"
	"log"

	"weaviate-gui/internal/storage/sql"
	"weaviate-gui/internal/weaviate"

	"github.com/jmoiron/sqlx"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	db, err := sqlx.Open("sqlite", sql.GetStorageSource())
	if err != nil {
		log.Fatalf("failed opening sqlite: %v", err)
	}
	if err := sql.InitStorage(db); err != nil {
		log.Fatalf("failed initializing storage: %v", err)
	}

	w := &weaviate.Weaviate{}
	sqlStorage := sql.NewStorage(db)

	// Create application with options
	if err := wails.Run(&options.App{
		Title:  "weaviate-gui",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnShutdown: func(_ context.Context) {
			db.Close()
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        func(_ context.Context) {},
		Bind: []any{
			app,
			w,
			sqlStorage,
		},
	}); err != nil {
		println("Error:", err.Error())
	}
}
