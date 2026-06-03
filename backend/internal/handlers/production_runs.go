package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type ProductionRunsHandler struct {
	deps Deps
}

func NewProductionRunsHandler(deps Deps) *ProductionRunsHandler {
	return &ProductionRunsHandler{deps: deps}
}

func (h *ProductionRunsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.ProductionRun{}
	if err := h.deps.DB.NewSelect().
		Model(&items).
		Relation("Consumptions").
		Order("created_at DESC").
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for i := range items {
		if items[i].Consumptions == nil {
			items[i].Consumptions = []models.ProductionRunConsumption{}
		}
	}
	writeJSON(w, http.StatusOK, items)
}

type productionRunCreateInput struct {
	ProductID             string     `json:"productId"`
	VariantID             *string    `json:"variantId,omitempty"`
	IntendedQty           float64    `json:"intendedQty"`
	ProducedQty           float64    `json:"producedQty"`
	ProducedBatchID       *string    `json:"producedBatchId,omitempty"`
	UnitCost              float64    `json:"unitCost"`
	LocationID            string     `json:"locationId"`
	ExpiresAt             string     `json:"expiresAt"`
	ShiftID               *string    `json:"shiftId,omitempty"`
	Status                string     `json:"status"`
	Notes                 string     `json:"notes"`
	ComponentConsumptions []consInput `json:"componentConsumptions"`
}

type consInput struct {
	ProductID   string  `json:"productId"`
	VariantID   *string `json:"variantId,omitempty"`
	BatchID     *string `json:"batchId,omitempty"`
	BatchCode   string  `json:"batchCode"`
	QtyConsumed float64 `json:"qtyConsumed"`
	UnitCost    float64 `json:"unitCost"`
}

func (h *ProductionRunsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in productionRunCreateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	productID, err := uuid.Parse(in.ProductID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "productId tidak valid")
		return
	}
	locationID, err := uuid.Parse(in.LocationID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "locationId tidak valid")
		return
	}
	if in.IntendedQty <= 0 || in.ProducedQty <= 0 {
		writeError(w, http.StatusBadRequest, "qty harus lebih dari 0")
		return
	}
	if in.Status == "" {
		in.Status = "completed"
	}

	run := models.ProductionRun{
		ProductID:   productID,
		VariantID:   optUUID(in.VariantID),
		IntendedQty: in.IntendedQty,
		ProducedQty: in.ProducedQty,
		ProducedBatchID: optUUID(in.ProducedBatchID),
		UnitCost:    in.UnitCost,
		LocationID:  locationID,
		ExpiresAt:   in.ExpiresAt,
		ShiftID:     optUUID(in.ShiftID),
		Status:      in.Status,
		Notes:       in.Notes,
	}

	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextProductionRunCode(ctx, tx)
		if err != nil {
			return err
		}
		run.Code = code
		if _, err := tx.NewInsert().Model(&run).Returning("*").Exec(ctx); err != nil {
			return err
		}
		if len(in.ComponentConsumptions) > 0 {
			rows := make([]models.ProductionRunConsumption, 0, len(in.ComponentConsumptions))
			for _, c := range in.ComponentConsumptions {
				pid, err := uuid.Parse(c.ProductID)
				if err != nil {
					return fmt.Errorf("consumption productId invalid: %w", err)
				}
				rows = append(rows, models.ProductionRunConsumption{
					ProductionRunID: run.ID,
					ProductID:       pid,
					VariantID:       optUUID(c.VariantID),
					BatchID:         optUUID(c.BatchID),
					BatchCode:       c.BatchCode,
					QtyConsumed:     c.QtyConsumed,
					UnitCost:        c.UnitCost,
				})
			}
			if _, err := tx.NewInsert().Model(&rows).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := h.deps.DB.NewSelect().
		Model(&run).
		Relation("Consumptions").
		Where("pr.id = ?", run.ID).
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if run.Consumptions == nil {
		run.Consumptions = []models.ProductionRunConsumption{}
	}
	writeJSON(w, http.StatusCreated, run)
}

func nextProductionRunCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("PROD-%d-", year)
	var count int
	if err := tx.NewSelect().Table("production_runs").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}

func optUUID(s *string) *uuid.UUID {
	if s == nil {
		return nil
	}
	v := *s
	if v == "" {
		return nil
	}
	u, err := uuid.Parse(v)
	if err != nil {
		return nil
	}
	return &u
}
