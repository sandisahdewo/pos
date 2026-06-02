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

	if err := seedTaxRates(ctx, bundb); err != nil {
		log.Fatalf("seed tax rates: %v", err)
	}
	if err := seedRoles(ctx, bundb); err != nil {
		log.Fatalf("seed roles: %v", err)
	}
	if err := seedUnits(ctx, bundb); err != nil {
		log.Fatalf("seed units: %v", err)
	}
	if err := seedTags(ctx, bundb); err != nil {
		log.Fatalf("seed tags: %v", err)
	}
	if err := seedBrands(ctx, bundb); err != nil {
		log.Fatalf("seed brands: %v", err)
	}
	if err := seedLocations(ctx, bundb); err != nil {
		log.Fatalf("seed locations: %v", err)
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

// Seed tax_rates using TEXT IDs that match the frontend convention so seed
// products (still in frontend) can resolve via their hardcoded IDs.
var systemTaxRates = []models.TaxRate{
	{
		ID:          "tax_ppn11",
		Name:        "PPN 11%",
		Rate:        11,
		Description: "Standard Indonesian VAT (Pajak Pertambahan Nilai).",
		IsDefault:   true,
	},
	{
		ID:          "tax_exempt",
		Name:        "Tax-exempt",
		Rate:        0,
		Description: "Items exempt from PPN (e.g., basic foodstuffs per UU HPP).",
	},
	{
		ID:          "tax_zero",
		Name:        "Zero-rated",
		Rate:        0,
		Description: "Zero-rated for export goods and certain services.",
	},
}

func seedTaxRates(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// Clear is_default on all rows first so the partial unique index won't
		// fire when re-asserting the seed's choice of default.
		if _, err := tx.NewUpdate().Table("tax_rates").
			Set("is_default = false").
			Where("is_default = true").
			Exec(ctx); err != nil {
			return err
		}
		for _, tr := range systemTaxRates {
			t := tr // local copy
			_, err := tx.NewInsert().
				Model(&t).
				On("CONFLICT (id) DO UPDATE").
				Set("name = EXCLUDED.name").
				Set("rate = EXCLUDED.rate").
				Set("description = EXCLUDED.description").
				Set("is_default = EXCLUDED.is_default").
				Set("updated_at = current_timestamp").
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("upsert tax rate %s: %w", t.ID, err)
			}
		}
		return nil
	})
}

// seedUnits inserts common units of measure if missing. Idempotent via the
// UNIQUE constraint on `code`.
var systemUnits = []models.Unit{
	{Name: "Pcs", Code: "pcs", Description: "Dijual satuan."},
	{Name: "Box", Code: "box", Description: "Dikemas dalam box (jumlah bervariasi)."},
	{Name: "Kilogram", Code: "kg", Description: "1.000 gram berdasarkan berat."},
	{Name: "Gram", Code: "g", Description: "Satu gram berdasarkan berat."},
	{Name: "Liter", Code: "L", Description: "1.000 mililiter berdasarkan volume."},
	{Name: "Mililiter", Code: "mL", Description: "Seperseribu liter."},
	{Name: "Lusin", Code: "lusin", Description: "Satuan tradisional 12 pcs."},
	{Name: "Kodi", Code: "kodi", Description: "Satuan tradisional 20 pcs."},
	{Name: "Gross", Code: "gross", Description: "Satuan tradisional 144 pcs (12 lusin)."},
	{Name: "Batang", Code: "btg", Description: "Satuan rokok terkecil — satu batang."},
	{Name: "Bungkus", Code: "bks", Description: "Pak rokok. Isi bervariasi per merek (mis. 12, 16, 20 batang)."},
	{Name: "Slop", Code: "slop", Description: "Karton rokok berisi 10 bungkus."},
}

func seedUnits(ctx context.Context, db *bun.DB) error {
	for _, u := range systemUnits {
		row := u
		_, err := db.NewInsert().Model(&row).
			On("CONFLICT (code) DO UPDATE").
			Set("name = EXCLUDED.name").
			Set("description = EXCLUDED.description").
			Set("updated_at = current_timestamp").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("upsert unit %s: %w", u.Code, err)
		}
	}
	return nil
}

