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
		// Categories
		`CREATE TABLE IF NOT EXISTS categories (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			pricing_mode VARCHAR(50),
			markup_value NUMERIC(12,4),
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, name),
			CONSTRAINT chk_pricing_mode_markup CHECK (
				(pricing_mode IS NULL AND markup_value IS NULL) OR
				(pricing_mode IS NOT NULL AND markup_value IS NOT NULL)
			)
		)`,
		// Units
		`CREATE TABLE IF NOT EXISTS units (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, name)
		)`,
		// Variants
		`CREATE TABLE IF NOT EXISTS variants (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, name)
		)`,
		// Variant values
		`CREATE TABLE IF NOT EXISTS variant_values (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
			value VARCHAR(255) NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (variant_id, value)
		)`,
		// Category units
		`CREATE TABLE IF NOT EXISTS category_units (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (category_id, unit_id)
		)`,
		// Category variants
		`CREATE TABLE IF NOT EXISTS category_variants (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (category_id, variant_id)
		)`,
		// Unit conversions
		`CREATE TABLE IF NOT EXISTS unit_conversions (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			from_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
			to_unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
			conversion_factor NUMERIC(18,8) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, from_unit_id, to_unit_id),
			CONSTRAINT chk_different_units CHECK (from_unit_id != to_unit_id),
			CONSTRAINT chk_positive_factor CHECK (conversion_factor > 0)
		)`,
		// Warehouses
		`CREATE TABLE IF NOT EXISTS warehouses (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			address TEXT,
			phone VARCHAR(50),
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, name)
		)`,
		// Suppliers
		`CREATE TABLE IF NOT EXISTS suppliers (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			contact_name VARCHAR(255),
			email VARCHAR(255),
			phone VARCHAR(50),
			address TEXT,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, name)
		)`,
		// Products (enums + table)
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sell_method') THEN CREATE TYPE sell_method AS ENUM ('fifo', 'lifo'); END IF; END$$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN CREATE TYPE product_status AS ENUM ('active', 'inactive'); END IF; END$$`,
		`CREATE TABLE IF NOT EXISTS products (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			category_id UUID NOT NULL REFERENCES categories(id),
			name VARCHAR(255) NOT NULL,
			description TEXT,
			has_variants BOOLEAN NOT NULL DEFAULT FALSE,
			sell_method sell_method NOT NULL DEFAULT 'fifo',
			status product_status NOT NULL DEFAULT 'active',
			tax_rate NUMERIC(5,2) DEFAULT 0,
			discount_rate NUMERIC(5,2) DEFAULT 0,
			min_quantity NUMERIC(12,4),
			max_quantity NUMERIC(12,4),
			pricing_mode VARCHAR(50),
			markup_value NUMERIC(12,4),
			fixed_price NUMERIC(12,4),
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, name)
		)`,
		// Product images
		`CREATE TABLE IF NOT EXISTS product_images (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
			image_url TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		// Product variants
		`CREATE TABLE IF NOT EXISTS product_variants (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
			sku VARCHAR(100) NOT NULL,
			barcode VARCHAR(100),
			unit_id UUID NOT NULL REFERENCES units(id),
			retail_price NUMERIC(12,4) NOT NULL DEFAULT 0,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (product_id, sku)
		)`,
		// Product variant values
		`CREATE TABLE IF NOT EXISTS product_variant_values (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
			variant_value_id UUID NOT NULL REFERENCES variant_values(id),
			UNIQUE (product_variant_id, variant_value_id)
		)`,
		// Product variant images
		`CREATE TABLE IF NOT EXISTS product_variant_images (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
			image_url TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		// Price tiers
		`CREATE TABLE IF NOT EXISTS price_tiers (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			product_id UUID REFERENCES products(id) ON DELETE CASCADE,
			product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
			min_quantity INTEGER NOT NULL,
			price NUMERIC(12,4) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT chk_price_tier_target CHECK (
				(product_id IS NOT NULL AND product_variant_id IS NULL) OR
				(product_id IS NULL AND product_variant_id IS NOT NULL)
			)
		)`,
		// Stock ledger
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_reason') THEN CREATE TYPE stock_reason AS ENUM ('purchase_delivery', 'sale', 'adjustment', 'transfer_in', 'transfer_out'); END IF; END$$`,
		`CREATE TABLE IF NOT EXISTS stock_ledger (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
			product_variant_id UUID NOT NULL REFERENCES product_variants(id),
			warehouse_id UUID NOT NULL REFERENCES warehouses(id),
			quantity NUMERIC(12,4) NOT NULL,
			unit_id UUID NOT NULL REFERENCES units(id),
			reason stock_reason NOT NULL,
			reference_type VARCHAR(50),
			reference_id UUID,
			notes TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
	PurchaseProduct     = uuid.MustParse("10000000-0000-0000-0000-000000000006")
	MasterDataCategory  = uuid.MustParse("10000000-0000-0000-0000-000000000010")
	MasterDataUnit      = uuid.MustParse("10000000-0000-0000-0000-000000000011")
	MasterDataVariant   = uuid.MustParse("10000000-0000-0000-0000-000000000012")
	MasterDataWarehouse = uuid.MustParse("10000000-0000-0000-0000-000000000013")
	MasterDataSupplier  = uuid.MustParse("10000000-0000-0000-0000-000000000014")
	PurchaseOrder       = uuid.MustParse("10000000-0000-0000-0000-000000000015")
	PurchaseDelivery    = uuid.MustParse("10000000-0000-0000-0000-000000000016")
)

func seedFeatures(ctx context.Context, q *sqlc.Queries) error {
	features := []sqlc.UpsertFeatureParams{
		{ID: MasterDataID, Name: "Master Data", Slug: "master-data", Module: "master-data", Actions: nil, SortOrder: 1},
		{ID: MasterDataProduct, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Product", Slug: "master-data.product", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 2},
		{ID: ReportingID, Name: "Reporting", Slug: "reporting", Module: "reporting", Actions: nil, SortOrder: 3},
		{ID: ReportingSales, ParentID: pgtype.UUID{Bytes: ReportingID, Valid: true}, Name: "Sales", Slug: "reporting.sales", Module: "reporting", Actions: []string{"read"}, SortOrder: 4},
		{ID: PurchaseID, Name: "Purchase", Slug: "purchase", Module: "purchase", Actions: nil, SortOrder: 5},
		{ID: PurchaseProduct, ParentID: pgtype.UUID{Bytes: PurchaseID, Valid: true}, Name: "Product", Slug: "purchase.product", Module: "purchase", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 6},
		{ID: MasterDataCategory, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Category", Slug: "master-data.category", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 7},
		{ID: MasterDataUnit, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Unit", Slug: "master-data.unit", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 8},
		{ID: MasterDataVariant, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Variant", Slug: "master-data.variant", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 9},
		{ID: MasterDataWarehouse, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Warehouse", Slug: "master-data.warehouse", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 10},
		{ID: MasterDataSupplier, ParentID: pgtype.UUID{Bytes: MasterDataID, Valid: true}, Name: "Supplier", Slug: "master-data.supplier", Module: "master-data", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 11},
		{ID: PurchaseOrder, ParentID: pgtype.UUID{Bytes: PurchaseID, Valid: true}, Name: "Order", Slug: "purchase.order", Module: "purchase", Actions: []string{"read", "create", "edit", "delete"}, SortOrder: 12},
		{ID: PurchaseDelivery, ParentID: pgtype.UUID{Bytes: PurchaseID, Valid: true}, Name: "Delivery", Slug: "purchase.delivery", Module: "purchase", Actions: []string{"read", "create", "edit"}, SortOrder: 13},
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
