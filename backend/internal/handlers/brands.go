package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type BrandsHandler struct {
	deps Deps
}

func NewBrandsHandler(deps Deps) *BrandsHandler {
	return &BrandsHandler{deps: deps}
}

type brandInput struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	Status      string `json:"status"`
}

func (h *BrandsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Brand{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *BrandsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var b models.Brand
	if err := h.deps.DB.NewSelect().Model(&b).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (h *BrandsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in brandInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateBrandInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	b := &models.Brand{
		Name:        strings.TrimSpace(in.Name),
		Slug:        normalizeSlug(in.Slug, in.Name),
		Description: strings.TrimSpace(in.Description),
		ImageURL:    strings.TrimSpace(in.ImageURL),
		Status:      brandStatusOrDefault(in.Status),
	}
	if _, err := h.deps.DB.NewInsert().Model(b).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, b)
}

func (h *BrandsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in brandInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateBrandInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	res, err := h.deps.DB.NewUpdate().Table("brands").Where("id = ?", id).
		Set("name = ?", strings.TrimSpace(in.Name)).
		Set("slug = ?", normalizeSlug(in.Slug, in.Name)).
		Set("description = ?", strings.TrimSpace(in.Description)).
		Set("image_url = ?", strings.TrimSpace(in.ImageURL)).
		Set("status = ?", brandStatusOrDefault(in.Status)).
		Set("updated_at = current_timestamp").
		Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var b models.Brand
	if err := h.deps.DB.NewSelect().Model(&b).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (h *BrandsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Brand)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateBrandInput(in *brandInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama brand wajib diisi"
	}
	return ""
}

func brandStatusOrDefault(s string) string {
	if strings.TrimSpace(s) == models.BrandStatusArchived {
		return models.BrandStatusArchived
	}
	return models.BrandStatusActive
}
