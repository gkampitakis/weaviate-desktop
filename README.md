# Weaviate Desktop

## Development

The app is built with [Wails](https://wails.io). The CLI version is pinned by the `tool`
directive in `go.mod`, so there is nothing to install separately — `make dev` and
`make build` invoke it through `go tool wails`. `make help` lists all targets.

## Local storage

Weaviate Desktop stores its data in a local SQLite database. The database file is located at:

```
${os.UserCacheDir()}/weaviate-desktop/weaviate.db
```

### Migrations

For dumping the SQLite database schema, you can use the following command:

```bash
(cd ./internal/storage/sql && dbmate dump --url sqlite://${os.UserCacheDir()}/weaviate-desktop/weaviate.db)
```

For creating a new migration

```bash
dbmate new <migration-name>
```
