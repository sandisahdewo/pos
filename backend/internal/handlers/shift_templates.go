package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type ShiftTemplatesHandler struct {
	deps Deps
}

func NewShiftTemplatesHandler(deps Deps) *ShiftTemplatesHandler {
	return &ShiftTemplatesHandler{deps: deps}
}

type shiftTemplateInput struct {
	Name      string `json:"name"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Notes     string `json:"notes"`
	Status    string `json:"status"`
}

func (h *ShiftTemplatesHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.ShiftTemplate{}
	if err := h.deps.DB.NewSelect().Model(&items).
		Order("start_time ASC, name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *ShiftTemplatesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in shiftTemplateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateShiftTemplate(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	t := &models.ShiftTemplate{
		Name:      strings.TrimSpace(in.Name),
		StartTime: in.StartTime,
		EndTime:   in.EndTime,
		Notes:     strings.TrimSpace(in.Notes),
		Status:    shiftTemplateStatusOrDefault(in.Status),
	}
	if _, err := h.deps.DB.NewInsert().Model(t).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *ShiftTemplatesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in shiftTemplateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateShiftTemplate(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	res, err := h.deps.DB.NewUpdate().Table("shift_templates").Where("id = ?", id).
		Set("name = ?", strings.TrimSpace(in.Name)).
		Set("start_time = ?", in.StartTime).
		Set("end_time = ?", in.EndTime).
		Set("notes = ?", strings.TrimSpace(in.Notes)).
		Set("status = ?", shiftTemplateStatusOrDefault(in.Status)).
		Set("updated_at = current_timestamp").Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var t models.ShiftTemplate
	if err := h.deps.DB.NewSelect().Model(&t).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *ShiftTemplatesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.ShiftTemplate)(nil)).
		Where("id = ?", id).Exec(r.Context())
	if err != nil {
		if strings.Contains(err.Error(), "violates foreign key constraint") {
			writeError(w, http.StatusBadRequest, "template masih dipakai (jadwal / shift)")
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

func validateShiftTemplate(in *shiftTemplateInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama template wajib diisi"
	}
	if !isHHMM(in.StartTime) {
		return "startTime harus format HH:MM"
	}
	if !isHHMM(in.EndTime) {
		return "endTime harus format HH:MM"
	}
	return ""
}

func shiftTemplateStatusOrDefault(s string) string {
	if strings.TrimSpace(s) == models.ShiftTemplateStatusArchived {
		return models.ShiftTemplateStatusArchived
	}
	return models.ShiftTemplateStatusActive
}

func isHHMM(s string) bool {
	if len(s) != 5 || s[2] != ':' {
		return false
	}
	for i, c := range s {
		if i == 2 {
			continue
		}
		if c < '0' || c > '9' {
			return false
		}
	}
	h := int(s[0]-'0')*10 + int(s[1]-'0')
	m := int(s[3]-'0')*10 + int(s[4]-'0')
	return h < 24 && m < 60
}
