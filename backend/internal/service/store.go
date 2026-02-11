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

type StoreService struct {
	queries *sqlc.Queries
}

func NewStoreService(queries *sqlc.Queries) *StoreService {
	return &StoreService{queries: queries}
}

func (s *StoreService) List(ctx context.Context, tenantID uuid.UUID, userStoreIDs []uuid.UUID, allAccess bool) ([]model.StoreResponse, error) {
	stores, err := s.queries.GetStoresByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list stores", err)
	}

	if !allAccess && userStoreIDs != nil {
		allowed := make(map[uuid.UUID]bool, len(userStoreIDs))
		for _, id := range userStoreIDs {
			allowed[id] = true
		}
		filtered := make([]sqlc.Store, 0)
		for _, st := range stores {
			if allowed[st.ID] {
				filtered = append(filtered, st)
			}
		}
		stores = filtered
	}

	return toStoreResponses(stores), nil
}

func (s *StoreService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.StoreResponse, error) {
	store, err := s.queries.GetStoreByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get store", err)
	}

	// Tenant isolation check
	if store.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	resp := toStoreResponse(store)
	return &resp, nil
}

func (s *StoreService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateStoreRequest) (*model.StoreResponse, error) {
	store, err := s.queries.CreateStore(ctx, sqlc.CreateStoreParams{
		TenantID: tenantID,
		Name:     req.Name,
		Address:  pgtype.Text{String: req.Address, Valid: req.Address != ""},
		Phone:    pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a store with this name already exists in your tenant")
		}
		return nil, model.InternalError("failed to create store", err)
	}

	resp := toStoreResponse(store)
	return &resp, nil
}

func (s *StoreService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateStoreRequest) (*model.StoreResponse, error) {
	// Tenant isolation check
	existing, err := s.queries.GetStoreByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get store", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	store, err := s.queries.UpdateStore(ctx, sqlc.UpdateStoreParams{
		ID:       id,
		Name:     req.Name,
		Address:  pgtype.Text{String: req.Address, Valid: req.Address != ""},
		Phone:    pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
		IsActive: req.IsActive,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a store with this name already exists in your tenant")
		}
		return nil, model.InternalError("failed to update store", err)
	}

	resp := toStoreResponse(store)
	return &resp, nil
}

func (s *StoreService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	// Tenant isolation check
	existing, err := s.queries.GetStoreByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get store", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateStore(ctx, id); err != nil {
		return model.InternalError("failed to deactivate store", err)
	}

	return nil
}
