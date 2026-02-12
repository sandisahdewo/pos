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

type UnitConversionHandler struct {
	unitConversion *service.UnitConversionService
}

func NewUnitConversionHandler(unitConversion *service.UnitConversionService) *UnitConversionHandler {
	return &UnitConversionHandler{unitConversion: unitConversion}
}

func (h *UnitConversionHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	conversions, err := h.unitConversion.List(r.Context(), tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, conversions)
}

func (h *UnitConversionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid unit conversion ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	conversion, err := h.unitConversion.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, conversion)
}

func (h *UnitConversionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateUnitConversionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	conversion, err := h.unitConversion.Create(r.Context(), tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, conversion)
}

func (h *UnitConversionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid unit conversion ID"))
		return
	}

	var req model.UpdateUnitConversionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	conversion, err := h.unitConversion.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, conversion)
}

func (h *UnitConversionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid unit conversion ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.unitConversion.Delete(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "unit conversion deleted")
}
