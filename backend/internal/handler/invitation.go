package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
)

type InvitationHandler struct {
	invitation *service.InvitationService
}

func NewInvitationHandler(invitation *service.InvitationService) *InvitationHandler {
	return &InvitationHandler{invitation: invitation}
}

func (h *InvitationHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())
	invitedBy := middleware.UserIDFromContext(r.Context())

	invitation, err := h.invitation.Create(r.Context(), tenantID, invitedBy, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, invitation)
}

func (h *InvitationHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	invitations, err := h.invitation.List(r.Context(), tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, invitations)
}

func (h *InvitationHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid invitation ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.invitation.Cancel(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "invitation cancelled")
}
