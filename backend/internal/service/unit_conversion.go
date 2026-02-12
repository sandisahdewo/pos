package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type UnitConversionService struct {
	queries *sqlc.Queries
}

func NewUnitConversionService(queries *sqlc.Queries) *UnitConversionService {
	return &UnitConversionService{queries: queries}
}

func (s *UnitConversionService) List(ctx context.Context, tenantID uuid.UUID) ([]model.UnitConversionResponse, error) {
	conversions, err := s.queries.GetUnitConversionsByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list unit conversions", err)
	}
	return toUnitConversionResponses(conversions), nil
}

func (s *UnitConversionService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.UnitConversionResponse, error) {
	uc, err := s.queries.GetUnitConversionByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get unit conversion", err)
	}

	if uc.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	// Fetch unit names for the response
	fromUnit, err := s.queries.GetUnitByID(ctx, uc.FromUnitID)
	if err != nil {
		return nil, model.InternalError("failed to get from unit", err)
	}
	toUnit, err := s.queries.GetUnitByID(ctx, uc.ToUnitID)
	if err != nil {
		return nil, model.InternalError("failed to get to unit", err)
	}

	resp := model.UnitConversionResponse{
		ID:               uc.ID,
		TenantID:         uc.TenantID,
		FromUnitID:       uc.FromUnitID,
		ToUnitID:         uc.ToUnitID,
		FromUnitName:     fromUnit.Name,
		ToUnitName:       toUnit.Name,
		ConversionFactor: numericToFloat64(uc.ConversionFactor),
		CreatedAt:        uc.CreatedAt.Time,
		UpdatedAt:        uc.UpdatedAt.Time,
	}
	return &resp, nil
}

func (s *UnitConversionService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateUnitConversionRequest) (*model.UnitConversionResponse, error) {
	if req.FromUnitID == req.ToUnitID {
		return nil, model.ValidationError("from_unit_id and to_unit_id must be different")
	}

	uc, err := s.queries.CreateUnitConversion(ctx, sqlc.CreateUnitConversionParams{
		TenantID:         tenantID,
		FromUnitID:       req.FromUnitID,
		ToUnitID:         req.ToUnitID,
		ConversionFactor: float64ToNumeric(req.ConversionFactor),
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a conversion between these units already exists")
		}
		return nil, model.InternalError("failed to create unit conversion", err)
	}

	// Fetch unit names for the response
	fromUnit, err := s.queries.GetUnitByID(ctx, uc.FromUnitID)
	if err != nil {
		return nil, model.InternalError("failed to get from unit", err)
	}
	toUnit, err := s.queries.GetUnitByID(ctx, uc.ToUnitID)
	if err != nil {
		return nil, model.InternalError("failed to get to unit", err)
	}

	resp := model.UnitConversionResponse{
		ID:               uc.ID,
		TenantID:         uc.TenantID,
		FromUnitID:       uc.FromUnitID,
		ToUnitID:         uc.ToUnitID,
		FromUnitName:     fromUnit.Name,
		ToUnitName:       toUnit.Name,
		ConversionFactor: numericToFloat64(uc.ConversionFactor),
		CreatedAt:        uc.CreatedAt.Time,
		UpdatedAt:        uc.UpdatedAt.Time,
	}
	return &resp, nil
}

func (s *UnitConversionService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateUnitConversionRequest) (*model.UnitConversionResponse, error) {
	if req.FromUnitID == req.ToUnitID {
		return nil, model.ValidationError("from_unit_id and to_unit_id must be different")
	}

	existing, err := s.queries.GetUnitConversionByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get unit conversion", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	uc, err := s.queries.UpdateUnitConversion(ctx, sqlc.UpdateUnitConversionParams{
		ID:               id,
		FromUnitID:       req.FromUnitID,
		ToUnitID:         req.ToUnitID,
		ConversionFactor: float64ToNumeric(req.ConversionFactor),
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a conversion between these units already exists")
		}
		return nil, model.InternalError("failed to update unit conversion", err)
	}

	// Fetch unit names for the response
	fromUnit, err := s.queries.GetUnitByID(ctx, uc.FromUnitID)
	if err != nil {
		return nil, model.InternalError("failed to get from unit", err)
	}
	toUnit, err := s.queries.GetUnitByID(ctx, uc.ToUnitID)
	if err != nil {
		return nil, model.InternalError("failed to get to unit", err)
	}

	resp := model.UnitConversionResponse{
		ID:               uc.ID,
		TenantID:         uc.TenantID,
		FromUnitID:       uc.FromUnitID,
		ToUnitID:         uc.ToUnitID,
		FromUnitName:     fromUnit.Name,
		ToUnitName:       toUnit.Name,
		ConversionFactor: numericToFloat64(uc.ConversionFactor),
		CreatedAt:        uc.CreatedAt.Time,
		UpdatedAt:        uc.UpdatedAt.Time,
	}
	return &resp, nil
}

func (s *UnitConversionService) Delete(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetUnitConversionByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get unit conversion", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeleteUnitConversion(ctx, id); err != nil {
		return model.InternalError("failed to delete unit conversion", err)
	}

	return nil
}
