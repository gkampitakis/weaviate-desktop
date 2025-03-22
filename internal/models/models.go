package models

type Connection struct {
	ID       int64   `db:"id" json:"id"`
	URI      string  `db:"uri" json:"uri"`
	Name     string  `db:"name" json:"name"`
	Favorite bool    `db:"favorite" json:"favorite"`
	ApiKey   *string `db:"api_key" json:"api_key"`
}
