package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type CustomersHandler struct {
	deps Deps
}

func NewCustomersHandler(deps Deps) *CustomersHandler {
	return &CustomersHandler{deps: deps}
}

type customerInput struct {
	Name          string  `json:"name"`
	Type          string  `json:"type"`
	Email         string  `json:"email"`
	Phone         string  `json:"phone"`
	Address       string  `json:"address"`
	PricelistID   *string `json:"pricelistId,omitempty"`
	TaxID         string  `json:"taxId"`
	Status        string  `json:"status"`
	CreditAllowed bool    `json:"creditAllowed"`
	Notes         string  `json:"notes"`
	JoinedAt      string  `json:"joinedAt"`
}

func (h *CustomersHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Customer{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("name ASC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *CustomersHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var c models.Customer
	if err := h.deps.DB.NewSelect().Model(&c).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *CustomersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in customerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateCustomer(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	c := buildCustomer(&in)
	if _, err := h.deps.DB.NewInsert().Model(c).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *CustomersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in customerInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateCustomer(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	row := buildCustomer(&in)
	row.ID = id
	res, err := h.deps.DB.NewUpdate().Model(row).WherePK().
		ExcludeColumn("id", "created_at", "updated_at").
		Set("updated_at = current_timestamp").Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (h *CustomersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.Customer)(nil)).Where("id = ?", id).Exec(r.Context())
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

func validateCustomer(in *customerInput) string {
	if strings.TrimSpace(in.Name) == "" {
		return "nama wajib diisi"
	}
	return ""
}

func buildCustomer(in *customerInput) *models.Customer {
	c := &models.Customer{
		Name:          strings.TrimSpace(in.Name),
		Type:          customerTypeOrDefault(in.Type),
		Email:         strings.TrimSpace(in.Email),
		Phone:         strings.TrimSpace(in.Phone),
		Address:       strings.TrimSpace(in.Address),
		TaxID:         strings.TrimSpace(in.TaxID),
		Status:        customerStatusOrDefault(in.Status),
		CreditAllowed: in.CreditAllowed,
		Notes:         strings.TrimSpace(in.Notes),
		JoinedAt:      strings.TrimSpace(in.JoinedAt),
	}
	if in.PricelistID != nil && strings.TrimSpace(*in.PricelistID) != "" {
		s := strings.TrimSpace(*in.PricelistID)
		c.PricelistID = &s
	}
	return c
}

func customerTypeOrDefault(s string) string {
	if strings.TrimSpace(s) == models.CustomerTypeBusiness {
		return models.CustomerTypeBusiness
	}
	return models.CustomerTypeIndividual
}

func customerStatusOrDefault(s string) string {
	if strings.TrimSpace(s) == models.CustomerStatusArchived {
		return models.CustomerStatusArchived
	}
	return models.CustomerStatusActive
}
