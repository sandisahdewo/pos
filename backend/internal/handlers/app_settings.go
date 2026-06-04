package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sandisahdewo/pos/backend/internal/models"
)

type AppSettingsHandler struct {
	deps Deps
}

func NewAppSettingsHandler(deps Deps) *AppSettingsHandler {
	return &AppSettingsHandler{deps: deps}
}

func (h *AppSettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	var s models.AppSettings
	err := h.deps.DB.NewSelect().Model(&s).Where("id = 1").Scan(r.Context())
	if err != nil {
		// Auto-create the singleton row if missing.
		s = models.AppSettings{ID: 1, Value: json.RawMessage("{}")}
		if _, err := h.deps.DB.NewInsert().Model(&s).Exec(r.Context()); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, s)
}

type appSettingsInput struct {
	Value json.RawMessage `json:"value"`
}

func (h *AppSettingsHandler) Put(w http.ResponseWriter, r *http.Request) {
	var in appSettingsInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(in.Value) == 0 {
		in.Value = json.RawMessage("{}")
	}
	res, err := h.deps.DB.NewUpdate().Table("app_settings").
		Where("id = 1").
		Set("value = ?", in.Value).
		Set("updated_at = current_timestamp").
		Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Insert the singleton if it didn't exist yet.
		s := models.AppSettings{ID: 1, Value: in.Value}
		if _, err := h.deps.DB.NewInsert().Model(&s).Exec(r.Context()); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	var s models.AppSettings
	if err := h.deps.DB.NewSelect().Model(&s).Where("id = 1").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, s)
}
