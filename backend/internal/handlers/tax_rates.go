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

type TaxRatesHandler struct {
	deps Deps
}

func NewTaxRatesHandler(deps Deps) *TaxRatesHandler {
	return &TaxRatesHandler{deps: deps}
}

type taxRateInput struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Rate        float64 `json:"rate"`
	Description string  `json:"description"`
	IsDefault   bool    `json:"isDefault"`
}

func (h *TaxRatesHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.TaxRate{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("is_default DESC, name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *TaxRatesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in taxRateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateTaxRateInput(&in, true); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	t := &models.TaxRate{
		ID:          strings.TrimSpace(in.ID),
		Name:        strings.TrimSpace(in.Name),
		Rate:        in.Rate,
		Description: strings.TrimSpace(in.Description),
		IsDefault:   in.IsDefault,
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if in.IsDefault {
			if err := clearDefaultTaxRate(ctx, tx); err != nil {
				return err
			}
		}
		_, err := tx.NewInsert().Model(t).Exec(ctx)
		return err
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *TaxRatesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in taxRateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateTaxRateInput(&in, false); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if in.IsDefault {
			// Demote any existing default so the partial unique index isn't violated.
			if _, err := tx.NewUpdate().Table("tax_rates").
				Set("is_default = false").
				Where("is_default = true AND id <> ?", id).
				Exec(ctx); err != nil {
				return err
			}
		}
		res, err := tx.NewUpdate().Table("tax_rates").Where("id = ?", id).
			Set("name = ?", strings.TrimSpace(in.Name)).
			Set("rate = ?", in.Rate).
			Set("description = ?", strings.TrimSpace(in.Description)).
			Set("is_default = ?", in.IsDefault).
			Set("updated_at = current_timestamp").
			Exec(ctx)
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
	var t models.TaxRate
	if err := h.deps.DB.NewSelect().Model(&t).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *TaxRatesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var existing models.TaxRate
	if err := h.deps.DB.NewSelect().Model(&existing).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if existing.IsDefault {
		writeError(w, http.StatusBadRequest, "tarif default tidak bisa dihapus")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.TaxRate)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		// FK violation (categories still pointing at this tax) returns a generic
		// 500 — surface a friendlier 400 by sniffing the error string.
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			writeError(w, http.StatusBadRequest, "tarif masih dipakai kategori lain")
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

func clearDefaultTaxRate(ctx context.Context, tx bun.Tx) error {
	_, err := tx.NewUpdate().Table("tax_rates").
		Set("is_default = false").
		Where("is_default = true").
		Exec(ctx)
	return err
}

func validateTaxRateInput(in *taxRateInput, requireID bool) string {
	if requireID && strings.TrimSpace(in.ID) == "" {
		return "id wajib diisi (mis. tax_ppn11)"
	}
	if strings.TrimSpace(in.Name) == "" {
		return "nama wajib diisi"
	}
	if in.Rate < 0 {
		return "rate tidak boleh negatif"
	}
	return ""
}

// Sentinel error so the update tx can communicate "no row matched" without
// wrapping a sql error. Caller inspects via equality.
var errNotFound = &handlerErr{"not found"}

type handlerErr struct{ msg string }

func (e *handlerErr) Error() string { return e.msg }
