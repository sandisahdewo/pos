package migrations

import (
	"embed"

	"github.com/uptrace/bun/migrate"
)

//go:embed *.sql
var sqlMigrations embed.FS

// Migrations is the registry the migrator CLI works against. SQL files in this
// directory are auto-discovered via the embed.FS above; format is
// YYYYMMDDHHMMSS_name.up.sql / YYYYMMDDHHMMSS_name.down.sql.
var Migrations = migrate.NewMigrations()

func init() {
	if err := Migrations.Discover(sqlMigrations); err != nil {
		panic(err)
	}
}
