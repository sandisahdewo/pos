//go:build tools

package tools

// This file ensures all required dependencies remain in go.mod
// even before they are imported in application code.
// Remove individual imports as actual code starts using them.

import (
	_ "github.com/alexedwards/argon2id"
	_ "github.com/go-chi/cors"
	_ "github.com/go-playground/validator/v10"
	_ "github.com/golang-jwt/jwt/v5"
	_ "github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/google/uuid"
	_ "github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/stretchr/testify/assert"
	_ "github.com/wneessen/go-mail"
)
