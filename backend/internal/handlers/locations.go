package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type LocationsHandler struct {
	deps Deps
}

func NewLocationsHandler(deps Deps) *LocationsHandler {
	return &LocationsHandler{deps: deps}
}

type locationInput struct {
	Name             string `json:"name"`
	Slug             string `json:"slug"`
	Kind             string `json:"kind"`
	CustomerVisible  bool   `json:"customerVisible"`
	IsDefaultReceipt bool   `json:"isDefaultReceipt"`
	DisplayOrder     int    `json:"displayOrder"`
	Description      string `json:"description"`
	Status           string `json:"status"`
}

var allowedLocationKinds = map[string]struct{}{
	models.LocationKindShelf:     {},
	models.LocationKindRack:      {},
	models.LocationKindWarehouse: {},
}

func (h *LocationsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Location{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("display_order ASC, name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *LocationsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var loc models.Location
	if err := h.deps.DB.NewSelect().Model(&loc).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, loc)
}

func (h *LocationsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in locationInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateLocationInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	loc := &models.Location{
		Name:             strings.TrimSpace(in.Name),
		Slug:             normalizeSlug(in.Slug, in.Name),
		Kind:             locationKindOrDefault(in.Kind),
		CustomerVisible:  in.CustomerVisible,
		IsDefaultReceipt: in.IsDefaultReceipt,
		DisplayOrder:     in.DisplayOrder,
		Description:      strings.TrimSpace(in.Description),
		Status:           locationStatusOrDefault(in.Status),
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if loc.IsDefaultReceipt {
			if err := clearDefaultReceipt(ctx, tx); err != nil {
				return err
			}
		}
		_, err := tx.NewInsert().Model(loc).Returning("*").Exec(ctx)
		return err
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, loc)
}

func (h *LocationsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in locationInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateLocationInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		if in.IsDefaultReceipt {
			// Demote any other default so the partial unique index isn't violated.
			if _, err := tx.NewUpdate().Table("locations").
				Set("is_default_receipt = false").
				Where("is_default_receipt = true AND id <> ?", id).
				Exec(ctx); err != nil {
				return err
			}
		}
		res, err := tx.NewUpdate().Table("locations").Where("id = ?", id).
			Set("name = ?", strings.TrimSpace(in.Name)).
			Set("slug = ?", normalizeSlug(in.Slug, in.Name)).
			Set("kind = ?", locationKindOrDefault(in.Kind)).
			Set("customer_visible = ?", in.CustomerVisible).
			Set("is_default_receipt = ?", in.IsDefaultReceipt).
			Set("display_order = ?", in.DisplayOrder).
			Set("description = ?", strings.TrimSpace(in.Description)).
			Set("status = ?", locationStatusOrDefault(in.Status)).
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
	var loc models.Location
	if err := h.deps.DB.NewSelect().Model(&loc).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, loc)
}

func (h *LocationsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var existing models.Location
	if err := h.deps.DB.NewSelect().Model(&existing).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if existing.IsDefaultReceipt {
		writeError(w, http.StatusBadRequest, "lokasi default penerimaan tidak bisa dihapus")
		return
	}
	// Block the delete if this is the last location — at least one is required
	// because PO receiving needs somewhere to put stock.
	var total int
	if err := h.deps.DB.NewSelect().Table("locations").
		ColumnExpr("count(*)").Scan(r.Context(), &total); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if total <= 1 {
		writeError(w, http.StatusBadRequest, "minimal harus ada satu lokasi")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Location)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			writeError(w, http.StatusBadRequest, "lokasi masih dipakai oleh stok / batch lain")
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

func clearDefaultReceipt(ctx context.Context, tx bun.Tx) error {
	_, err := tx.NewUpdate().Table("locations").
		Set("is_default_receipt = false").
		Where("is_default_receipt = true").
		Exec(ctx)
	return err
}

func validateLocationInput(in *locationInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama lokasi wajib diisi"
	}
	if in.DisplayOrder < 0 {
		return "urutan tidak boleh negatif"
	}
	return ""
}

func locationKindOrDefault(k string) string {
	k = strings.TrimSpace(k)
	if _, ok := allowedLocationKinds[k]; ok {
		return k
	}
	return models.LocationKindShelf
}

func locationStatusOrDefault(s string) string {
	if strings.TrimSpace(s) == models.LocationStatusArchived {
		return models.LocationStatusArchived
	}
	return models.LocationStatusActive
}
