package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type ProductsHandler struct {
	deps Deps
}

func NewProductsHandler(deps Deps) *ProductsHandler {
	return &ProductsHandler{deps: deps}
}

func (h *ProductsHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := loadProducts(r.Context(), h.deps.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if items == nil {
		items = []models.Product{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *ProductsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := loadProduct(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *ProductsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.Product
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateProduct(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	in.ID = uuid.Nil
	normalizeProduct(&in)

	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(&in).Returning("*").Exec(ctx); err != nil {
			return err
		}
		return saveProductChildren(ctx, tx, &in)
	})
	if err != nil {
		writeProductError(w, err)
		return
	}
	full, err := loadProduct(r.Context(), h.deps.DB, in.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, full)
}

func (h *ProductsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in models.Product
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateProduct(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	in.ID = id
	normalizeProduct(&in)

	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		res, err := tx.NewUpdate().Model(&in).
			WherePK().
			ExcludeColumn("id", "created_at", "updated_at").
			Set("updated_at = current_timestamp").
			Exec(ctx)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return errNotFound
		}
		return saveProductChildren(ctx, tx, &in)
	})
	if errors.Is(err, errNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeProductError(w, err)
		return
	}
	full, err := loadProduct(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, full)
}

func (h *ProductsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Product)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			writeError(w, http.StatusBadRequest, "produk masih dipakai (batch / order / resep produk lain)")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func validateProduct(p *models.Product) string {
	if strings.TrimSpace(p.SKU) == "" {
		return "SKU wajib diisi"
	}
	if strings.TrimSpace(p.Name) == "" {
		return "nama produk wajib diisi"
	}
	if p.Cost < 0 {
		return "biaya tidak boleh negatif"
	}
	primaryCount := 0
	for _, s := range p.Suppliers {
		if s.IsPrimary {
			primaryCount++
		}
	}
	if primaryCount > 1 {
		return "hanya boleh ada satu pemasok utama"
	}
	return ""
}

func normalizeProduct(p *models.Product) {
	p.SKU = strings.TrimSpace(p.SKU)
	p.Name = strings.TrimSpace(p.Name)
	p.Kind = productKindOrDefault(p.Kind)
	p.Status = productStatusOrDefault(p.Status)
	p.MarkupCostSource = markupSourceOrDefault(p.MarkupCostSource)
	p.EnsureSlices()
}

func productKindOrDefault(k string) string {
	if strings.TrimSpace(k) == models.ProductKindComposite {
		return models.ProductKindComposite
	}
	return models.ProductKindGoods
}

func productStatusOrDefault(s string) string {
	if strings.TrimSpace(s) == models.ProductStatusArchived {
		return models.ProductStatusArchived
	}
	return models.ProductStatusActive
}

func markupSourceOrDefault(s string) string {
	switch strings.TrimSpace(s) {
	case "fifo-current", "batch-avg":
		return s
	}
	return "manual"
}

func writeProductError(w http.ResponseWriter, err error) {
	var bad *badInputError
	if errors.As(err, &bad) {
		writeError(w, http.StatusBadRequest, bad.msg)
		return
	}
	msg := err.Error()
	if strings.Contains(msg, "duplicate key value") && strings.Contains(msg, "sku") {
		writeError(w, http.StatusBadRequest, "SKU sudah dipakai produk lain")
		return
	}
	if strings.Contains(msg, "duplicate key value") && strings.Contains(msg, "product_suppliers_one_primary") {
		writeError(w, http.StatusBadRequest, "hanya boleh ada satu pemasok utama")
		return
	}
	writeError(w, http.StatusInternalServerError, msg)
}
