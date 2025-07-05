package sql

import (
	"errors"
	"testing"

	"weaviate-desktop/internal/models"
	"weaviate-desktop/internal/utils"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
)

func TestStorage(t *testing.T) {
	t.Run("GetConnections", func(t *testing.T) {
		t.Run("should return connections", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			rows := sqlmock.NewRows(
				[]string{"id", "name", "uri", "favorite", "api_key"},
			).AddRow(1, "Test Connection", "http://localhost", false, "encrypted-key")

			mock.ExpectQuery("SELECT \\* FROM connections").WillReturnRows(rows)

			encrypter.EXPECT().Decrypt("encrypted-key").Return("test-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connections, err := storage.GetConnections(true)
			assert.NoError(t, err)
			assert.Len(t, connections, 1)
			assert.Equal(t, models.Connection{
				ID:       1,
				URI:      "http://localhost",
				Name:     "Test Connection",
				Favorite: false,
				ApiKey:   utils.Pointer("test-key"),
			}, connections[0])
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return connections decryptedSecret", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			rows := sqlmock.NewRows(
				[]string{"id", "name", "uri", "favorite", "api_key"},
			).AddRow(1, "Test Connection", "http://localhost", false, "encrypted-key")

			mock.ExpectQuery("SELECT \\* FROM connections").WillReturnRows(rows)

			encrypter.EXPECT().DecryptSecret("encrypted-key").Return("test-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connections, err := storage.GetConnections(false)
			assert.NoError(t, err)
			assert.Len(t, connections, 1)
			assert.Equal(t, models.Connection{
				ID:       1,
				URI:      "http://localhost",
				Name:     "Test Connection",
				Favorite: false,
				ApiKey:   utils.Pointer("test-key"),
			}, connections[0])
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return error if query fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectQuery("SELECT \\* FROM connections").
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

			connections, err := storage.GetConnections(false)
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

			encrypter := NewMockEncrypter(t)

			mock.ExpectExec("INSERT INTO connections").
				WithArgs("Test Connection", "http://localhost", "encrypted-key", "red", true).
				WillReturnResult(sqlmock.NewResult(1, 1))

			encrypter.EXPECT().Encrypt("test-key").Return("encrypted-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection := models.Connection{
				Name:     "Test Connection",
				URI:      "http://localhost",
				ApiKey:   utils.Pointer("test-key"),
				Color:    "red",
				Favorite: true,
			}

			id, err := storage.SaveConnection(connection)
			assert.NoError(t, err)
			assert.Equal(t, int64(1), id)
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return error if save fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			mock.ExpectExec("INSERT INTO connections").
				WithArgs("Test Connection", "http://localhost", "encrypted-key", "", false).
				WillReturnError(errors.New("mock error"))

			encrypter.EXPECT().Encrypt("test-key").Return("encrypted-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection := models.Connection{
				Name:   "Test Connection",
				URI:    "http://localhost",
				ApiKey: utils.Pointer("test-key"),
			}

			id, err := storage.SaveConnection(connection)
			assert.EqualError(t, err, "failed inserting connection: mock error")
			assert.Equal(t, int64(0), id)
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})
	})

	t.Run("UpdateConnection", func(t *testing.T) {
		t.Run("should update connection successfully", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			mock.ExpectExec("UPDATE connections").
				WithArgs("Test Connection", "http://localhost", "encrypted-key", "red", true, 5).
				WillReturnResult(sqlmock.NewResult(0, 1))

			encrypter.EXPECT().Encrypt("test-key").Return("encrypted-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection := models.Connection{
				ID:       5,
				Name:     "Test Connection",
				URI:      "http://localhost",
				ApiKey:   utils.Pointer("test-key"),
				Color:    "red",
				Favorite: true,
			}

			assert.NoError(t, storage.UpdateConnection(connection))
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return error if update fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			mock.ExpectExec("UPDATE connections").
				WithArgs("Test Connection", "http://localhost", "encrypted-key", "red", true, 5).
				WillReturnError(errors.New("mock error"))

			encrypter.EXPECT().Encrypt("test-key").Return("encrypted-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection := models.Connection{
				ID:       5,
				Name:     "Test Connection",
				URI:      "http://localhost",
				ApiKey:   utils.Pointer("test-key"),
				Color:    "red",
				Favorite: true,
			}

			assert.EqualError(
				t,
				storage.UpdateConnection(connection),
				"failed updating connection: mock error",
			)
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return error if connection not found", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			mock.ExpectExec("UPDATE connections").
				WithArgs("Test Connection", "http://localhost", "encrypted-key", "red", true, 5).
				WillReturnResult(sqlmock.NewResult(0, 0))

			encrypter.EXPECT().Encrypt("test-key").Return("encrypted-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection := models.Connection{
				ID:       5,
				Name:     "Test Connection",
				URI:      "http://localhost",
				ApiKey:   utils.Pointer("test-key"),
				Color:    "red",
				Favorite: true,
			}

			assert.EqualError(
				t,
				storage.UpdateConnection(connection),
				"connection with id 5 not found",
			)
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
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
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

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
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

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
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

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
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

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
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

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
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

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

			encrypter := NewMockEncrypter(t)

			rows := sqlmock.NewRows([]string{"id", "name", "uri", "favorite", "api_key"}).
				AddRow(1, "Test Connection", "http://localhost", false, "encrypted-key")

			mock.ExpectQuery("SELECT \\* FROM connections WHERE id = \\?").
				WithArgs(1).
				WillReturnRows(rows)

			encrypter.EXPECT().Decrypt("encrypted-key").Return("test-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection, err := storage.GetConnection(1, true)
			assert.NoError(t, err)
			assert.Equal(t, "Test Connection", connection.Name)
			assert.Equal(t, "test-key", *connection.ApiKey)
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return connectionByID with decryptSecret", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			encrypter := NewMockEncrypter(t)

			rows := sqlmock.NewRows([]string{"id", "name", "uri", "favorite", "api_key"}).
				AddRow(1, "Test Connection", "http://localhost", false, "encrypted-key")

			mock.ExpectQuery("SELECT \\* FROM connections WHERE id = \\?").
				WithArgs(1).
				WillReturnRows(rows)

			encrypter.EXPECT().DecryptSecret("encrypted-key").Return("test-key", nil)

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: encrypter,
			}

			connection, err := storage.GetConnection(1, false)
			assert.NoError(t, err)
			assert.Equal(t, "Test Connection", connection.Name)
			assert.Equal(t, "test-key", *connection.ApiKey)
			assert.NoError(t, mock.ExpectationsWereMet())
			encrypter.AssertExpectations(t)
		})

		t.Run("should return error if query fails", func(t *testing.T) {
			db, mock, err := sqlmock.New()
			assert.NoError(t, err)
			defer db.Close()

			mock.ExpectQuery("SELECT \\* FROM connections WHERE id = \\?").
				WithArgs(1).
				WillReturnError(errors.New("mock error"))

			sqlxDB := sqlx.NewDb(db, "sqlite")
			storage := &Storage{
				db:   sqlxDB,
				encr: NewMockEncrypter(t),
			}

			connection, err := storage.GetConnection(1, true)
			assert.EqualError(t, err, "failed getting connection: mock error")
			assert.Nil(t, connection)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	})
}
