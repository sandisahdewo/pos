package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type OrdersHandler struct {
	deps Deps
}

func NewOrdersHandler(deps Deps) *OrdersHandler {
	return &OrdersHandler{deps: deps}
}

func (h *OrdersHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := loadOrders(r.Context(), h.deps.DB, r.URL.Query())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if items == nil {
		items = []models.Order{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *OrdersHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	o, err := loadOrder(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, o)
}

func (h *OrdersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.Order
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.ID = uuid.Nil
	normalizeOrder(&in)

	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextOrderCode(ctx, tx)
		if err != nil {
			return err
		}
		in.Code = code
		if _, err := tx.NewInsert().Model(&in).Returning("*").Exec(ctx); err != nil {
			return err
		}
		return saveOrderChildren(ctx, tx, &in)
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	full, err := loadOrder(r.Context(), h.deps.DB, in.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, full)
}

func (h *OrdersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in models.Order
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.ID = id
	normalizeOrder(&in)

	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		res, err := tx.NewUpdate().Model(&in).WherePK().
			ExcludeColumn("id", "code", "created_at", "updated_at").
			Set("updated_at = current_timestamp").Exec(ctx)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return errNotFound
		}
		return saveOrderChildren(ctx, tx, &in)
	})
	if errors.Is(err, errNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	full, err := loadOrder(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, full)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func normalizeOrder(o *models.Order) {
	o.Status = orderStatusOrDefault(o.Status)
	o.PaymentMethod = orderPaymentMethodOrDefault(o.PaymentMethod)
	o.Notes = strings.TrimSpace(o.Notes)
	o.EnsureSlices()
}

func orderStatusOrDefault(s string) string {
	switch strings.TrimSpace(s) {
	case models.OrderStatusCredit, models.OrderStatusCancelled:
		return s
	}
	return models.OrderStatusPaid
}

func orderPaymentMethodOrDefault(s string) string {
	switch strings.TrimSpace(s) {
	case models.PaymentMethodCard, models.PaymentMethodQRIS, models.PaymentMethodTransfer:
		return s
	}
	return models.PaymentMethodCash
}

func nextOrderCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("ORD-%d-", year)
	var count int
	err := tx.NewSelect().Table("orders").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}

func loadOrders(ctx context.Context, db *bun.DB, q map[string][]string) ([]models.Order, error) {
	var orders []models.Order
	qb := db.NewSelect().Model(&orders).Order("created_at DESC")
	if vals := q["status"]; len(vals) > 0 && vals[0] != "" {
		qb = qb.Where("status = ?", vals[0])
	}
	if vals := q["customerId"]; len(vals) > 0 && vals[0] != "" {
		if _, err := uuid.Parse(vals[0]); err == nil {
			qb = qb.Where("customer_id = ?", vals[0])
		}
	}
	if err := qb.Scan(ctx); err != nil {
		return nil, err
	}
	if len(orders) == 0 {
		return orders, nil
	}
	ids := make([]uuid.UUID, len(orders))
	idx := make(map[uuid.UUID]int, len(orders))
	for i := range orders {
		ids[i] = orders[i].ID
		idx[orders[i].ID] = i
		orders[i].EnsureSlices()
	}
	var lines []models.OrderLine
	if err := db.NewSelect().Model(&lines).
		Where("order_id IN (?)", bun.In(ids)).
		Order("position ASC").Scan(ctx); err != nil {
		return nil, err
	}
	for _, l := range lines {
		i := idx[l.OrderID]
		orders[i].Lines = append(orders[i].Lines, l)
	}
	var payments []models.OrderPayment
	if err := db.NewSelect().Model(&payments).
		Where("order_id IN (?)", bun.In(ids)).
		Order("paid_at ASC").Scan(ctx); err != nil {
		return nil, err
	}
	for _, p := range payments {
		i := idx[p.OrderID]
		orders[i].Payments = append(orders[i].Payments, p)
	}
	return orders, nil
}

func loadOrder(ctx context.Context, db *bun.DB, id uuid.UUID) (*models.Order, error) {
	var o models.Order
	if err := db.NewSelect().Model(&o).Where("id = ?", id).Scan(ctx); err != nil {
		return nil, err
	}
	o.EnsureSlices()
	if err := db.NewSelect().Model(&o.Lines).
		Where("order_id = ?", id).Order("position ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if err := db.NewSelect().Model(&o.Payments).
		Where("order_id = ?", id).Order("paid_at ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if o.Lines == nil {
		o.Lines = []models.OrderLine{}
	}
	if o.Payments == nil {
		o.Payments = []models.OrderPayment{}
	}
	return &o, nil
}

// saveOrderChildren — lines DIFF (IDs stable so future receipts /
// stockMovements refs hold), payments REPLACE.
func saveOrderChildren(ctx context.Context, tx bun.Tx, o *models.Order) error {
	if err := syncOrderLines(ctx, tx, o); err != nil {
		return err
	}
	return syncOrderPayments(ctx, tx, o)
}

func syncOrderLines(ctx context.Context, tx bun.Tx, o *models.Order) error {
	var existing []models.OrderLine
	if err := tx.NewSelect().Model(&existing).
		Where("order_id = ?", o.ID).Scan(ctx); err != nil {
		return err
	}
	existingByID := map[uuid.UUID]bool{}
	for _, l := range existing {
		existingByID[l.ID] = true
	}
	incomingByID := map[uuid.UUID]bool{}

	for i := range o.Lines {
		l := &o.Lines[i]
		l.OrderID = o.ID
		l.Position = i
		if l.UnitFactor <= 0 {
			l.UnitFactor = 1
		}
		if l.Extras == nil {
			l.Extras = []models.OrderLineExtra{}
		}
		if l.BatchAllocations == nil {
			l.BatchAllocations = []models.BatchAllocation{}
		}
		if l.ID != uuid.Nil && existingByID[l.ID] {
			incomingByID[l.ID] = true
			if _, err := tx.NewUpdate().Model(l).WherePK().Exec(ctx); err != nil {
				return err
			}
		} else {
			l.ID = uuid.Nil
			if _, err := tx.NewInsert().Model(l).Exec(ctx); err != nil {
				return err
			}
		}
	}
	for _, l := range existing {
		if incomingByID[l.ID] {
			continue
		}
		if _, err := tx.NewDelete().Model((*models.OrderLine)(nil)).
			Where("id = ?", l.ID).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func syncOrderPayments(ctx context.Context, tx bun.Tx, o *models.Order) error {
	if _, err := tx.NewDelete().Model((*models.OrderPayment)(nil)).
		Where("order_id = ?", o.ID).Exec(ctx); err != nil {
		return err
	}
	for i := range o.Payments {
		p := &o.Payments[i]
		p.ID = uuid.Nil
		p.OrderID = o.ID
		if p.Method == "" {
			p.Method = models.PaymentMethodCash
		}
		if _, err := tx.NewInsert().Model(p).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}
