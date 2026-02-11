package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type InvitationService struct {
	queries  *sqlc.Queries
	enqueuer JobEnqueuer
}

func NewInvitationService(queries *sqlc.Queries, enqueuer JobEnqueuer) *InvitationService {
	return &InvitationService{queries: queries, enqueuer: enqueuer}
}

func (s *InvitationService) Create(ctx context.Context, tenantID, invitedBy uuid.UUID, req model.CreateInvitationRequest) (*model.InvitationResponse, error) {
	// Verify role belongs to tenant
	role, err := s.queries.GetRoleByID(ctx, req.RoleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ValidationError("role not found")
		}
		return nil, model.InternalError("failed to verify role", err)
	}
	if role.TenantID != tenantID {
		return nil, model.ValidationError("role not found")
	}

	// Verify stores belong to tenant
	for _, storeID := range req.StoreIDs {
		store, err := s.queries.GetStoreByID(ctx, storeID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, model.ValidationError("store not found: " + storeID.String())
			}
			return nil, model.InternalError("failed to verify store", err)
		}
		if store.TenantID != tenantID {
			return nil, model.ValidationError("store not found: " + storeID.String())
		}
	}

	// Generate invitation token
	plainToken, tokenHash, err := GenerateRandomToken()
	if err != nil {
		return nil, model.InternalError("failed to generate invitation token", err)
	}

	invitation, err := s.queries.CreateInvitation(ctx, sqlc.CreateInvitationParams{
		TenantID:  tenantID,
		InvitedBy: invitedBy,
		Email:     req.Email,
		RoleID:    req.RoleID,
		StoreIds:  req.StoreIDs,
		TokenHash: tokenHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(7 * 24 * time.Hour), Valid: true},
	})
	if err != nil {
		return nil, model.InternalError("failed to create invitation", err)
	}

	// Get tenant name for email
	tenant, err := s.queries.GetTenantByID(ctx, tenantID)
	if err != nil {
		slog.Error("failed to get tenant for invitation email", "error", err)
	} else if s.enqueuer != nil {
		if err := s.enqueuer.EnqueueInvitationEmail(ctx, req.Email, plainToken, tenant.Name); err != nil {
			slog.Error("failed to enqueue invitation email", "error", err)
		}
	}

	resp := toInvitationResponse(invitation)
	return &resp, nil
}

func (s *InvitationService) List(ctx context.Context, tenantID uuid.UUID) ([]model.InvitationResponse, error) {
	invitations, err := s.queries.GetInvitationsByTenant(ctx, tenantID)
	if err != nil {
		return nil, model.InternalError("failed to list invitations", err)
	}

	result := make([]model.InvitationResponse, len(invitations))
	for i, inv := range invitations {
		result[i] = toInvitationResponse(inv)
	}

	return result, nil
}

func (s *InvitationService) Cancel(ctx context.Context, id, tenantID uuid.UUID) error {
	invitation, err := s.queries.GetInvitationByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to get invitation", err)
	}

	// Tenant isolation
	if invitation.TenantID != tenantID {
		return model.ErrNotFound
	}

	if invitation.Status != "pending" {
		return model.ValidationError("can only cancel pending invitations")
	}

	if err := s.queries.DeleteInvitation(ctx, id); err != nil {
		return model.InternalError("failed to cancel invitation", err)
	}

	return nil
}
