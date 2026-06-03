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

type StockOpnamesHandler struct {
	deps Deps
}

func NewStockOpnamesHandler(deps Deps) *StockOpnamesHandler {
	return &StockOpnamesHandler{deps: deps}
}

func (h *StockOpnamesHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.StockOpname{}
	if err := h.deps.DB.NewSelect().
		Model(&items).
		Relation("Lines").
		Order("started_at DESC").
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for i := range items {
		if items[i].Lines == nil {
			items[i].Lines = []models.StockOpnameLine{}
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *StockOpnamesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var op models.StockOpname
	if err := h.deps.DB.NewSelect().
		Model(&op).
		Relation("Lines").
		Where("so.id = ?", id).
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, op)
}

type opnameLineInput struct {
	ID          string   `json:"id,omitempty"`
	ProductID   string   `json:"productId"`
	VariantID   *string  `json:"variantId,omitempty"`
	ExpectedQty float64  `json:"expectedQty"`
	CountedQty  *float64 `json:"countedQty"`
	UnitCost    float64  `json:"unitCost"`
	Notes       string   `json:"notes"`
}

type opnameCreateInput struct {
	LocationID  *string           `json:"locationId,omitempty"`
	PerformedBy string            `json:"performedBy"`
	Notes       string            `json:"notes"`
	Status      string            `json:"status"`
	Lines       []opnameLineInput `json:"lines"`
}

func (h *StockOpnamesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in opnameCreateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Status == "" {
		in.Status = "draft"
	}
	op := models.StockOpname{
		LocationID:  optUUID(in.LocationID),
		StartedAt:   time.Now(),
		Status:      in.Status,
		PerformedBy: in.PerformedBy,
		Notes:       in.Notes,
	}
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextOpnameCode(ctx, tx)
		if err != nil {
			return err
		}
		op.Code = code
		if _, err := tx.NewInsert().Model(&op).Returning("*").Exec(ctx); err != nil {
			return err
		}
		if len(in.Lines) > 0 {
			rows := make([]models.StockOpnameLine, 0, len(in.Lines))
			for _, l := range in.Lines {
				pid, err := uuid.Parse(l.ProductID)
				if err != nil {
					return fmt.Errorf("line productId invalid: %w", err)
				}
				rows = append(rows, models.StockOpnameLine{
					OpnameID:    op.ID,
					ProductID:   pid,
					VariantID:   optUUID(l.VariantID),
					ExpectedQty: l.ExpectedQty,
					CountedQty:  l.CountedQty,
					UnitCost:    l.UnitCost,
					Notes:       l.Notes,
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
		Model(&op).
		Relation("Lines").
		Where("so.id = ?", op.ID).
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if op.Lines == nil {
		op.Lines = []models.StockOpnameLine{}
	}
	writeJSON(w, http.StatusCreated, op)
}

type opnameUpdateInput struct {
	Status      *string            `json:"status,omitempty"`
	CompletedAt *time.Time         `json:"completedAt,omitempty"`
	Notes       *string            `json:"notes,omitempty"`
	Lines       *[]opnameLineInput `json:"lines,omitempty"`
}

func (h *StockOpnamesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in opnameUpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		q := tx.NewUpdate().Table("stock_opnames").
			Where("id = ?", id).
			Set("updated_at = current_timestamp")
		any := false
		if in.Status != nil {
			q = q.Set("status = ?", *in.Status)
			any = true
		}
		if in.CompletedAt != nil {
			q = q.Set("completed_at = ?", *in.CompletedAt)
			any = true
		}
		if in.Notes != nil {
			q = q.Set("notes = ?", *in.Notes)
			any = true
		}
		if any {
			res, err := q.Exec(ctx)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				return fmt.Errorf("not found")
			}
		}
		if in.Lines != nil {
			if _, err := tx.NewDelete().Table("stock_opname_lines").
				Where("opname_id = ?", id).Exec(ctx); err != nil {
				return err
			}
			if len(*in.Lines) > 0 {
				rows := make([]models.StockOpnameLine, 0, len(*in.Lines))
				for _, l := range *in.Lines {
					pid, err := uuid.Parse(l.ProductID)
					if err != nil {
						return fmt.Errorf("line productId invalid: %w", err)
					}
					rows = append(rows, models.StockOpnameLine{
						OpnameID:    id,
						ProductID:   pid,
						VariantID:   optUUID(l.VariantID),
						ExpectedQty: l.ExpectedQty,
						CountedQty:  l.CountedQty,
						UnitCost:    l.UnitCost,
						Notes:       l.Notes,
					})
				}
				if _, err := tx.NewInsert().Model(&rows).Exec(ctx); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		if err.Error() == "not found" {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var op models.StockOpname
	if err := h.deps.DB.NewSelect().
		Model(&op).
		Relation("Lines").
		Where("so.id = ?", id).
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if op.Lines == nil {
		op.Lines = []models.StockOpnameLine{}
	}
	writeJSON(w, http.StatusOK, op)
}

func nextOpnameCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("OPN-%d-", year)
	var count int
	if err := tx.NewSelect().Table("stock_opnames").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}
