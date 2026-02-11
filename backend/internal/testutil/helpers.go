package testutil

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"pos/internal/config"
	"pos/internal/database/sqlc"
	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
)

var schemaCounter uint64

// SetupTestDB creates an isolated test schema, runs migrations, seeds features,
// and returns a pool + queries scoped to that schema. The schema is dropped on
// test cleanup.
func SetupTestDB(t *testing.T) (*pgxpool.Pool, *sqlc.Queries) {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://pos_user:pos_password@localhost:5432/pos_db?sslmode=disable"
	}

	ctx := context.Background()

	// Create a unique schema for this test
	schema := fmt.Sprintf("test_%d_%d", time.Now().UnixNano(), atomic.AddUint64(&schemaCounter, 1))

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// Create isolated schema
	_, err = pool.Exec(ctx, fmt.Sprintf("CREATE SCHEMA %s", schema))
	if err != nil {
		pool.Close()
		t.Fatalf("failed to create test schema: %v", err)
	}

	// Ensure uuid-ossp extension exists in public schema (shared across schemas).
	// Ignore duplicate key errors from concurrent test setup.
	_, err = pool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`)
	if err != nil && !strings.Contains(err.Error(), "23505") {
		pool.Close()
		t.Fatalf("failed to create uuid-ossp extension: %v", err)
	}

	// Set search_path for the pool
	pool.Close()
	pool, err = pgxpool.New(ctx, dsn+"&search_path="+schema+",public")
	if err != nil {
		t.Fatalf("failed to connect with schema: %v", err)
	}

	// Run migrations inline (create tables in the test schema)
	if err := runMigrations(ctx, pool); err != nil {
		pool.Close()
		t.Fatalf("failed to run migrations: %v", err)
	}

	// Seed features
	queries := sqlc.New(pool)
	if err := seedFeatures(ctx, queries); err != nil {
		pool.Close()
		t.Fatalf("failed to seed features: %v", err)
	}

	t.Cleanup(func() {
		cleanCtx := context.Background()
		// Reconnect without schema search_path to drop
		cleanPool, err := pgxpool.New(cleanCtx, dsn)
		if err == nil {
			cleanPool.Exec(cleanCtx, fmt.Sprintf("DROP SCHEMA %s CASCADE", schema))
			cleanPool.Close()
		}
		pool.Close()
	})

	return pool, queries
}

// runMigrations creates all tables within the current search_path schema.
func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS tenants (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			name VARCHAR(100) NOT NULL,
			slug VARCHAR(100) NOT NULL UNIQUE,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			first_name VARCHAR(100) NOT NULL,
			last_name VARCHAR(100) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS stores (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			name VARCHAR(100) NOT NULL,
			address TEXT,
			phone VARCHAR(50),
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(tenant_id, name)
		)`,
		`CREATE TABLE IF NOT EXISTS features (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			parent_id UUID REFERENCES features(id),
			name VARCHAR(100) NOT NULL,
			slug VARCHAR(100) NOT NULL UNIQUE,
			module VARCHAR(100) NOT NULL,
			actions TEXT[],
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS roles (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			name VARCHAR(100) NOT NULL,
			description TEXT,
			is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(tenant_id, name)
		)`,
		`CREATE TABLE IF NOT EXISTS role_permissions (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
			feature_id UUID NOT NULL REFERENCES features(id),
			actions TEXT[] NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(role_id, feature_id)
		)`,
		`CREATE TABLE IF NOT EXISTS user_roles (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
			assigned_by UUID REFERENCES users(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, role_id)
		)`,
		`CREATE TABLE IF NOT EXISTS user_stores (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
			assigned_by UUID REFERENCES users(id),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, store_id)
		)`,
		`CREATE TABLE IF NOT EXISTS email_verifications (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL,
			expires_at TIMESTAMPTZ,
			is_used BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS password_resets (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL,
			expires_at TIMESTAMPTZ,
			is_used BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS invitations (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id),
			invited_by UUID NOT NULL REFERENCES users(id),
			email VARCHAR(255) NOT NULL,
			role_id UUID NOT NULL REFERENCES roles(id),
			store_ids UUID[],
			token_hash TEXT NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			expires_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL,
			expires_at TIMESTAMPTZ,
			revoked BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}

	for _, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("executing migration: %w", err)
		}
	}
	return nil
}

// Predefined feature UUIDs (same as seed/main.go)
var (
	MasterDataID      = uuid.MustParse("10000000-0000-0000-0000-000000000001")
	MasterDataProduct = uuid.MustParse("10000000-0000-0000-0000-000000000002")
	ReportingID       = uuid.MustParse("10000000-0000-0000-0000-000000000003")
	ReportingSales    = uuid.MustParse("10000000-0000-0000-0000-000000000004")
	PurchaseID        = uuid.MustParse("10000000-0000-0000-0000-000000000005")
	PurchaseProduct   = uuid.MustParse("10000000-0000-0000-0000-000000000006")
)

func seedFeatures(ctx context.Context, q *sqlc.Queries) error {
	features := []sqlc.UpsertFeatureParams{
		{ID: MasterDataID, Name: "Master Data", Slug: "master-data", Module: "master-data", Actions: nil, SortOrder: 1},
		{ID: MasterDataProduct, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Product", Slug: "master-data.product", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 2},
		{ID: ReportingID, Name: "Reporting", Slug: "reporting", Module: "reporting", Actions: nil, SortOrder: 3},
		{ID: ReportingSales, ParentID: pgtype.UUID{Bytes: ReportingID, Valid: true}, Name: "Sales", Slug: "reporting.sales", Module: "reporting", Actions: []string{"read"}, SortOrder: 4},
		{ID: PurchaseID, Name: "Purchase", Slug: "purchase", Module: "purchase", Actions: nil, SortOrder: 5},
		{ID: PurchaseProduct, ParentID: pgtype.UUID{Bytes: PurchaseID, Valid: true}, Name: "Product", Slug: "purchase.product", Module: "purchase", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 6},
	}
	for _, f := range features {
		if _, err := q.UpsertFeature(ctx, f); err != nil {
			return fmt.Errorf("seeding feature %s: %w", f.Slug, err)
		}
	}
	return nil
}

// TestConfig returns a minimal config suitable for tests.
func TestConfig() *config.Config {
	return &config.Config{
		App: config.AppConfig{
			Port: "8080",
			Env:  "development",
			URL:  "http://localhost:5173",
		},
		JWT: config.JWTConfig{
			Secret:     "test-secret-key-for-unit-tests-only",
			AccessTTL:  15 * time.Minute,
			RefreshTTL: 7 * 24 * time.Hour,
		},
		Argon2: config.Argon2Config{
			Memory:      16384, // Low for fast tests
			Iterations:  1,
			Parallelism: 1,
			SaltLength:  16,
			KeyLength:   32,
		},
	}
}

// NoopEnqueuer is a job enqueuer that does nothing (for tests).
type NoopEnqueuer struct{}

func (e *NoopEnqueuer) EnqueueEmailVerification(_ context.Context, _ uuid.UUID, _, _ string) error {
	return nil
}
func (e *NoopEnqueuer) EnqueuePasswordReset(_ context.Context, _ uuid.UUID, _, _ string) error {
	return nil
}
func (e *NoopEnqueuer) EnqueueInvitationEmail(_ context.Context, _, _, _ string) error {
	return nil
}

// CreateTestUser registers a user via AuthService and returns the auth service,
// config, registration response, and the original request.
func CreateTestUser(t *testing.T, pool *pgxpool.Pool, queries *sqlc.Queries) (*service.AuthService, *config.Config, *model.RegisterResponse, model.RegisterRequest) {
	t.Helper()
	cfg := TestConfig()
	tokenSvc := service.NewTokenService(&cfg.JWT)
	authSvc := service.NewAuthService(pool, queries, tokenSvc, cfg, &NoopEnqueuer{})

	ctx := context.Background()
	suffix := uuid.New().String()[:8]
	req := model.RegisterRequest{
		TenantName:   "Test Tenant " + suffix,
		Email:        "user-" + suffix + "@test.com",
		Password:     "testpass123",
		FirstName:    "Test",
		LastName:     "User",
		StoreName:    "Test Store " + suffix,
		StoreAddress: "123 Test St",
	}

	resp, err := authSvc.Register(ctx, req)
	if err != nil {
		t.Fatalf("failed to register test user: %v", err)
	}

	return authSvc, cfg, resp, req
}

// GenerateTestJWT creates a valid JWT for testing authenticated endpoints.
func GenerateTestJWT(userID, tenantID uuid.UUID, email, secret string) string {
	now := time.Now()
	claims := middleware.Claims{
		UserID:   userID,
		TenantID: tenantID,
		Email:    email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		panic("failed to sign test JWT: " + err.Error())
	}
	return signed
}
