package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type CategoriesHandler struct {
	deps Deps
}

func NewCategoriesHandler(deps Deps) *CategoriesHandler {
	return &CategoriesHandler{deps: deps}
}

type categoryInput struct {
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	Color       string  `json:"color"`
	TaxRateID   *string `json:"taxRateId,omitempty"`
	ParentID    *string `json:"parentId,omitempty"`
}

func (h *CategoriesHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Category{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *CategoriesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var c models.Category
	if err := h.deps.DB.NewSelect().Model(&c).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *CategoriesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in categoryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateCategoryInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	parsedParent, err := parseOptionalUUID(in.ParentID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "parentId tidak valid")
		return
	}
	c := &models.Category{
		Name:        strings.TrimSpace(in.Name),
		Slug:        normalizeSlug(in.Slug, in.Name),
		Description: strings.TrimSpace(in.Description),
		Color:       colorOrDefault(in.Color),
		TaxRateID:   nullableString(in.TaxRateID),
		ParentID:    parsedParent,
	}
	if _, err := h.deps.DB.NewInsert().Model(c).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *CategoriesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in categoryInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateCategoryInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	parsedParent, err := parseOptionalUUID(in.ParentID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "parentId tidak valid")
		return
	}
	if parsedParent != nil {
		if *parsedParent == id {
			writeError(w, http.StatusBadRequest, "kategori tidak bisa menjadi induk dari dirinya sendiri")
			return
		}
		cycle, err := wouldCreateCycle(r.Context(), h.deps.DB, id, *parsedParent)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if cycle {
			writeError(w, http.StatusBadRequest, "induk baru adalah anak/cucu dari kategori ini")
			return
		}
	}

	res, err := h.deps.DB.NewUpdate().Table("categories").Where("id = ?", id).
		Set("name = ?", strings.TrimSpace(in.Name)).
		Set("slug = ?", normalizeSlug(in.Slug, in.Name)).
		Set("description = ?", strings.TrimSpace(in.Description)).
		Set("color = ?", colorOrDefault(in.Color)).
		Set("tax_rate_id = ?", nullableString(in.TaxRateID)).
		Set("parent_id = ?", parsedParent).
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
	var c models.Category
	if err := h.deps.DB.NewSelect().Model(&c).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *CategoriesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	// FK on parent_id is ON DELETE RESTRICT — block here with a friendlier
	// message instead of the bare FK error.
	var children int
	if err := h.deps.DB.NewSelect().Table("categories").
		ColumnExpr("count(*)").Where("parent_id = ?", id).
		Scan(r.Context(), &children); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if children > 0 {
		writeError(w, http.StatusBadRequest, "kategori masih punya sub-kategori")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Category)(nil)).Where("id = ?", id).Exec(r.Context())
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

// ─── helpers ────────────────────────────────────────────────────────────────

var slugChars = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugChars.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func normalizeSlug(provided, fallbackName string) string {
	s := slugify(provided)
	if s == "" {
		s = slugify(fallbackName)
	}
	return s
}

var allowedColors = map[string]struct{}{
	"brand": {}, "success": {}, "warning": {}, "danger": {}, "info": {}, "neutral": {},
}

func colorOrDefault(c string) string {
	if _, ok := allowedColors[c]; ok {
		return c
	}
	return "neutral"
}

func validateCategoryInput(in *categoryInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama kategori wajib diisi"
	}
	return ""
}

func parseOptionalUUID(s *string) (*uuid.UUID, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	id, err := uuid.Parse(*s)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func nullableString(s *string) *string {
	if s == nil {
		return nil
	}
	trim := strings.TrimSpace(*s)
	if trim == "" {
		return nil
	}
	return &trim
}

// wouldCreateCycle reports whether re-parenting `node` to `candidateParent`
// would form a cycle. Walks the parent chain from `candidateParent` upward;
// if we ever hit `node`, that's a cycle. Capped at 32 hops as a safety net.
func wouldCreateCycle(
	ctx context.Context,
	db *bun.DB,
	node, candidateParent uuid.UUID,
) (bool, error) {
	current := candidateParent
	seen := map[uuid.UUID]struct{}{}
	for hops := 0; hops < 32; hops++ {
		if current == node {
			return true, nil
		}
		if _, dup := seen[current]; dup {
			return false, nil
		}
		seen[current] = struct{}{}

		var next *uuid.UUID
		err := db.NewSelect().Table("categories").
			Column("parent_id").
			Where("id = ?", current).
			Scan(ctx, &next)
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		if next == nil {
			return false, nil
		}
		current = *next
	}
	return false, nil
}
