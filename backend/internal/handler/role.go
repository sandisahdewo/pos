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

type RoleHandler struct {
	role *service.RoleService
}

func NewRoleHandler(role *service.RoleService) *RoleHandler {
	return &RoleHandler{role: role}
}

func (h *RoleHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	roles, err := h.role.List(r.Context(), tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, roles)
}

func (h *RoleHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid role ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	role, err := h.role.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, role)
}

func (h *RoleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	role, err := h.role.Create(r.Context(), tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, role)
}

func (h *RoleHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid role ID"))
		return
	}

	var req model.UpdateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	role, err := h.role.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, role)
}

func (h *RoleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid role ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.role.Delete(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "role deleted")
}

func (h *RoleHandler) UpdatePermissions(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid role ID"))
		return
	}

	var req model.UpdateRolePermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	perms, err := h.role.UpdatePermissions(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, perms)
}
