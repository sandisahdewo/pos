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

type VariantHandler struct {
	variant *service.VariantService
}

func NewVariantHandler(variant *service.VariantService) *VariantHandler {
	return &VariantHandler{variant: variant}
}

func (h *VariantHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	variants, err := h.variant.List(r.Context(), tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, variants)
}

func (h *VariantHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid variant ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	variant, err := h.variant.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, variant)
}

func (h *VariantHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateVariantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	variant, err := h.variant.Create(r.Context(), tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, variant)
}

func (h *VariantHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid variant ID"))
		return
	}

	var req model.UpdateVariantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	variant, err := h.variant.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, variant)
}

func (h *VariantHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid variant ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.variant.Deactivate(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "variant deactivated")
}

func (h *VariantHandler) AddValue(w http.ResponseWriter, r *http.Request) {
	variantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid variant ID"))
		return
	}

	var req model.CreateVariantValueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	value, err := h.variant.AddValue(r.Context(), variantID, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, value)
}

func (h *VariantHandler) UpdateValue(w http.ResponseWriter, r *http.Request) {
	variantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid variant ID"))
		return
	}

	valueID, err := uuid.Parse(chi.URLParam(r, "valueId"))
	if err != nil {
		respondError(w, model.ValidationError("invalid value ID"))
		return
	}

	var req model.UpdateVariantValueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	value, err := h.variant.UpdateValue(r.Context(), variantID, valueID, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, value)
}

func (h *VariantHandler) DeleteValue(w http.ResponseWriter, r *http.Request) {
	variantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid variant ID"))
		return
	}

	valueID, err := uuid.Parse(chi.URLParam(r, "valueId"))
	if err != nil {
		respondError(w, model.ValidationError("invalid value ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.variant.DeleteValue(r.Context(), variantID, valueID, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "variant value deleted")
}
