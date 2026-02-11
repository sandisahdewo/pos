package service

import (
	"pos/internal/database/sqlc"
	"pos/internal/model"

	"github.com/google/uuid"
)

func toUserResponse(u sqlc.User) model.UserResponse {
	return model.UserResponse{
		ID:              u.ID,
		TenantID:        u.TenantID,
		Email:           u.Email,
		FirstName:       u.FirstName,
		LastName:        u.LastName,
		IsEmailVerified: u.IsEmailVerified,
		IsActive:        u.IsActive,
		CreatedAt:       u.CreatedAt.Time,
		UpdatedAt:       u.UpdatedAt.Time,
	}
}

func toStoreResponse(s sqlc.Store) model.StoreResponse {
	return model.StoreResponse{
		ID:        s.ID,
		TenantID:  s.TenantID,
		Name:      s.Name,
		Address:   s.Address.String,
		Phone:     s.Phone.String,
		IsActive:  s.IsActive,
		CreatedAt: s.CreatedAt.Time,
		UpdatedAt: s.UpdatedAt.Time,
	}
}

func toStoreResponses(stores []sqlc.Store) []model.StoreResponse {
	result := make([]model.StoreResponse, len(stores))
	for i, s := range stores {
		result[i] = toStoreResponse(s)
	}
	return result
}

func toRoleResponse(r sqlc.Role) model.RoleResponse {
	return model.RoleResponse{
		ID:              r.ID,
		TenantID:        r.TenantID,
		Name:            r.Name,
		Description:     r.Description.String,
		IsSystemDefault: r.IsSystemDefault,
		CreatedAt:       r.CreatedAt.Time,
		UpdatedAt:       r.UpdatedAt.Time,
	}
}

func toRoleResponses(roles []sqlc.Role) []model.RoleResponse {
	result := make([]model.RoleResponse, len(roles))
	for i, r := range roles {
		result[i] = toRoleResponse(r)
	}
	return result
}

func toFeatureResponse(f sqlc.Feature) model.FeatureResponse {
	var parentID *uuid.UUID
	if f.ParentID.Valid {
		id := uuid.UUID(f.ParentID.Bytes)
		parentID = &id
	}
	return model.FeatureResponse{
		ID:        f.ID,
		ParentID:  parentID,
		Name:      f.Name,
		Slug:      f.Slug,
		Module:    f.Module,
		Actions:   f.Actions,
		SortOrder: f.SortOrder,
	}
}

func toInvitationResponse(inv sqlc.Invitation) model.InvitationResponse {
	return model.InvitationResponse{
		ID:        inv.ID,
		TenantID:  inv.TenantID,
		InvitedBy: inv.InvitedBy,
		Email:     inv.Email,
		RoleID:    inv.RoleID,
		StoreIDs:  inv.StoreIds,
		Status:    inv.Status,
		ExpiresAt: inv.ExpiresAt.Time,
		CreatedAt: inv.CreatedAt.Time,
		UpdatedAt: inv.UpdatedAt.Time,
	}
}

func toPermissionResponse(p sqlc.GetRolePermissionsRow) model.PermissionResponse {
	return model.PermissionResponse{
		ID:            p.ID,
		FeatureID:     p.FeatureID,
		FeatureSlug:   p.FeatureSlug,
		FeatureName:   p.FeatureName,
		FeatureModule: p.FeatureModule,
		Actions:       p.Actions,
	}
}
