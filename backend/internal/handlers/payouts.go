package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type PayoutsHandler struct {
	deps Deps
}

func NewPayoutsHandler(deps Deps) *PayoutsHandler {
	return &PayoutsHandler{deps: deps}
}

func (h *PayoutsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Payout{}
	if err := h.deps.DB.NewSelect().Model(&items).Order("paid_at DESC").Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

type payoutInput struct {
	SupplierID         string  `json:"supplierId"`
	Amount             float64 `json:"amount"`
	PaidAt             string  `json:"paidAt"`
	Method             string  `json:"method"`
	CoversPeriodStart  string  `json:"coversPeriodStart"`
	CoversPeriodEnd    string  `json:"coversPeriodEnd"`
	Notes              string  `json:"notes"`
}

func (h *PayoutsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in payoutInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	supplierID, err := uuid.Parse(in.SupplierID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "supplierId tidak valid")
		return
	}
	if in.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "amount harus lebih dari 0")
		return
	}
	if in.Method == "" {
		in.Method = "cash"
	}
	p := models.Payout{
		SupplierID:        supplierID,
		Amount:            in.Amount,
		PaidAt:            in.PaidAt,
		Method:            in.Method,
		CoversPeriodStart: in.CoversPeriodStart,
		CoversPeriodEnd:   in.CoversPeriodEnd,
		Notes:             in.Notes,
	}
	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextPayoutCode(ctx, tx)
		if err != nil {
			return err
		}
		p.Code = code
		_, err = tx.NewInsert().Model(&p).Returning("*").Exec(ctx)
		return err
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (h *PayoutsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Table("payouts").Where("id = ?", id).Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": id.String()})
}

func nextPayoutCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("PAYOUT-%d-", year)
	var count int
	if err := tx.NewSelect().Table("payouts").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}
