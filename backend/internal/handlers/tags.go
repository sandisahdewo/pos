package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type TagsHandler struct {
	deps Deps
}

func NewTagsHandler(deps Deps) *TagsHandler {
	return &TagsHandler{deps: deps}
}

type tagInput struct {
	Name          string `json:"name"`
	Color         string `json:"color"`
	PublicVisible bool   `json:"publicVisible"`
	Description   string `json:"description"`
}

func (h *TagsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Tag{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *TagsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in tagInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateTagInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	t := &models.Tag{
		Name:          strings.TrimSpace(in.Name),
		Color:         colorOrDefault(in.Color),
		PublicVisible: in.PublicVisible,
		Description:   strings.TrimSpace(in.Description),
	}
	if _, err := h.deps.DB.NewInsert().Model(t).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *TagsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in tagInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateTagInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	res, err := h.deps.DB.NewUpdate().Table("tags").Where("id = ?", id).
		Set("name = ?", strings.TrimSpace(in.Name)).
		Set("color = ?", colorOrDefault(in.Color)).
		Set("public_visible = ?", in.PublicVisible).
		Set("description = ?", strings.TrimSpace(in.Description)).
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
	var t models.Tag
	if err := h.deps.DB.NewSelect().Model(&t).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *TagsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Tag)(nil)).Where("id = ?", id).Exec(r.Context())
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

func validateTagInput(in *tagInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama tag wajib diisi"
	}
	return ""
}
