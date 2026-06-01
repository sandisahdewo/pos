package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/sandisahdewo/pos/backend/internal/config"
	"github.com/sandisahdewo/pos/backend/internal/db"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

// Idempotent admin seed. Inserts the admin user when missing; updates
// password/name/role when present. Safe to re-run.
//
// Env overrides (defaults shown):
//
//	ADMIN_EMAIL=admin@pos.local
//	ADMIN_PASSWORD=admin123
//	ADMIN_NAME=Admin
func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	bundb, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer bundb.Close()

	email := envOr("ADMIN_EMAIL", "admin@pos.local")
	password := envOr("ADMIN_PASSWORD", "admin123")
	name := envOr("ADMIN_NAME", "Admin")

	hash, err := auth.HashPassword(password, cfg.BcryptCost)
	if err != nil {
		log.Fatalf("hash: %v", err)
	}

	user := &models.User{
		Email:        email,
		PasswordHash: hash,
		Name:         name,
		Role:         "admin",
	}

	// Upsert on (email): insert when absent, update password/name/role when
	// present. updated_at refreshed via current_timestamp.
	_, err = bundb.NewInsert().
		Model(user).
		On("CONFLICT (email) DO UPDATE").
		Set("password_hash = EXCLUDED.password_hash").
		Set("name = EXCLUDED.name").
		Set("role = EXCLUDED.role").
		Set("updated_at = current_timestamp").
		Returning("*").
		Exec(context.Background())
	if err != nil {
		log.Fatalf("upsert: %v", err)
	}

	fmt.Printf("admin seeded: %s (id=%s)\n", user.Email, user.ID)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
