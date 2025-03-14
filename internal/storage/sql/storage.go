package sql

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

const dbFile = "weaviate-gui.db"

type Storage struct {
	db *sqlx.DB
}

var connectionTable = `CREATE TABLE IF NOT EXISTS connections (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	uri TEXT NOT NULL,
	favorite BOOLEAN DEFAULT FALSE
);`

func InitStorage(db *sqlx.DB) error {
	if _, err := db.Exec(connectionTable); err != nil {
		return fmt.Errorf("failed creating connections table: %w", err)
	}

	_, err := db.Exec("PRAGMA journal_mode=WAL;")
	if err != nil {
		return fmt.Errorf("failed creating connections table: %w", err)
	}

	return nil
}

func GetStorageSource() string {
	cacheDir, _ := os.UserCacheDir()
	dataDir := filepath.Join(cacheDir, "weaviate-gui")

	if err := os.MkdirAll(dataDir, os.FileMode(0755)); err != nil {
		return dbFile
	}

	return filepath.Join(dataDir, dbFile)
}

func NewStorage(db *sqlx.DB) *Storage {
	return &Storage{db: db}
}

type Connection struct {
	ID       int64  `db:"id" json:"id"`
	URI      string `db:"uri" json:"uri"`
	Name     string `db:"name" json:"name"`
	Favorite bool   `db:"favorite" json:"favorite"`
}

// ctx context.Context
func (s *Storage) GetConnections() ([]Connection, error) {
	var connections []Connection

	if err := s.db.Select(&connections, "SELECT * FROM connections"); err != nil {
		return nil, fmt.Errorf("failed getting connections: %w", err)
	}

	return connections, nil
}

// ctx context.Context,
func (s *Storage) SaveConnection(connection Connection) (int64, error) {
	q := `
		INSERT INTO connections (name, uri)
		VALUES (:name, :uri)
		RETURNING id;
	`
	result, err := s.db.NamedExec(q, connection)
	if err != nil {
		return 0, fmt.Errorf("failed inserting connection: %w", err)
	}

	return result.LastInsertId()
}

func (s *Storage) RemoveConnection(id int64) error {
	result, err := s.db.Exec("DELETE FROM connections WHERE id = ?", id)
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

	fmt.Println(id, favorite)

	result, err := s.db.Exec("UPDATE connections SET favorite = ? WHERE id = ?", favorite, id)
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