// seedTags inserts the well-known tags used by demo product seed. Idempotent
// via UNIQUE on `name` — admins can edit color/description via UI afterwards.
var systemTags = []models.Tag{
	{Name: "Baru", Color: "brand", PublicVisible: true, Description: "Produk baru masuk katalog."},
	{Name: "Best Seller", Color: "success", PublicVisible: true, Description: "Produk paling sering laku."},
	{Name: "Halal", Color: "success", PublicVisible: true, Description: "Bersertifikat MUI Halal."},
	{Name: "Promo", Color: "warning", PublicVisible: true, Description: "Sedang dalam program promo."},
	{Name: "Lokal", Color: "info", PublicVisible: true, Description: "Produk lokal / UMKM."},
}

func seedTags(ctx context.Context, db *bun.DB) error {
	for _, t := range systemTags {
		row := t
		_, err := db.NewInsert().Model(&row).
			On("CONFLICT (name) DO UPDATE").
			Set("color = EXCLUDED.color").
			Set("public_visible = EXCLUDED.public_visible").
			Set("description = EXCLUDED.description").
			Set("updated_at = current_timestamp").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("upsert tag %s: %w", t.Name, err)
		}
	}
	return nil
}

// seedBrands inserts common consumer brand records — admin can extend via UI.
// Idempotent via UNIQUE on `slug`.
var systemBrands = []models.Brand{
	{Name: "Indofood", Slug: "indofood", Description: "Mie instan, bumbu, dan produk konsumen masal.", Status: models.BrandStatusActive},
	{Name: "Aqua", Slug: "aqua", Description: "Air minum dalam kemasan.", Status: models.BrandStatusActive},
	{Name: "Coca-Cola", Slug: "coca-cola", Description: "Minuman berkarbonasi.", Status: models.BrandStatusActive},
	{Name: "Sampoerna", Slug: "sampoerna", Description: "Pabrik rokok kretek dan filter.", Status: models.BrandStatusActive},
	{Name: "Djarum", Slug: "djarum", Description: "Pabrik rokok kretek.", Status: models.BrandStatusActive},
}

func seedBrands(ctx context.Context, db *bun.DB) error {
	for _, b := range systemBrands {
		row := b
		_, err := db.NewInsert().Model(&row).
			On("CONFLICT (slug) DO UPDATE").
			Set("name = EXCLUDED.name").
			Set("description = EXCLUDED.description").
			Set("status = EXCLUDED.status").
			Set("updated_at = current_timestamp").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("upsert brand %s: %w", b.Slug, err)
		}
	}
	return nil
}

// seedLocations inserts the three standard storage locations: shelf, rack,
// warehouse. Idempotent via UNIQUE on `slug`. The default-receipt flag is
// asserted in a tx that first demotes any other default so the partial
// unique index doesn't fire.
var systemLocations = []models.Location{
	{
		Name: "Etalase", Slug: "etalase", Kind: models.LocationKindShelf,
		CustomerVisible: true, IsDefaultReceipt: false, DisplayOrder: 1,
		Description: "Produk yang dipajang di depan — pelanggan bisa ambil sendiri.",
		Status:      models.LocationStatusActive,
	},
	{
		Name: "Rak Belakang", Slug: "rak-belakang", Kind: models.LocationKindRack,
		CustomerVisible: false, IsDefaultReceipt: false, DisplayOrder: 2,
		Description: "Stok di belakang kasir — pelanggan minta, kasir ambilkan.",
		Status:      models.LocationStatusActive,
	},
	{
		Name: "Gudang", Slug: "gudang", Kind: models.LocationKindWarehouse,
		CustomerVisible: false, IsDefaultReceipt: true, DisplayOrder: 3,
		Description: "Penyimpanan bulk — tidak diakses pelanggan.",
		Status:      models.LocationStatusActive,
	},
}

func seedLocations(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		// Demote all defaults first so the partial unique index won't fire.
		if _, err := tx.NewUpdate().Table("locations").
			Set("is_default_receipt = false").
			Where("is_default_receipt = true").
			Exec(ctx); err != nil {
			return err
		}
		for _, l := range systemLocations {
			row := l
			_, err := tx.NewInsert().Model(&row).
				On("CONFLICT (slug) DO UPDATE").
				Set("name = EXCLUDED.name").
				Set("kind = EXCLUDED.kind").
				Set("customer_visible = EXCLUDED.customer_visible").
				Set("is_default_receipt = EXCLUDED.is_default_receipt").
				Set("display_order = EXCLUDED.display_order").
				Set("description = EXCLUDED.description").
				Set("status = EXCLUDED.status").
				Set("updated_at = current_timestamp").
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("upsert location %s: %w", l.Slug, err)
			}
		}
		return nil
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
