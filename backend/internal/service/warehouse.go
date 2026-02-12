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

type WarehouseService struct {
	queries *sqlc.Queries
}

func NewWarehouseService(queries *sqlc.Queries) *WarehouseService {
	return &WarehouseService{queries: queries}
}

func (s *WarehouseService) List(ctx context.Context, tenantID uuid.UUID) ([]model.WarehouseResponse, error) {
	warehouses, err := s.queries.GetWarehousesByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list warehouses", err)
	}
	return toWarehouseResponses(warehouses), nil
}

func (s *WarehouseService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.WarehouseResponse, error) {
	warehouse, err := s.queries.GetWarehouseByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get warehouse", err)
	}

	if warehouse.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	resp := toWarehouseResponse(warehouse)
	return &resp, nil
}

func (s *WarehouseService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateWarehouseRequest) (*model.WarehouseResponse, error) {
	warehouse, err := s.queries.CreateWarehouse(ctx, sqlc.CreateWarehouseParams{
		TenantID: tenantID,
		Name:     req.Name,
		Address:  pgtype.Text{String: req.Address, Valid: req.Address != ""},
		Phone:    pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a warehouse with this name already exists")
		}
		return nil, model.InternalError("failed to create warehouse", err)
	}

	resp := toWarehouseResponse(warehouse)
	return &resp, nil
}

func (s *WarehouseService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateWarehouseRequest) (*model.WarehouseResponse, error) {
	existing, err := s.queries.GetWarehouseByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get warehouse", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	warehouse, err := s.queries.UpdateWarehouse(ctx, sqlc.UpdateWarehouseParams{
		ID:       id,
		Name:     req.Name,
		Address:  pgtype.Text{String: req.Address, Valid: req.Address != ""},
		Phone:    pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
		IsActive: req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a warehouse with this name already exists")
		}
		return nil, model.InternalError("failed to update warehouse", err)
	}

	resp := toWarehouseResponse(warehouse)
	return &resp, nil
}

func (s *WarehouseService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetWarehouseByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get warehouse", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateWarehouse(ctx, id); err != nil {
		return model.InternalError("failed to deactivate warehouse", err)
	}

	return nil
}
