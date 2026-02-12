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

type SupplierService struct {
	queries *sqlc.Queries
}

func NewSupplierService(queries *sqlc.Queries) *SupplierService {
	return &SupplierService{queries: queries}
}

func (s *SupplierService) List(ctx context.Context, tenantID uuid.UUID) ([]model.SupplierResponse, error) {
	suppliers, err := s.queries.GetSuppliersByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list suppliers", err)
	}
	return toSupplierResponses(suppliers), nil
}

func (s *SupplierService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.SupplierResponse, error) {
	supplier, err := s.queries.GetSupplierByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get supplier", err)
	}

	if supplier.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	resp := toSupplierResponse(supplier)
	return &resp, nil
}

func (s *SupplierService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateSupplierRequest) (*model.SupplierResponse, error) {
	supplier, err := s.queries.CreateSupplier(ctx, sqlc.CreateSupplierParams{
		TenantID:    tenantID,
		Name:        req.Name,
		ContactName: pgtype.Text{String: req.ContactName, Valid: req.ContactName != ""},
		Email:       pgtype.Text{String: req.Email, Valid: req.Email != ""},
		Phone:       pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
		Address:     pgtype.Text{String: req.Address, Valid: req.Address != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a supplier with this name already exists")
		}
		return nil, model.InternalError("failed to create supplier", err)
	}

	resp := toSupplierResponse(supplier)
	return &resp, nil
}

func (s *SupplierService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateSupplierRequest) (*model.SupplierResponse, error) {
	existing, err := s.queries.GetSupplierByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get supplier", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	supplier, err := s.queries.UpdateSupplier(ctx, sqlc.UpdateSupplierParams{
		ID:          id,
		Name:        req.Name,
		ContactName: pgtype.Text{String: req.ContactName, Valid: req.ContactName != ""},
		Email:       pgtype.Text{String: req.Email, Valid: req.Email != ""},
		Phone:       pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
		Address:     pgtype.Text{String: req.Address, Valid: req.Address != ""},
		IsActive:    req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a supplier with this name already exists")
		}
		return nil, model.InternalError("failed to update supplier", err)
	}

	resp := toSupplierResponse(supplier)
	return &resp, nil
}

func (s *SupplierService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetSupplierByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get supplier", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateSupplier(ctx, id); err != nil {
		return model.InternalError("failed to deactivate supplier", err)
	}

	return nil
}
