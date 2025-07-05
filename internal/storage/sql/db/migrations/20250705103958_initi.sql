-- migrate:up
CREATE TABLE IF NOT EXISTS "connections" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"uri"	TEXT NOT NULL,
	"favorite"	BOOLEAN DEFAULT FALSE,
	"api_key"	TEXT,
	"color"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
PRAGMA journal_mode = WAL;

-- migrate:down
DROP TABLE IF EXISTS "connections";
PRAGMA journal_mode = DELETE;
