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

type VariantService struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewVariantService(pool *pgxpool.Pool, queries *sqlc.Queries) *VariantService {
	return &VariantService{pool: pool, queries: queries}
}

func (s *VariantService) List(ctx context.Context, tenantID uuid.UUID) ([]model.VariantResponse, error) {
	variants, err := s.queries.GetVariantsByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list variants", err)
	}
	return toVariantResponses(variants), nil
}

func (s *VariantService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.VariantDetailResponse, error) {
	variant, err := s.queries.GetVariantByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get variant", err)
	}

	if variant.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	values, err := s.queries.GetVariantValues(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get variant values", err)
	}

	return &model.VariantDetailResponse{
		VariantResponse: toVariantResponse(variant),
		Values:          toVariantValueResponses(values),
	}, nil
}

func (s *VariantService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateVariantRequest) (*model.VariantDetailResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	variant, err := qtx.CreateVariant(ctx, sqlc.CreateVariantParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a variant with this name already exists")
		}
		return nil, model.InternalError("failed to create variant", err)
	}

	var valueResponses []model.VariantValueResponse
	for _, v := range req.Values {
		vv, err := qtx.CreateVariantValue(ctx, sqlc.CreateVariantValueParams{
			VariantID: variant.ID,
			Value:     v.Value,
			SortOrder: v.SortOrder,
		})
		if err != nil {
			return nil, model.InternalError("failed to create variant value", err)
		}
		valueResponses = append(valueResponses, toVariantValueResponse(vv))
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit variant creation", err)
	}

	if valueResponses == nil {
		valueResponses = []model.VariantValueResponse{}
	}

	return &model.VariantDetailResponse{
		VariantResponse: toVariantResponse(variant),
		Values:          valueResponses,
	}, nil
}

func (s *VariantService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateVariantRequest) (*model.VariantResponse, error) {
	existing, err := s.queries.GetVariantByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get variant", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	variant, err := s.queries.UpdateVariant(ctx, sqlc.UpdateVariantParams{
		ID:          id,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		IsActive:    req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a variant with this name already exists")
		}
		return nil, model.InternalError("failed to update variant", err)
	}

	resp := toVariantResponse(variant)
	return &resp, nil
}

func (s *VariantService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetVariantByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get variant", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateVariant(ctx, id); err != nil {
		return model.InternalError("failed to deactivate variant", err)
	}

	return nil
}

func (s *VariantService) AddValue(ctx context.Context, variantID, tenantID uuid.UUID, req model.CreateVariantValueRequest) (*model.VariantValueResponse, error) {
	variant, err := s.queries.GetVariantByID(ctx, variantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get variant", err)
	}
	if variant.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	vv, err := s.queries.CreateVariantValue(ctx, sqlc.CreateVariantValueParams{
		VariantID: variantID,
		Value:     req.Value,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a value with this name already exists for this variant")
		}
		return nil, model.InternalError("failed to create variant value", err)
	}

	resp := toVariantValueResponse(vv)
	return &resp, nil
}

func (s *VariantService) UpdateValue(ctx context.Context, variantID, valueID, tenantID uuid.UUID, req model.UpdateVariantValueRequest) (*model.VariantValueResponse, error) {
	variant, err := s.queries.GetVariantByID(ctx, variantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get variant", err)
	}
	if variant.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	vv, err := s.queries.UpdateVariantValue(ctx, sqlc.UpdateVariantValueParams{
		ID:        valueID,
		Value:     req.Value,
		SortOrder: req.SortOrder,
		IsActive:  req.IsActive,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a value with this name already exists for this variant")
		}
		return nil, model.InternalError("failed to update variant value", err)
	}

	resp := toVariantValueResponse(vv)
	return &resp, nil
}

func (s *VariantService) DeleteValue(ctx context.Context, variantID, valueID, tenantID uuid.UUID) error {
	variant, err := s.queries.GetVariantByID(ctx, variantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get variant", err)
	}
	if variant.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeleteVariantValue(ctx, valueID); err != nil {
		return model.InternalError("failed to delete variant value", err)
	}

	return nil
}
