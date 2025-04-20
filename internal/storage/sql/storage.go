package sql

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"weaviate-gui/internal/models"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

type Storage struct {
	db *sqlx.DB
}

type SqlDB interface {
	SelectContext(ctx context.Context, dest any, query string, args ...any) error
	NamedExecContext(ctx context.Context, query string, arg any)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

var connectionTable = `CREATE TABLE IF NOT EXISTS connections (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	uri TEXT NOT NULL,
	favorite BOOLEAN DEFAULT FALSE,
	api_key TEXT
);`

func InitStorage(db *sqlx.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := db.ExecContext(ctx, connectionTable); err != nil {
		return fmt.Errorf("failed creating connections table: %w", err)
	}

	_, err := db.Exec("PRAGMA journal_mode=WAL;")
	if err != nil {
		return fmt.Errorf("failed creating connections table: %w", err)
	}

	return nil
}

func getDbFile(fileName string) string {
	return fileName + ".db"
}

func GetStorageSource(fileName string) string {
	cacheDir, _ := os.UserCacheDir()
	dataDir := filepath.Join(cacheDir, fileName)

	if err := os.MkdirAll(dataDir, os.FileMode(0o755)); err != nil {
		return getDbFile(fileName)
	}

	return filepath.Join(dataDir, getDbFile(fileName))
}

func NewStorage(db *sqlx.DB) *Storage {
	return &Storage{db: db}
}

func (s *Storage) GetConnections() ([]models.Connection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var connections []models.Connection
	if err := s.db.SelectContext(ctx, &connections, "SELECT * FROM connections"); err != nil {
		return nil, fmt.Errorf("failed getting connections: %w", err)
	}

	return connections, nil
}

func (s *Storage) SaveConnection(c models.Connection) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	q := `
		INSERT INTO connections (name, uri, api_key)
		VALUES (:name, :uri, :api_key)
		RETURNING id;
	`

	result, err := s.db.NamedExecContext(ctx, q, c)
	if err != nil {
		return 0, fmt.Errorf("failed inserting connection: %w", err)
	}

	return result.LastInsertId()
}

func (s *Storage) RemoveConnection(id int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := s.db.ExecContext(ctx, "DELETE FROM connections WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed deleting connection: %w", err)
	}

	rowsDeleted, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed deleting connection: %w", err)
	}
	if rowsDeleted == 0 {
		return fmt.Errorf("connection with id %d not found", id)
	}

	return nil
}

func (s *Storage) UpdateFavorite(id int64, favorite bool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := s.db.ExecContext(
		ctx,
		"UPDATE connections SET favorite = ? WHERE id = ?",
		favorite,
		id,
	)
	if err != nil {
		return fmt.Errorf("failed updating favorite: %w", err)
	}

	rowsUpdated, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed updating favorite: %w", err)
	}
	if rowsUpdated == 0 {
		return fmt.Errorf("favorite with id %d not found", id)
	}

	return nil
}

func (s *Storage) GetConnection(id int64) (*models.Connection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var connection models.Connection
	if err := s.db.GetContext(ctx, &connection, "SELECT * FROM connections WHERE id = ?", id); err != nil {
		return nil, fmt.Errorf("failed getting connection: %w", err)
	}

	return &connection, nil
}
