package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type PricelistsHandler struct {
	deps Deps
}

func NewPricelistsHandler(deps Deps) *PricelistsHandler {
	return &PricelistsHandler{deps: deps}
}

type pricelistInput struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsDefault   bool   `json:"isDefault"`
}

func (h *PricelistsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Pricelist{}
	if err := h.deps.DB.NewSelect().Model(&items).
		Order("is_default DESC, name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *PricelistsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in pricelistInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validatePricelist(&in, true); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	p := &models.Pricelist{
		ID:          strings.TrimSpace(in.ID),
		Name:        strings.TrimSpace(in.Name),
		Description: strings.TrimSpace(in.Description),
		IsDefault:   in.IsDefault,
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if in.IsDefault {
			if _, err := tx.NewUpdate().Table("pricelists").
				Set("is_default = false").Where("is_default = true").Exec(ctx); err != nil {
				return err
			}
		}
		_, err := tx.NewInsert().Model(p).Exec(ctx)
		return err
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *PricelistsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in pricelistInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validatePricelist(&in, false); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if in.IsDefault {
			if _, err := tx.NewUpdate().Table("pricelists").
				Set("is_default = false").
				Where("is_default = true AND id <> ?", id).Exec(ctx); err != nil {
				return err
			}
		}
		res, err := tx.NewUpdate().Table("pricelists").Where("id = ?", id).
			Set("name = ?", strings.TrimSpace(in.Name)).
			Set("description = ?", strings.TrimSpace(in.Description)).
			Set("is_default = ?", in.IsDefault).
			Set("updated_at = current_timestamp").Exec(ctx)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return errNotFound
		}
		return nil
	})
	if err == errNotFound {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var p models.Pricelist
	if err := h.deps.DB.NewSelect().Model(&p).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *PricelistsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var existing models.Pricelist
	if err := h.deps.DB.NewSelect().Model(&existing).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if existing.IsDefault {
		writeError(w, http.StatusBadRequest, "daftar harga default tidak bisa dihapus")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Pricelist)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			writeError(w, http.StatusBadRequest, "daftar harga masih dipakai (customer / produk)")
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

func validatePricelist(in *pricelistInput, requireID bool) string {
	if requireID && strings.TrimSpace(in.ID) == "" {
		return "id wajib diisi (mis. pl_retail)"
	}
	if strings.TrimSpace(in.Name) == "" {
		return "nama wajib diisi"
	}
	return ""
}
