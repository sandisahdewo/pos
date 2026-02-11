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

type UserService struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewUserService(pool *pgxpool.Pool, queries *sqlc.Queries) *UserService {
	return &UserService{pool: pool, queries: queries}
}

func (s *UserService) List(ctx context.Context, tenantID uuid.UUID, pg model.PaginationRequest) (*model.PaginatedResponse, error) {
	pg.Normalize()

	total, err := s.queries.CountUsersByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to count users", err)
	}

	users, err := s.queries.GetUsersByTenant(ctx, sqlc.GetUsersByTenantParams{
		TenantID:  tenantID,
		OffsetVal: pg.Offset(),
		LimitVal:  pg.Limit(),
	})
	if err != nil {
		return nil, model.InternalError("failed to list users", err)
	}

	userResponses := make([]model.UserResponse, len(users))
	for i, u := range users {
		userResponses[i] = toUserResponse(u)
	}

	return &model.PaginatedResponse{
		Data:       userResponses,
		Pagination: model.NewPaginationResponse(total, pg.Page, pg.PerPage),
	}, nil
}

func (s *UserService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.UserDetailResponse, error) {
	user, err := s.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get user", err)
	}

	// Tenant isolation
	if user.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	roles, err := s.queries.GetUserRoles(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get user roles", err)
	}

	stores, err := s.queries.GetUserStores(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get user stores", err)
	}

	return &model.UserDetailResponse{
		UserResponse: toUserResponse(user),
		Roles:        toRoleResponses(roles),
		Stores:       toStoreResponses(stores),
	}, nil
}

func (s *UserService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateUserRequest) (*model.UserResponse, error) {
	existing, err := s.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get user", err)
	}
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	user, err := s.queries.UpdateUser(ctx, sqlc.UpdateUserParams{
		ID:        id,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		IsActive:  req.IsActive,
	})
	if err != nil {
		return nil, model.InternalError("failed to update user", err)
	}

	resp := toUserResponse(user)
	return &resp, nil
}

func (s *UserService) Deactivate(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get user", err)
	}
	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if err := s.queries.DeactivateUser(ctx, id); err != nil {
		return model.InternalError("failed to deactivate user", err)
	}

	return nil
}

func (s *UserService) UpdateStores(ctx context.Context, userID, tenantID, assignedBy uuid.UUID, req model.UpdateUserStoresRequest) ([]model.StoreResponse, error) {
	// Verify user belongs to tenant
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get user", err)
	}
	if user.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// Delete all current store assignments
	if err := qtx.DeleteUserStoresByUser(ctx, userID); err != nil {
		return nil, model.InternalError("failed to clear store assignments", err)
	}

	// Assign new stores
	for _, storeID := range req.StoreIDs {
		_, err := qtx.AssignUserStore(ctx, sqlc.AssignUserStoreParams{
			UserID:     userID,
			StoreID:    storeID,
			AssignedBy: pgtype.UUID{Bytes: assignedBy, Valid: true},
		})
		if err != nil {
			return nil, model.InternalError("failed to assign store", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit store assignments", err)
	}

	// Return updated store list
	stores, err := s.queries.GetUserStores(ctx, userID)
	if err != nil {
		return nil, model.InternalError("failed to get updated stores", err)
	}

	return toStoreResponses(stores), nil
}
