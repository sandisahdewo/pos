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
	masterDataID      = uuid.MustParse("10000000-0000-0000-0000-000000000001")
	masterDataProduct = uuid.MustParse("10000000-0000-0000-0000-000000000002")
	reportingID       = uuid.MustParse("10000000-0000-0000-0000-000000000003")
	reportingSales    = uuid.MustParse("10000000-0000-0000-0000-000000000004")
	purchaseID        = uuid.MustParse("10000000-0000-0000-0000-000000000005")
	purchaseProduct   = uuid.MustParse("10000000-0000-0000-0000-000000000006")
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
