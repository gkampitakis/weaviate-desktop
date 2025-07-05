# Weaviate Desktop

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
