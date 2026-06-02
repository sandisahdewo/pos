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

type PurchaseOrdersHandler struct {
	deps Deps
}

func NewPurchaseOrdersHandler(deps Deps) *PurchaseOrdersHandler {
	return &PurchaseOrdersHandler{deps: deps}
}

func (h *PurchaseOrdersHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := loadPurchaseOrders(r.Context(), h.deps.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if items == nil {
		items = []models.PurchaseOrder{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *PurchaseOrdersHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	po, err := loadPurchaseOrder(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, po)
}

func (h *PurchaseOrdersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.PurchaseOrder
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validatePO(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	in.ID = uuid.Nil
	normalizePO(&in)

	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextPOCode(ctx, tx)
		if err != nil {
			return err
		}
		in.Code = code
		if _, err := tx.NewInsert().Model(&in).Returning("*").Exec(ctx); err != nil {
			return err
		}
		return savePOChildren(ctx, tx, &in)
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	full, err := loadPurchaseOrder(r.Context(), h.deps.DB, in.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, full)
}

func (h *PurchaseOrdersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in models.PurchaseOrder
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validatePO(&in); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	in.ID = id
	normalizePO(&in)

	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		res, err := tx.NewUpdate().Model(&in).
			WherePK().
			ExcludeColumn("id", "code", "created_at", "updated_at").
			Set("updated_at = current_timestamp").
			Exec(ctx)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return errNotFound
		}
		return savePOChildren(ctx, tx, &in)
	})
	if errors.Is(err, errNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	full, err := loadPurchaseOrder(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, full)
}

func (h *PurchaseOrdersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	// Frontend rule: only drafts can be deleted. Enforce here too.
	var existing models.PurchaseOrder
	if err := h.deps.DB.NewSelect().Model(&existing).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if existing.Status != models.POStatusDraft {
		writeError(w, http.StatusBadRequest, "hanya draft yang bisa dihapus")
		return
	}
	if _, err := h.deps.DB.NewDelete().Model((*models.PurchaseOrder)(nil)).
		Where("id = ?", id).Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func validatePO(p *models.PurchaseOrder) string {
	if strings.TrimSpace(p.OrderDate) == "" {
		return "orderDate wajib diisi"
	}
	if p.SupplierID == uuid.Nil {
		return "supplierId wajib diisi"
	}
	return ""
}

func normalizePO(p *models.PurchaseOrder) {
	p.Type = poTypeOrDefault(p.Type)
	p.Status = poStatusOrDefault(p.Status)
	p.OrderDate = strings.TrimSpace(p.OrderDate)
	p.ExpectedDate = strings.TrimSpace(p.ExpectedDate)
	p.ReceivedDate = strings.TrimSpace(p.ReceivedDate)
	p.Notes = strings.TrimSpace(p.Notes)
	p.EnsureSlices()
}

func poTypeOrDefault(s string) string {
	if strings.TrimSpace(s) == models.POTypeConsignment {
		return models.POTypeConsignment
	}
	return models.POTypeStandard
}

func poStatusOrDefault(s string) string {
	switch strings.TrimSpace(s) {
	case models.POStatusSent, models.POStatusPartial, models.POStatusReceived, models.POStatusCancelled:
		return s
	}
	return models.POStatusDraft
}

// nextPOCode generates the next PO code for the current year. Format:
// PO-YYYY-NNN where NNN is 3-digit padded. Counts existing rows whose code
// matches the year prefix so the sequence resets each January. A UNIQUE
// constraint catches the rare concurrent-insert race.
func nextPOCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("PO-%d-", year)
	var count int
	err := tx.NewSelect().Table("purchase_orders").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}
