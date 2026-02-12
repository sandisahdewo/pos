package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type CategoryService struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewCategoryService(pool *pgxpool.Pool, queries *sqlc.Queries) *CategoryService {
	return &CategoryService{pool: pool, queries: queries}
}

func (s *CategoryService) List(ctx context.Context, tenantID uuid.UUID) ([]model.CategoryResponse, error) {
	categories, err := s.queries.GetCategoriesByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list categories", err)
	}
	return toCategoryResponses(categories), nil
}

func (s *CategoryService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.CategoryDetailResponse, error) {
	category, err := s.queries.GetCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get category", err)
	}

	if category.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	units, err := s.queries.GetCategoryUnits(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get category units", err)
	}

	variants, err := s.queries.GetCategoryVariants(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get category variants", err)
	}

	return &model.CategoryDetailResponse{
		CategoryResponse: toCategoryResponse(category),
		Units:            toUnitResponses(units),
		Variants:         toVariantResponses(variants),
	}, nil
}

func (s *CategoryService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateCategoryRequest) (*model.CategoryResponse, error) {
	// markup_value must be NULL when pricing_mode is NULL (DB check constraint)
	var markupValue pgtype.Numeric
	if req.PricingMode != "" {
		markupValue = float64ToNumeric(req.MarkupValue)
	}
	category, err := s.queries.CreateCategory(ctx, sqlc.CreateCategoryParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		PricingMode: pgtype.Text{String: req.PricingMode, Valid: req.PricingMode != ""},
		MarkupValue: markupValue,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a category with this name already exists")
		}
		return nil, model.InternalError("failed to create category", err)
	}

	resp := toCategoryResponse(category)
	return &resp, nil
}

func (s *CategoryService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateCategoryRequest) (*model.CategoryResponse, error) {
	existing, err := s.queries.GetCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get category", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	// markup_value must be NULL when pricing_mode is NULL (DB check constraint)
	var markupValue pgtype.Numeric
	if req.PricingMode != "" {
		markupValue = float64ToNumeric(req.MarkupValue)
	}
	category, err := s.queries.UpdateCategory(ctx, sqlc.UpdateCategoryParams{
		ID:          id,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		PricingMode: pgtype.Text{String: req.PricingMode, Valid: req.PricingMode != ""},
		MarkupValue: markupValue,
		IsActive:    req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a category with this name already exists")
		}
		return nil, model.InternalError("failed to update category", err)
	}

	resp := toCategoryResponse(category)
	return &resp, nil
}

func (s *CategoryService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get category", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateCategory(ctx, id); err != nil {
		return model.InternalError("failed to deactivate category", err)
	}

	return nil
}

func (s *CategoryService) UpdateUnits(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateCategoryUnitsRequest) ([]model.UnitResponse, error) {
	existing, err := s.queries.GetCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get category", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.DeleteCategoryUnits(ctx, id); err != nil {
		return nil, model.InternalError("failed to clear category units", err)
	}

	for _, unitID := range req.UnitIDs {
		if err := qtx.AddCategoryUnit(ctx, sqlc.AddCategoryUnitParams{
			CategoryID: id,
			UnitID:     unitID,
		}); err != nil {
			return nil, model.InternalError("failed to add unit to category", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit category units update", err)
	}

	units, err := s.queries.GetCategoryUnits(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get updated category units", err)
	}

	return toUnitResponses(units), nil
}

func (s *CategoryService) UpdateVariants(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateCategoryVariantsRequest) ([]model.VariantResponse, error) {
	existing, err := s.queries.GetCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get category", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.DeleteCategoryVariants(ctx, id); err != nil {
		return nil, model.InternalError("failed to clear category variants", err)
	}

	for _, variantID := range req.VariantIDs {
		if err := qtx.AddCategoryVariant(ctx, sqlc.AddCategoryVariantParams{
			CategoryID: id,
			VariantID:  variantID,
		}); err != nil {
			return nil, model.InternalError("failed to add variant to category", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit category variants update", err)
	}

	variants, err := s.queries.GetCategoryVariants(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get updated category variants", err)
	}

	return toVariantResponses(variants), nil
}
