package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
)

type StockHandler struct {
	stock *service.StockService
}

func NewStockHandler(stock *service.StockService) *StockHandler {
	return &StockHandler{stock: stock}
}

func (h *StockHandler) GetByProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, model.ValidationError("invalid product ID"))
		return
	}

	tenantID := middleware.TenantIDFromContext(r.Context())

	stock, err := h.stock.GetByProduct(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, stock)
}
