package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type SuppliersHandler struct {
	deps Deps
}

func NewSuppliersHandler(deps Deps) *SuppliersHandler {
	return &SuppliersHandler{deps: deps}
}

type supplierInput struct {
	Name          string `json:"name"`
	ContactPerson string `json:"contactPerson"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
	LeadTimeDays  int    `json:"leadTimeDays"`
	Status        string `json:"status"`
	Notes         string `json:"notes"`
}

func (h *SuppliersHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Supplier{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *SuppliersHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var s models.Supplier
	if err := h.deps.DB.NewSelect().Model(&s).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *SuppliersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in supplierInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateSupplierInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	s := &models.Supplier{
		Name:          strings.TrimSpace(in.Name),
		ContactPerson: strings.TrimSpace(in.ContactPerson),
		Email:         strings.TrimSpace(in.Email),
		Phone:         strings.TrimSpace(in.Phone),
		Address:       strings.TrimSpace(in.Address),
		LeadTimeDays:  in.LeadTimeDays,
		Status:        supplierStatusOrDefault(in.Status),
		Notes:         strings.TrimSpace(in.Notes),
	}
	if _, err := h.deps.DB.NewInsert().Model(s).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (h *SuppliersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in supplierInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateSupplierInput(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	res, err := h.deps.DB.NewUpdate().Table("suppliers").Where("id = ?", id).
		Set("name = ?", strings.TrimSpace(in.Name)).
		Set("contact_person = ?", strings.TrimSpace(in.ContactPerson)).
		Set("email = ?", strings.TrimSpace(in.Email)).
		Set("phone = ?", strings.TrimSpace(in.Phone)).
		Set("address = ?", strings.TrimSpace(in.Address)).
		Set("lead_time_days = ?", in.LeadTimeDays).
		Set("status = ?", supplierStatusOrDefault(in.Status)).
		Set("notes = ?", strings.TrimSpace(in.Notes)).
		Set("updated_at = current_timestamp").
		Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var s models.Supplier
	if err := h.deps.DB.NewSelect().Model(&s).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *SuppliersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Supplier)(nil)).Where("id = ?", id).Exec(r.Context())
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

func validateSupplierInput(in *supplierInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama pemasok wajib diisi"
	}
	if in.LeadTimeDays < 0 {
		return "lead time tidak boleh negatif"
	}
	return ""
}

func supplierStatusOrDefault(s string) string {
	s = strings.TrimSpace(s)
	if s == models.SupplierStatusArchived {
		return models.SupplierStatusArchived
	}
	return models.SupplierStatusActive
}
