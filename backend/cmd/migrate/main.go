package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/sandisahdewo/pos/backend/internal/config"
	"github.com/sandisahdewo/pos/backend/internal/db"
	"github.com/sandisahdewo/pos/backend/migrations"
	"github.com/uptrace/bun/migrate"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(2)
	}
	cmd := os.Args[1]
	// Re-parse remaining args (so commands like `create` can take a name).
	flag.CommandLine.Parse(os.Args[2:])

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	bundb, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer bundb.Close()

	migrator := migrate.NewMigrator(bundb, migrations.Migrations)
	ctx := context.Background()

	switch cmd {
	case "init":
		if err := migrator.Init(ctx); err != nil {
			log.Fatalf("init: %v", err)
		}
		fmt.Println("migration tables created")

	case "up":
		if err := migrator.Init(ctx); err != nil {
			log.Fatalf("init: %v", err)
		}
		group, err := migrator.Migrate(ctx)
		if err != nil {
			log.Fatalf("migrate: %v", err)
		}
		if group.IsZero() {
			fmt.Println("no new migrations")
			return
		}
		fmt.Printf("migrated to group #%d (%d migrations)\n", group.ID, len(group.Migrations))

	case "down":
		group, err := migrator.Rollback(ctx)
		if err != nil {
			log.Fatalf("rollback: %v", err)
		}
		if group.IsZero() {
			fmt.Println("nothing to rollback")
			return
		}
		fmt.Printf("rolled back group #%d (%d migrations)\n", group.ID, len(group.Migrations))

	case "status":
		ms, err := migrator.MigrationsWithStatus(ctx)
		if err != nil {
			log.Fatalf("status: %v", err)
		}
		fmt.Printf("applied: %s\n", ms.Applied())
		fmt.Printf("unapplied: %s\n", ms.Unapplied())
		fmt.Printf("last group: %s\n", ms.LastGroup())

	case "create":
		name := flag.Arg(0)
		if name == "" {
			log.Fatal("usage: migrate create <name>")
		}
		files, err := migrator.CreateSQLMigrations(ctx, name)
		if err != nil {
			log.Fatalf("create: %v", err)
		}
		for _, f := range files {
			fmt.Println("created:", f.Path)
		}

	default:
		printUsage()
		os.Exit(2)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, `usage: migrate <command>

commands:
  init     create migration tables
  up       apply pending migrations
  down     rollback last migration group
  status   show applied/unapplied migrations
  create   create new pair of .up.sql / .down.sql migration files`)
}
