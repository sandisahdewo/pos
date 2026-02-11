package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
)

type UserHandler struct {
	user *service.UserService
}

func NewUserHandler(user *service.UserService) *UserHandler {
	return &UserHandler{user: user}
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	pg := model.PaginationRequest{Page: page, PerPage: perPage}

	result, err := h.user.List(r.Context(), tenantID, pg)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid user ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	user, err := h.user.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid user ID"))
		return
	}

	var req model.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	user, err := h.user.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid user ID"))
		return
	}

	requestingUserID := middleware.UserIDFromContext(r.Context())
	if id == requestingUserID {
		respondError(w, model.ForbiddenError("cannot deactivate your own account"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.user.Deactivate(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "user deactivated")
}

func (h *UserHandler) UpdateStores(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid user ID"))
		return
	}

	var req model.UpdateUserStoresRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())
	assignedBy := middleware.UserIDFromContext(r.Context())

	stores, err := h.user.UpdateStores(r.Context(), id, tenantID, assignedBy, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, stores)
}
