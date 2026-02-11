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

type RoleService struct {
	pool    *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRoleService(pool *pgxpool.Pool, queries *sqlc.Queries) *RoleService {
	return &RoleService{pool: pool, queries: queries}
}

func (s *RoleService) List(ctx context.Context, tenantID uuid.UUID) ([]model.RoleResponse, error) {
	roles, err := s.queries.GetRolesByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list roles", err)
	}
	return toRoleResponses(roles), nil
}

func (s *RoleService) GetByID(ctx context.Context, id, tenantID uuid.UUID) (*model.RoleDetailResponse, error) {
	role, err := s.queries.GetRoleByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get role", err)
	}

	// Tenant isolation check
	if role.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	perms, err := s.queries.GetRolePermissions(ctx, id)
	if err != nil {
		return nil, model.InternalError("failed to get role permissions", err)
	}

	permResponses := make([]model.PermissionResponse, len(perms))
	for i, p := range perms {
		permResponses[i] = toPermissionResponse(p)
	}

	return &model.RoleDetailResponse{
		RoleResponse: toRoleResponse(role),
		Permissions:  permResponses,
	}, nil
}

func (s *RoleService) Create(ctx context.Context, tenantID uuid.UUID, req model.CreateRoleRequest) (*model.RoleResponse, error) {
	role, err := s.queries.CreateRole(ctx, sqlc.CreateRoleParams{
		TenantID:        tenantID,
		Name:            req.Name,
		Description:     pgtype.Text{String: req.Description, Valid: req.Description != ""},
		IsSystemDefault: false,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a role with this name already exists")
		}
		return nil, model.InternalError("failed to create role", err)
	}

	resp := toRoleResponse(role)
	return &resp, nil
}

func (s *RoleService) Update(ctx context.Context, id, tenantID uuid.UUID, req model.UpdateRoleRequest) (*model.RoleResponse, error) {
	existing, err := s.queries.GetRoleByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get role", err)
	}

	// Tenant isolation
	if existing.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	// Cannot rename system default roles
	if existing.IsSystemDefault && req.Name != existing.Name {
		return nil, model.ForbiddenError("cannot rename system default roles")
	}

	role, err := s.queries.UpdateRole(ctx, sqlc.UpdateRoleParams{
		ID:          id,
		Name:        req.Name,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a role with this name already exists")
		}
		return nil, model.InternalError("failed to update role", err)
	}

	resp := toRoleResponse(role)
	return &resp, nil
}

func (s *RoleService) Delete(ctx context.Context, id, tenantID uuid.UUID) error {
	existing, err := s.queries.GetRoleByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get role", err)
	}

	if existing.TenantID != tenantID {
		return model.ErrNotFound
	}

	if existing.IsSystemDefault {
		return model.ForbiddenError("cannot delete system default roles")
	}

	if err := s.queries.DeleteRole(ctx, id); err != nil {
		return model.InternalError("failed to delete role", err)
	}

	return nil
}

func (s *RoleService) UpdatePermissions(ctx context.Context, roleID, tenantID uuid.UUID, req model.UpdateRolePermissionsRequest) ([]model.PermissionResponse, error) {
	// Verify role belongs to tenant
	role, err := s.queries.GetRoleByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to get role", err)
	}
	if role.TenantID != tenantID {
		return nil, model.ErrNotFound
	}

	// Validate that each feature exists and actions are valid subsets
	for _, perm := range req.Permissions {
		feature, err := s.queries.GetFeatureByID(ctx, perm.FeatureID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, model.ValidationError("feature not found: " + perm.FeatureID.String())
			}
			return nil, model.InternalError("failed to validate feature", err)
		}

		allowedActions := make(map[string]bool, len(feature.Actions))
		for _, a := range feature.Actions {
			allowedActions[a] = true
		}
		for _, a := range perm.Actions {
			if !allowedActions[a] {
				return nil, model.ValidationError("invalid action '" + a + "' for feature " + feature.Slug)
			}
		}
	}

	// Delete existing permissions and re-create in a transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.DeleteRolePermissions(ctx, roleID); err != nil {
		return nil, model.InternalError("failed to clear permissions", err)
	}

	for _, perm := range req.Permissions {
		_, err := qtx.SetRolePermission(ctx, sqlc.SetRolePermissionParams{
			RoleID:    roleID,
			FeatureID: perm.FeatureID,
			Actions:   perm.Actions,
		})
		if err != nil {
			return nil, model.InternalError("failed to set permission", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit permission update", err)
	}

	// Return updated permissions
	perms, err := s.queries.GetRolePermissions(ctx, roleID)
	if err != nil {
		return nil, model.InternalError("failed to get updated permissions", err)
	}

	result := make([]model.PermissionResponse, len(perms))
	for i, p := range perms {
		result[i] = toPermissionResponse(p)
	}

	return result, nil
}

func (s *RoleService) ListFeatures(ctx context.Context) ([]model.FeatureResponse, error) {
	features, err := s.queries.ListFeatures(ctx)
	if err != nil {
		return nil, model.InternalError("failed to list features", err)
	}

	// Build tree: separate parents and children
	parentMap := make(map[uuid.UUID]*model.FeatureResponse)
	var result []model.FeatureResponse

	for _, f := range features {
		resp := toFeatureResponse(f)
		if resp.ParentID == nil {
			result = append(result, resp)
			parentMap[resp.ID] = &result[len(result)-1]
		}
	}

	for _, f := range features {
		resp := toFeatureResponse(f)
		if resp.ParentID != nil {
			if parent, ok := parentMap[*resp.ParentID]; ok {
				parent.Children = append(parent.Children, resp)
			}
		}
	}

	return result, nil
}
