package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/sandisahdewo/pos/backend/internal/config"
	"github.com/sandisahdewo/pos/backend/internal/db"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

// Idempotent seed:
//  1. Upserts system roles + their permission sets.
//  2. Upserts the admin user.
//  3. Assigns the Admin role to the admin user.
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

	ctx := context.Background()

	if err := seedRoles(ctx, bundb); err != nil {
		log.Fatalf("seed roles: %v", err)
	}

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
		Status:       models.UserStatusActive,
	}
	_, err = bundb.NewInsert().
		Model(user).
		On("CONFLICT (email) DO UPDATE").
		Set("password_hash = EXCLUDED.password_hash").
		Set("name = EXCLUDED.name").
		Set("status = EXCLUDED.status").
		Set("updated_at = current_timestamp").
		Returning("*").
		Exec(ctx)
	if err != nil {
		log.Fatalf("upsert user: %v", err)
	}

	// Look up the Admin role we just (or previously) seeded and ensure the
	// admin user is assigned to it. Idempotent via PK conflict on user_roles.
	var adminRole models.Role
	if err := bundb.NewSelect().Model(&adminRole).Where("name = ?", "Admin").Scan(ctx); err != nil {
		log.Fatalf("find Admin role: %v", err)
	}
	_, err = bundb.NewInsert().
		Model(&models.UserRole{UserID: user.ID, RoleID: adminRole.ID}).
		On("CONFLICT (user_id, role_id) DO NOTHING").
		Exec(ctx)
	if err != nil {
		log.Fatalf("assign admin role: %v", err)
	}

	fmt.Printf("admin seeded: %s (id=%s)\n", user.Email, user.ID)
}

// systemRoles defines the canonical role names + permission sets. Mirrors the
// frontend seed (frontend/src/lib/stores/roles.svelte.ts) — operator can edit
// the description in the UI; name + permissions are locked once seeded.
var systemRoles = []struct {
	name        string
	description string
	permissions []string
}{
	{
		name:        "Admin",
		description: "Akses penuh ke seluruh sistem, termasuk pengaturan peran.",
		permissions: []string{models.WildcardPermission},
	},
	{
		name:        "Manajer",
		description: "Mengelola operasional toko, produk, promo, dan laporan.",
		permissions: []string{
			"menu.dashboard", "menu.pos", "menu.orders", "feature.orders.refund",
			"menu.promotions", "feature.promotions.manage", "menu.shifts",
			"menu.employees", "menu.suppliers", "menu.categories", "menu.brands",
			"menu.tags", "menu.units", "menu.products", "menu.pricelists",
			"menu.pricing", "menu.taxes", "menu.locations", "menu.purchase-orders",
			"menu.payouts", "menu.inventory", "menu.production", "menu.stock-opname",
			"menu.customers", "menu.reports", "menu.reports.laba", "menu.forecast",
			"menu.price-history", "menu.supplier-prices", "menu.stock-movements",
		},
	},
	{
		name:        "Kasir",
		description: "Operasional kasir, pesanan, dan pelanggan harian.",
		permissions: []string{
			"menu.dashboard", "menu.pos", "menu.orders", "menu.shifts",
			"menu.customers", "menu.promotions",
		},
	},
	{
		name:        "Staf",
		description: "Akses dasar: melihat beranda dan pesanan.",
		permissions: []string{"menu.dashboard", "menu.orders"},
	},
	{
		name:        "Akuntan",
		description: "Keuangan, utang/piutang, dan laporan laba rugi.",
		permissions: []string{
			"menu.dashboard", "menu.orders", "menu.purchase-orders", "menu.payouts",
			"menu.utang", "menu.piutang", "menu.reports", "menu.reports.laba",
			"menu.price-history", "menu.supplier-prices", "menu.taxes",
		},
	},
	{
		name:        "Gudang",
		description: "Inventaris, opname, produksi, dan riwayat stok.",
		permissions: []string{
			"menu.dashboard", "menu.inventory", "menu.production", "menu.stock-opname",
			"menu.suppliers", "menu.purchase-orders", "menu.products", "menu.categories",
			"menu.brands", "menu.units", "menu.locations", "menu.stock-movements",
			"menu.forecast",
		},
	},
}

func seedRoles(ctx context.Context, db *bun.DB) error {
	for _, sr := range systemRoles {
		role := &models.Role{
			Name:        sr.name,
			Description: sr.description,
			IsSystem:    true,
		}
		_, err := db.NewInsert().
			Model(role).
			On("CONFLICT (name) DO UPDATE").
			Set("description = EXCLUDED.description").
			Set("is_system = EXCLUDED.is_system").
			Set("updated_at = current_timestamp").
			Returning("*").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("upsert role %s: %w", sr.name, err)
		}
		// Reset role's permission rows to match the canonical list. Safe to
		// re-run: tx wipes + inserts.
		if err := resetRolePermissions(ctx, db, role.ID, sr.permissions); err != nil {
			return fmt.Errorf("reset permissions for %s: %w", sr.name, err)
		}
	}
	return nil
}

func resetRolePermissions(ctx context.Context, db *bun.DB, roleID uuid.UUID, perms []string) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().
			Model((*models.RolePermission)(nil)).
			Where("role_id = ?", roleID).
			Exec(ctx); err != nil {
			return err
		}
		if len(perms) == 0 {
			return nil
		}
		rows := make([]models.RolePermission, len(perms))
		for i, p := range perms {
			rows[i] = models.RolePermission{RoleID: roleID, Permission: p}
		}
		_, err := tx.NewInsert().Model(&rows).Exec(ctx)
		return err
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
