# Weaviate Desktop

## Development

The app is built with [Wails](https://wails.io). The supported CLI version is pinned as
`WAILS_VERSION` in the `Makefile`; older CLIs can fail to analyse the project when built
against a recent Go toolchain. Install the pinned CLI with:

```bash
make tools
```

Then run `make dev` to start the dev server. `make help` lists all available targets.

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
