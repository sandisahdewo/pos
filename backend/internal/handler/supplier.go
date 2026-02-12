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

type SupplierHandler struct {
	supplier *service.SupplierService
}

func NewSupplierHandler(supplier *service.SupplierService) *SupplierHandler {
	return &SupplierHandler{supplier: supplier}
}

func (h *SupplierHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	suppliers, err := h.supplier.List(r.Context(), tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, suppliers)
}

func (h *SupplierHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid supplier ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	supplier, err := h.supplier.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, supplier)
}

func (h *SupplierHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	supplier, err := h.supplier.Create(r.Context(), tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, supplier)
}

func (h *SupplierHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid supplier ID"))
		return
	}

	var req model.UpdateSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	supplier, err := h.supplier.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, supplier)
}

func (h *SupplierHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid supplier ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.supplier.Deactivate(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "supplier deactivated")
}
