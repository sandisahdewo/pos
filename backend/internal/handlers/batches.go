package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type BatchesHandler struct {
	deps Deps
}

func NewBatchesHandler(deps Deps) *BatchesHandler {
	return &BatchesHandler{deps: deps}
}

func (h *BatchesHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Batch{}
	q := h.deps.DB.NewSelect().Model(&items).Order("received_at DESC, created_at DESC")
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
	if v := strings.TrimSpace(r.URL.Query().Get("supplierId")); v != "" {
		if _, err := uuid.Parse(v); err == nil {
			q = q.Where("supplier_id = ?", v)
		}
	}
	if v := strings.TrimSpace(r.URL.Query().Get("sourcePurchaseOrderId")); v != "" {
		if _, err := uuid.Parse(v); err == nil {
			q = q.Where("source_purchase_order_id = ?", v)
		}
	}
	if err := q.Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *BatchesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var b models.Batch
	if err := h.deps.DB.NewSelect().Model(&b).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (h *BatchesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.Batch
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateBatch(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	in.ID = uuid.Nil
	if in.Ownership != models.BatchOwnershipConsignment {
		in.Ownership = models.BatchOwnershipOwned
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextBatchCode(ctx, tx)
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

// Update accepts a partial-ish payload — only mutates the fields the
// frontend store typically changes (qty_remaining, location, notes,
// expires_at). The rest stay as snapshotted at insert.
type batchUpdateInput struct {
	QtyRemaining *float64 `json:"qtyRemaining,omitempty"`
	LocationID   *string  `json:"locationId,omitempty"`
	ExpiresAt    *string  `json:"expiresAt,omitempty"`
	Notes        *string  `json:"notes,omitempty"`
}

func (h *BatchesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in batchUpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	q := h.deps.DB.NewUpdate().Table("batches").Where("id = ?", id).
		Set("updated_at = current_timestamp")
	any := false
	if in.QtyRemaining != nil {
		q = q.Set("qty_remaining = ?", *in.QtyRemaining)
		any = true
	}
	if in.LocationID != nil && *in.LocationID != "" {
		loc, err := uuid.Parse(*in.LocationID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "locationId tidak valid")
			return
		}
		q = q.Set("location_id = ?", loc)
		any = true
	}
	if in.ExpiresAt != nil {
		q = q.Set("expires_at = ?", *in.ExpiresAt)
		any = true
	}
	if in.Notes != nil {
		q = q.Set("notes = ?", *in.Notes)
		any = true
	}
	if !any {
		writeError(w, http.StatusBadRequest, "tidak ada field yang diubah")
		return
	}
	res, err := q.Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var b models.Batch
	if err := h.deps.DB.NewSelect().Model(&b).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, b)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func validateBatch(b *models.Batch) string {
	if b.ProductID == uuid.Nil {
		return "productId wajib diisi"
	}
	if b.LocationID == uuid.Nil {
		return "locationId wajib diisi"
	}
	if b.QtyReceived <= 0 {
		return "qtyReceived harus lebih dari 0"
	}
	if b.QtyRemaining < 0 {
		return "qtyRemaining tidak boleh negatif"
	}
	return ""
}

func nextBatchCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("BATCH-%d-", year)
	var count int
	if err := tx.NewSelect().Table("batches").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}
