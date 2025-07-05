package sql

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"weaviate-desktop/internal/models"

	"github.com/amacneil/dbmate/v2/pkg/dbmate"
	"github.com/jmoiron/sqlx"

	// register sqlite driver
	_ "modernc.org/sqlite"
)

type Storage struct {
	db   *sqlx.DB
	encr Encrypter
}

//go:embed db/migrations/*
var migrations embed.FS

type SqlDB interface {
	SelectContext(ctx context.Context, dest any, query string, args ...any) error
	GetContext(ctx context.Context, dest any, query string, args ...any) error
	NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	Exec(query string, args ...any) (sql.Result, error)
}

type Encrypter interface {
	Encrypt(data string) (string, error)
	Decrypt(data string) (string, error)
	DecryptSecret(data string) (string, error)
}

func getDbFile(fileName string) string {
	return fileName + ".db"
}

func getStorageSource(fileName string) string {
	cacheDir, _ := os.UserCacheDir()
	dataDir := filepath.Join(cacheDir, fileName)

	if err := os.MkdirAll(dataDir, os.FileMode(0o755)); err != nil {
		return getDbFile(fileName)
	}

	return filepath.Join(dataDir, getDbFile(fileName))
}

func NewStorage(filename string, e Encrypter) (*Storage, func() error, error) {
	source := getStorageSource(filename)

	if err := runMigration(source); err != nil {
		return nil, nil, fmt.Errorf("failed running migration: %w", err)
	}

	db, err := sqlx.Open("sqlite", source)
	if err != nil {
		log.Fatalf("failed opening sqlite: %v", err)
	}

	return &Storage{db: db, encr: e}, db.Close, nil
}

func runMigration(s string) error {
	u, err := url.Parse(fmt.Sprintf("sqlite:%s", s))
	if err != nil {
		return fmt.Errorf("failed parsing sqlite source: %w", err)
	}
	dbmate.RegisterDriver(NewDriver, "sqlite")

	dbm := dbmate.New(u)
	dbm.FS = migrations
	dbm.SchemaFile = "./internal/storage/sql/db/schema.sql"

	if err := dbm.CreateAndMigrate(); err != nil {
		return fmt.Errorf("failed creating and migrating database: %w", err)
	}

	return nil
}

func (s *Storage) GetConnections(decrypt bool) ([]models.Connection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var connections []models.Connection
	if err := s.db.SelectContext(ctx, &connections, "SELECT * FROM connections"); err != nil {
		return nil, fmt.Errorf("failed getting connections: %w", err)
	}

	for i := range connections {
		if connections[i].ApiKey != nil {
			fn := s.encr.DecryptSecret
			if decrypt {
				fn = s.encr.Decrypt
			}

			decrypted, err := fn(*connections[i].ApiKey)
			if err != nil {
				return nil, fmt.Errorf("failed decrypting api key: %w", err)
			}
			connections[i].ApiKey = &decrypted
		}
	}

	return connections, nil
}

func (s *Storage) SaveConnection(c models.Connection) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if c.ApiKey != nil {
		encrypted, err := s.encr.Encrypt(*c.ApiKey)
		if err != nil {
			return 0, fmt.Errorf("failed encrypting api key: %w", err)
		}

		c.ApiKey = &encrypted
	}

	q := `
		INSERT INTO connections (name, uri, api_key, color, favorite)
		VALUES (:name, :uri, :api_key, :color, :favorite)
		RETURNING id;
	`

	result, err := s.db.NamedExecContext(ctx, q, c)
	if err != nil {
		return 0, fmt.Errorf("failed inserting connection: %w", err)
	}

	return result.LastInsertId()
}

func (s *Storage) UpdateConnection(c models.Connection) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if c.ApiKey != nil {
		encrypted, err := s.encr.Encrypt(*c.ApiKey)
		if err != nil {
			return fmt.Errorf("failed encrypting api key: %w", err)
		}
		c.ApiKey = &encrypted
	}

	q := `
		UPDATE connections
		SET name = :name, uri = :uri, api_key = :api_key, color = :color, favorite = :favorite
		WHERE id = :id;
	`
	result, err := s.db.NamedExecContext(ctx, q, c)
	if err != nil {
		return fmt.Errorf("failed updating connection: %w", err)
	}
	rowsUpdated, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed updating connection: %w", err)
	}
	if rowsUpdated == 0 {
		return fmt.Errorf("connection with id %d not found", c.ID)
	}

	return nil
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

func (s *Storage) GetConnection(id int64, decrypt bool) (*models.Connection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var connection models.Connection
	if err := s.db.GetContext(ctx, &connection, "SELECT * FROM connections WHERE id = ?", id); err != nil {
		return nil, fmt.Errorf("failed getting connection: %w", err)
	}

	if connection.ApiKey != nil {
		fn := s.encr.DecryptSecret
		if decrypt {
			fn = s.encr.Decrypt
		}

		decrypted, err := fn(*connection.ApiKey)
		if err != nil {
			return nil, fmt.Errorf("failed decrypting api key: %w", err)
		}
		connection.ApiKey = &decrypted
	}

	return &connection, nil
}
