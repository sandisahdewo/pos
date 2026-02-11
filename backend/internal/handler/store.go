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

type StoreHandler struct {
	store *service.StoreService
}

func NewStoreHandler(store *service.StoreService) *StoreHandler {
	return &StoreHandler{store: store}
}

func (h *StoreHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())
	storeIDs := middleware.GetAccessibleStoreIDs(r.Context())
	allAccess := middleware.HasAllStoreAccess(r.Context())

	stores, err := h.store.List(r.Context(), tenantID, storeIDs, allAccess)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, stores)
}

func (h *StoreHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid store ID"))
		return
	}

	if !middleware.CanAccessStore(r.Context(), id) {
		respondError(w, model.NotFoundError("store not found"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	store, err := h.store.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, store)
}

func (h *StoreHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateStoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	store, err := h.store.Create(r.Context(), tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, store)
}

func (h *StoreHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid store ID"))
		return
	}

	if !middleware.CanAccessStore(r.Context(), id) {
		respondError(w, model.NotFoundError("store not found"))
		return
	}

	var req model.UpdateStoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	store, err := h.store.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, store)
}

func (h *StoreHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid store ID"))
		return
	}

	if !middleware.CanAccessStore(r.Context(), id) {
		respondError(w, model.NotFoundError("store not found"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.store.Deactivate(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "store deactivated")
}
