package handlers

import (
	"context"

	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

func loadPurchaseOrders(ctx context.Context, db *bun.DB) ([]models.PurchaseOrder, error) {
	var pos []models.PurchaseOrder
	if err := db.NewSelect().Model(&pos).
		Order("order_date DESC, created_at DESC").Scan(ctx); err != nil {
		return nil, err
	}
	if len(pos) == 0 {
		return pos, nil
	}
	ids := make([]uuid.UUID, len(pos))
	idx := make(map[uuid.UUID]int, len(pos))
	for i := range pos {
		ids[i] = pos[i].ID
		idx[pos[i].ID] = i
		pos[i].EnsureSlices()
	}

	var lines []models.PurchaseOrderLine
	if err := db.NewSelect().Model(&lines).
		Where("purchase_order_id IN (?)", bun.In(ids)).
		Order("position ASC").Scan(ctx); err != nil {
		return nil, err
	}
	for _, l := range lines {
		i := idx[l.PurchaseOrderID]
		pos[i].Lines = append(pos[i].Lines, l)
	}

	var payments []models.PurchaseOrderPayment
	if err := db.NewSelect().Model(&payments).
		Where("purchase_order_id IN (?)", bun.In(ids)).
		Order("paid_at ASC").Scan(ctx); err != nil {
		return nil, err
	}
	for _, p := range payments {
		i := idx[p.PurchaseOrderID]
		pos[i].Payments = append(pos[i].Payments, p)
	}
	return pos, nil
}

func loadPurchaseOrder(ctx context.Context, db *bun.DB, id uuid.UUID) (*models.PurchaseOrder, error) {
	var po models.PurchaseOrder
	if err := db.NewSelect().Model(&po).Where("id = ?", id).Scan(ctx); err != nil {
		return nil, err
	}
	po.EnsureSlices()
	if err := db.NewSelect().Model(&po.Lines).
		Where("purchase_order_id = ?", id).
		Order("position ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if err := db.NewSelect().Model(&po.Payments).
		Where("purchase_order_id = ?", id).
		Order("paid_at ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if po.Lines == nil {
		po.Lines = []models.PurchaseOrderLine{}
	}
	if po.Payments == nil {
		po.Payments = []models.PurchaseOrderPayment{}
	}
	return &po, nil
}

// savePOChildren applies lines (DIFF: preserve IDs so future batch references
// stay valid) and payments (REPLACE: no FK targets payment IDs externally).
func savePOChildren(
	ctx context.Context, tx bun.Tx, po *models.PurchaseOrder,
) error {
	if err := syncPOLines(ctx, tx, po); err != nil {
		return err
	}
	return syncPOPayments(ctx, tx, po)
}

func syncPOLines(ctx context.Context, tx bun.Tx, po *models.PurchaseOrder) error {
	var existing []models.PurchaseOrderLine
	if err := tx.NewSelect().Model(&existing).
		Where("purchase_order_id = ?", po.ID).Scan(ctx); err != nil {
		return err
	}
	existingByID := map[uuid.UUID]bool{}
	for _, l := range existing {
		existingByID[l.ID] = true
	}
	incomingByID := map[uuid.UUID]bool{}

	for i := range po.Lines {
		l := &po.Lines[i]
		l.PurchaseOrderID = po.ID
		l.Position = i
		if l.UnitFactor <= 0 {
			l.UnitFactor = 1
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
		if _, err := tx.NewDelete().Model((*models.PurchaseOrderLine)(nil)).
			Where("id = ?", l.ID).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func syncPOPayments(ctx context.Context, tx bun.Tx, po *models.PurchaseOrder) error {
	if _, err := tx.NewDelete().Model((*models.PurchaseOrderPayment)(nil)).
		Where("purchase_order_id = ?", po.ID).Exec(ctx); err != nil {
		return err
	}
	for i := range po.Payments {
		p := &po.Payments[i]
		p.ID = uuid.Nil
		p.PurchaseOrderID = po.ID
		if p.Method == "" {
			p.Method = models.POPaymentCash
		}
		if _, err := tx.NewInsert().Model(p).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}
