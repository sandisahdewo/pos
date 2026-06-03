package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type StockMovementsHandler struct {
	deps Deps
}

func NewStockMovementsHandler(deps Deps) *StockMovementsHandler {
	return &StockMovementsHandler{deps: deps}
}

func (h *StockMovementsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.StockMovement{}
	q := h.deps.DB.NewSelect().Model(&items).Order("happened_at DESC")
	if v := strings.TrimSpace(r.URL.Query().Get("productId")); v != "" {
		if _, err := uuid.Parse(v); err == nil {
			q = q.Where("product_id = ?", v)
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("locationId")); v != "" {
		if _, err := uuid.Parse(v); err == nil {
			q = q.Where("location_id = ?", v)
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("batchId")); v != "" {
		if _, err := uuid.Parse(v); err == nil {
			q = q.Where("batch_id = ?", v)
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
			q = q.Limit(n)
		}
	}
	if err := q.Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

// Create logs a single movement. Code generated server-side.
func (h *StockMovementsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.StockMovement
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(in.Kind) == "" {
		writeError(w, http.StatusBadRequest, "kind wajib diisi")
		return
	}
	in.ID = uuid.Nil
	if in.At.IsZero() {
		in.At = time.Now()
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextMovementCode(ctx, tx, in.At)
		if err != nil {
			return err
		}
		in.Code = code
		_, err = tx.NewInsert().Model(&in).Returning("*").Exec(ctx)
		return err
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, in)
}

func nextMovementCode(ctx context.Context, tx bun.Tx, at time.Time) (string, error) {
	year := at.Year()
	prefix := fmt.Sprintf("MOV-%d-", year)
	var count int
	if err := tx.NewSelect().Table("stock_movements").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%04d", prefix, count+1), nil
}
