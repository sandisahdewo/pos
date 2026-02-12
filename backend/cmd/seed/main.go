package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"pos/internal/config"
	"pos/internal/database"
	"pos/internal/database/sqlc"
)

// Predefined UUIDs for features so they are stable across seeds.
var (
	masterDataID        = uuid.MustParse("10000000-0000-0000-0000-000000000001")
	masterDataProduct   = uuid.MustParse("10000000-0000-0000-0000-000000000002")
	reportingID         = uuid.MustParse("10000000-0000-0000-0000-000000000003")
	reportingSales      = uuid.MustParse("10000000-0000-0000-0000-000000000004")
	purchaseID          = uuid.MustParse("10000000-0000-0000-0000-000000000005")
	purchaseProduct     = uuid.MustParse("10000000-0000-0000-0000-000000000006")
	masterDataCategory  = uuid.MustParse("10000000-0000-0000-0000-000000000010")
	masterDataUnit      = uuid.MustParse("10000000-0000-0000-0000-000000000011")
	masterDataVariant   = uuid.MustParse("10000000-0000-0000-0000-000000000012")
	masterDataWarehouse = uuid.MustParse("10000000-0000-0000-0000-000000000013")
	masterDataSupplier  = uuid.MustParse("10000000-0000-0000-0000-000000000014")
	purchaseOrder       = uuid.MustParse("10000000-0000-0000-0000-000000000015")
	purchaseDelivery    = uuid.MustParse("10000000-0000-0000-0000-000000000016")
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	var logHandler slog.Handler
	if cfg.IsDevelopment() {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	} else {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	slog.SetDefault(slog.New(logHandler))

	ctx := context.Background()
	pool, err := database.NewPool(ctx, cfg.DB)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	queries := sqlc.New(pool)

	features := []sqlc.UpsertFeatureParams{
		// Parent: Master Data
		{
			ID:        masterDataID,
			Name:      "Master Data",
			Slug:      "master-data",
			Module:    "master-data",
			Actions:   []string{},
			SortOrder: 1,
		},
		// Child: Master Data > Product
		{
			ID:        masterDataProduct,
			ParentID:  pgtype.UUID{Bytes: masterDataID, Valid: true},
			Name:      "Product",
			Slug:      "master-data.product",
			Module:    "master-data",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 2,
		},
		// Parent: Reporting
		{
			ID:        reportingID,
			Name:      "Reporting",
			Slug:      "reporting",
			Module:    "reporting",
			Actions:   []string{},
			SortOrder: 3,
		},
		// Child: Reporting > Sales
		{
			ID:        reportingSales,
			ParentID:  pgtype.UUID{Bytes: reportingID, Valid: true},
			Name:      "Sales",
			Slug:      "reporting.sales",
			Module:    "reporting",
			Actions:   []string{"read"},
			SortOrder: 4,
		},
		// Parent: Purchase
		{
			ID:        purchaseID,
			Name:      "Purchase",
			Slug:      "purchase",
			Module:    "purchase",
			Actions:   []string{},
			SortOrder: 5,
		},
		// Child: Purchase > Product
		{
			ID:        purchaseProduct,
			ParentID:  pgtype.UUID{Bytes: purchaseID, Valid: true},
			Name:      "Product",
			Slug:      "purchase.product",
			Module:    "purchase",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 6,
		},
		// Child: Master Data > Category
		{
			ID:        masterDataCategory,
			ParentID:  pgtype.UUID{Bytes: masterDataID, Valid: true},
			Name:      "Category",
			Slug:      "master-data.category",
			Module:    "master-data",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 7,
		},
		// Child: Master Data > Unit
		{
			ID:        masterDataUnit,
			ParentID:  pgtype.UUID{Bytes: masterDataID, Valid: true},
			Name:      "Unit",
			Slug:      "master-data.unit",
			Module:    "master-data",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 8,
		},
		// Child: Master Data > Variant
		{
			ID:        masterDataVariant,
			ParentID:  pgtype.UUID{Bytes: masterDataID, Valid: true},
			Name:      "Variant",
			Slug:      "master-data.variant",
			Module:    "master-data",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 9,
		},
		// Child: Master Data > Warehouse
		{
			ID:        masterDataWarehouse,
			ParentID:  pgtype.UUID{Bytes: masterDataID, Valid: true},
			Name:      "Warehouse",
			Slug:      "master-data.warehouse",
			Module:    "master-data",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 10,
		},
		// Child: Master Data > Supplier
		{
			ID:        masterDataSupplier,
			ParentID:  pgtype.UUID{Bytes: masterDataID, Valid: true},
			Name:      "Supplier",
			Slug:      "master-data.supplier",
			Module:    "master-data",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 11,
		},
		// Child: Purchase > Order
		{
			ID:        purchaseOrder,
			ParentID:  pgtype.UUID{Bytes: purchaseID, Valid: true},
			Name:      "Order",
			Slug:      "purchase.order",
			Module:    "purchase",
			Actions:   []string{"read", "create", "edit", "delete"},
			SortOrder: 12,
		},
		// Child: Purchase > Delivery
		{
			ID:        purchaseDelivery,
			ParentID:  pgtype.UUID{Bytes: purchaseID, Valid: true},
			Name:      "Delivery",
			Slug:      "purchase.delivery",
			Module:    "purchase",
			Actions:   []string{"read", "create", "edit"},
			SortOrder: 13,
		},
	}

	for _, f := range features {
		_, err := queries.UpsertFeature(ctx, f)
		if err != nil {
			slog.Error("failed to upsert feature", "slug", f.Slug, "error", err)
			os.Exit(1)
		}
		slog.Info("seeded feature", "slug", f.Slug)
	}

	slog.Info("seed completed successfully")
}
