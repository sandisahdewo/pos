package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type UnitsHandler struct {
	deps Deps
}

func NewUnitsHandler(deps Deps) *UnitsHandler {
	return &UnitsHandler{deps: deps}
}

type unitInput struct {
	Name        string `json:"name"`
	Code        string `json:"code"`
	Description string `json:"description"`
}

func (h *UnitsHandler) List(w http.ResponseWriter, r *http.Request) {
	var units []models.Unit
	err := h.deps.DB.NewSelect().Model(&units).Order("name ASC").Scan(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, units)
}

func (h *UnitsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var unit models.Unit
	if err := h.deps.DB.NewSelect().Model(&unit).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, unit)
}

func (h *UnitsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in unitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Name == "" || in.Code == "" {
		writeError(w, http.StatusBadRequest, "name and code required")
		return
	}
	unit := models.Unit{Name: in.Name, Code: in.Code, Description: in.Description}
	_, err := h.deps.DB.NewInsert().Model(&unit).Returning("*").Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, unit)
}

func (h *UnitsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in unitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	unit := models.Unit{ID: id, Name: in.Name, Code: in.Code, Description: in.Description}
	res, err := h.deps.DB.NewUpdate().
		Model(&unit).
		Set("name = ?, code = ?, description = ?, updated_at = current_timestamp", in.Name, in.Code, in.Description).
		Where("id = ?", id).
		Returning("*").
		Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, unit)
}

func (h *UnitsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Unit)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
