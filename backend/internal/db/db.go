package db

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"
	"github.com/uptrace/bun/extra/bundebug"
)

// Open creates a Bun-wrapped sql.DB pointed at the given Postgres DSN. Debug
// logging is enabled when DEBUG_SQL=1 — handy in dev, noisy in prod.
func Open(dsn string) (*bun.DB, error) {
	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	if err := sqldb.Ping(); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	db := bun.NewDB(sqldb, pgdialect.New())
	if os.Getenv("DEBUG_SQL") == "1" {
		db.AddQueryHook(bundebug.NewQueryHook(bundebug.WithVerbose(true)))
	}
	return db, nil
}
