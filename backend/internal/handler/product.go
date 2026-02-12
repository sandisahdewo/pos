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

type ProductHandler struct {
	product *service.ProductService
}

func NewProductHandler(product *service.ProductService) *ProductHandler {
	return &ProductHandler{product: product}
}

func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.TenantIDFromContext(r.Context())

	var categoryID *uuid.UUID
	if catIDStr := r.URL.Query().Get("category_id"); catIDStr != "" {
		id, err := uuid.Parse(catIDStr)
		if err != nil {
			respondError(w, model.ValidationError("invalid category_id"))
			return
		}
		categoryID = &id
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	pagination := model.PaginationRequest{Page: page, PerPage: perPage}

	result, err := h.product.List(r.Context(), tenantID, categoryID, pagination)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *ProductHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid product ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	product, err := h.product.GetByID(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, product)
}

func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	product, err := h.product.Create(r.Context(), tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, product)
}

func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid product ID"))
		return
	}

	var req model.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	product, err := h.product.Update(r.Context(), id, tenantID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, product)
}

func (h *ProductHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid product ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	if err := h.product.Deactivate(r.Context(), id, tenantID); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "product deactivated")
}
