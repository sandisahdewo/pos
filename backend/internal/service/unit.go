package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type UnitService struct {
	queries *sqlc.Queries
}

func NewUnitService(queries *sqlc.Queries) *UnitService {
	return &UnitService{queries: queries}
}

func (s *UnitService) List(ctx context.Context, tenantID uuid.UUID) ([]model.UnitResponse, error) {
	units, err := s.queries.GetUnitsByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list units", err)
	}
	return toUnitResponses(units), nil
}

func (s *UnitService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.UnitResponse, error) {
	unit, err := s.queries.GetUnitByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get unit", err)
	}

	if unit.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	resp := toUnitResponse(unit)
	return &resp, nil
}

func (s *UnitService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateUnitRequest) (*model.UnitResponse, error) {
	unit, err := s.queries.CreateUnit(ctx, sqlc.CreateUnitParams{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a unit with this name already exists")
		}
		return nil, model.InternalError("failed to create unit", err)
	}

	resp := toUnitResponse(unit)
	return &resp, nil
}

func (s *UnitService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateUnitRequest) (*model.UnitResponse, error) {
	existing, err := s.queries.GetUnitByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get unit", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	unit, err := s.queries.UpdateUnit(ctx, sqlc.UpdateUnitParams{
		ID:          id,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		IsActive:    req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a unit with this name already exists")
		}
		return nil, model.InternalError("failed to update unit", err)
	}

	resp := toUnitResponse(unit)
	return &resp, nil
}

func (s *UnitService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetUnitByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get unit", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateUnit(ctx, id); err != nil {
		return model.InternalError("failed to deactivate unit", err)
	}

	return nil
}
