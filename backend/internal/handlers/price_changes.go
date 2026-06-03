package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type PriceChangesHandler struct {
	deps Deps
}

func NewPriceChangesHandler(deps Deps) *PriceChangesHandler {
	return &PriceChangesHandler{deps: deps}
}

func (h *PriceChangesHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.PriceChange{}
	q := h.deps.DB.NewSelect().Model(&items).Order("happened_at DESC")
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 5000 {
			q = q.Limit(n)
		}
	}
	if err := q.Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

type priceChangeInput struct {
	ProductID      *string         `json:"productId,omitempty"`
	ProductName    string          `json:"productName"`
	VariantID      *string         `json:"variantId,omitempty"`
	VariantName    string          `json:"variantName"`
	PackagingIndex *int            `json:"packagingIndex,omitempty"`
	PackagingLabel string          `json:"packagingLabel"`
	PricelistID    *string         `json:"pricelistId,omitempty"`
	PricelistName  string          `json:"pricelistName"`
	TierMinQty     *float64        `json:"tierMinQty,omitempty"`
	OldStrategy    json.RawMessage `json:"oldStrategy"`
	NewStrategy    json.RawMessage `json:"newStrategy"`
	OldSale        float64         `json:"oldSale"`
	NewSale        float64         `json:"newSale"`
	Cost           float64         `json:"cost"`
	Source         string          `json:"source"`
	Notes          string          `json:"notes"`
	PerformedBy    string          `json:"performedBy"`
	At             *time.Time      `json:"at,omitempty"`
}

type priceChangeBulkInput struct {
	Items []priceChangeInput `json:"items"`
}

func (h *PriceChangesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in priceChangeBulkInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(in.Items) == 0 {
		writeJSON(w, http.StatusCreated, []models.PriceChange{})
		return
	}

	created := make([]models.PriceChange, 0, len(in.Items))
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		for _, it := range in.Items {
			row := models.PriceChange{
				ProductID:      optUUID(it.ProductID),
				ProductName:    it.ProductName,
				VariantID:      optUUID(it.VariantID),
				VariantName:    it.VariantName,
				PackagingIndex: it.PackagingIndex,
				PackagingLabel: it.PackagingLabel,
				PricelistID:    it.PricelistID,
				PricelistName:  it.PricelistName,
				TierMinQty:     it.TierMinQty,
				OldStrategy:    nonEmptyJSON(it.OldStrategy),
				NewStrategy:    nonEmptyJSON(it.NewStrategy),
				OldSale:        it.OldSale,
				NewSale:        it.NewSale,
				Cost:           it.Cost,
				Source:         orDefault(it.Source, "manual"),
				Notes:          it.Notes,
				PerformedBy:    it.PerformedBy,
			}
			if it.At != nil {
				row.At = *it.At
			} else {
				row.At = time.Now()
			}
			code, err := nextPriceChangeCode(ctx, tx, row.At)
			if err != nil {
				return err
			}
			row.Code = code
			if _, err := tx.NewInsert().Model(&row).Returning("*").Exec(ctx); err != nil {
				return err
			}
			created = append(created, row)
		}
		return nil
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func nextPriceChangeCode(ctx context.Context, tx bun.Tx, at time.Time) (string, error) {
	year := at.Year()
	prefix := fmt.Sprintf("PCH-%d-", year)
	var count int
	if err := tx.NewSelect().Table("price_changes").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%04d", prefix, count+1), nil
}

func nonEmptyJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage("{}")
	}
	return raw
}

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

