package sql

import (
	"errors"
	"testing"

	"weaviate-gui/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
)

func Pointer[T any](v T) *T {
	return &v
}

func TestStorage(t *testing.T) {
	t.Run("InitStorage", func(t *testing.T) {
		t.Run("should initialize storage successfully", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("CREATE TABLE IF NOT EXISTS connections").
				WillReturnResult(sqlmock.NewResult(0, 0))
			mock.ExpectExec("PRAGMA journal_mode=WAL;").WillReturnResult(sqlmock.NewResult(0, 0))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			err = InitStorage(sqlxDB)
			assert.NoError(t, err)
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if initialization fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("CREATE TABLE IF NOT EXISTS connections").
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			err = InitStorage(sqlxDB)
			assert.EqualError(t, err, "failed creating connections table: mock error")
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("GetConnections", func(t *testing.T) {
		t.Run("should return connections", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			rows := sqlmock.NewRows(
				[]string{"id", "name", "uri", "favorite", "api_key"},
			).AddRow(1, "Test Connection", "http://localhost", false, "test-key")

			mock.ExpectQuery("SELECT \\* FROM connections").WillReturnRows(rows)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			connections, err := storage.GetConnections()
			assert.NoError(t, err)
			assert.Len(t, connections, 1)
			assert.Equal(t, models.Connection{
				ID:       1,
				URI:      "http://localhost",
				Name:     "Test Connection",
				Favorite: false,
				ApiKey:   Pointer("test-key"),
			}, connections[0])
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if query fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectQuery("SELECT \\* FROM connections").
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			connections, err := storage.GetConnections()
			assert.EqualError(t, err, "failed getting connections: mock error")
			assert.Nil(t, connections)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("SaveConnection", func(t *testing.T) {
		t.Run("should save connection successfully", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("INSERT INTO connections").
				WithArgs("Test Connection", "http://localhost", "test-key", "red", true).
				WillReturnResult(sqlmock.NewResult(1, 1))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			connection := models.Connection{
				Name:     "Test Connection",
				URI:      "http://localhost",
				ApiKey:   Pointer("test-key"),
				Color:    "red",
				Favorite: true,
			}

			id, err := storage.SaveConnection(connection)
			assert.NoError(t, err)
			assert.Equal(t, int64(1), id)
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if save fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("INSERT INTO connections").
				WithArgs("Test Connection", "http://localhost", "test-key", "", false).
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			connection := models.Connection{
				Name:   "Test Connection",
				URI:    "http://localhost",
				ApiKey: Pointer("test-key"),
			}

			id, err := storage.SaveConnection(connection)
			assert.EqualError(t, err, "failed inserting connection: mock error")
			assert.Equal(t, int64(0), id)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("RemoveConnection", func(t *testing.T) {
		t.Run("should remove connection successfully", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("DELETE FROM connections WHERE id = ?").WithArgs(1).
				WillReturnResult(sqlmock.NewResult(0, 1))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			err = storage.RemoveConnection(1)
			assert.NoError(t, err)
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if remove fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("DELETE FROM connections WHERE id = ?").WithArgs(1).
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			err = storage.RemoveConnection(1)
			assert.EqualError(t, err, "failed deleting connection: mock error")
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if connection not found", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("DELETE FROM connections WHERE id = ?").WithArgs(1).
				WillReturnResult(sqlmock.NewResult(0, 0))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			err = storage.RemoveConnection(1)
			assert.EqualError(t, err, "connection with id 1 not found")
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("UpdateFavorite", func(t *testing.T) {
		t.Run("should update favorite successfully", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("UPDATE connections SET favorite = \\? WHERE id = \\?").
				WithArgs(true, 1).
				WillReturnResult(sqlmock.NewResult(0, 1))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			err = storage.UpdateFavorite(1, true)
			assert.NoError(t, err)
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if update fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("UPDATE connections SET favorite = \\? WHERE id = \\?").
				WithArgs(true, 1).
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			err = storage.UpdateFavorite(1, true)
			assert.EqualError(t, err, "failed updating favorite: mock error")
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if connection not found", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectExec("UPDATE connections SET favorite = \\? WHERE id = \\?").
				WithArgs(true, 1).
				WillReturnResult(sqlmock.NewResult(0, 0))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			err = storage.UpdateFavorite(1, true)
			assert.EqualError(t, err, "favorite with id 1 not found")
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})

	t.Run("GetConnection", func(t *testing.T) {
		t.Run("should return connectionByID", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			rows := sqlmock.NewRows([]string{"id", "name", "uri", "favorite", "api_key"}).
				AddRow(1, "Test Connection", "http://localhost", false, "test-key")
			mock.ExpectQuery("SELECT \\* FROM connections WHERE id = \\?").
				WithArgs(1).
				WillReturnRows(rows)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			connection, err := storage.GetConnection(1)
			assert.NoError(t, err)
			assert.Equal(t, "Test Connection", connection.Name)
			assert.NoError(t, mock.ExpectationsWereMet())
		})

		t.Run("should return error if query fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectQuery("SELECT \\* FROM connections WHERE id = \\?").
				WithArgs(1).
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := NewStorage(sqlxDB)

			connection, err := storage.GetConnection(1)
			assert.EqualError(t, err, "failed getting connection: mock error")
			assert.Nil(t, connection)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})
}
