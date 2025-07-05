CREATE TABLE IF NOT EXISTS "connections" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"uri"	TEXT NOT NULL,
	"favorite"	BOOLEAN DEFAULT FALSE,
	"api_key"	TEXT,
	"color"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "schema_migrations" (version varchar(128) primary key);
-- Dbmate schema migrations
INSERT INTO "schema_migrations" (version) VALUES
  ('20250705103958');
