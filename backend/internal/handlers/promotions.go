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

type PromotionsHandler struct {
	deps Deps
}

func NewPromotionsHandler(deps Deps) *PromotionsHandler {
	return &PromotionsHandler{deps: deps}
}

func (h *PromotionsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.Promotion{}
	if err := h.deps.DB.NewSelect().
		Model(&items).
		Relation("ComboItems").
		Relation("ProductScopes").
		Relation("CategoryScopes").
		Order("created_at DESC").
		Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	for i := range items {
		ensurePromoArrays(&items[i])
	}
	resp := make([]map[string]any, len(items))
	for i := range items {
		resp[i] = promotionToResponse(&items[i])
	}
	writeJSON(w, http.StatusOK, resp)
}

type promoComboItemInput struct {
	ProductID  string   `json:"productId"`
	VariantID  *string  `json:"variantId,omitempty"`
	UnitID     *string  `json:"unitId,omitempty"`
	UnitFactor *float64 `json:"unitFactor,omitempty"`
	Quantity   float64  `json:"quantity"`
}

type promoProductScopeInput struct {
	ProductID  string   `json:"productId"`
	VariantID  *string  `json:"variantId,omitempty"`
	UnitID     *string  `json:"unitId,omitempty"`
	UnitFactor *float64 `json:"unitFactor,omitempty"`
}

type promotionInput struct {
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	Level      string `json:"level"`
	Status     string `json:"status"`
	UsageLimit *int   `json:"usageLimit,omitempty"`

	DiscountUnit  *string  `json:"discountUnit,omitempty"`
	DiscountValue *float64 `json:"discountValue,omitempty"`

	ComboPrice *float64 `json:"comboPrice,omitempty"`

	BuyQuantity   *float64 `json:"buyQuantity,omitempty"`
	GetQuantity   *float64 `json:"getQuantity,omitempty"`
	BogoProductID *string  `json:"bogoProductId,omitempty"`
	BogoVariantID *string  `json:"bogoVariantId,omitempty"`
	BuyUnitID     *string  `json:"buyUnitId,omitempty"`
	BuyUnitFactor *float64 `json:"buyUnitFactor,omitempty"`
	GetUnitID     *string  `json:"getUnitId,omitempty"`
	GetUnitFactor *float64 `json:"getUnitFactor,omitempty"`

	MemberPricelistID *string  `json:"memberPricelistId,omitempty"`
	MemberPercentOff  *float64 `json:"memberPercentOff,omitempty"`

	DaysToExpiryThreshold *int     `json:"daysToExpiryThreshold,omitempty"`
	ExpiryDiscountUnit    *string  `json:"expiryDiscountUnit,omitempty"`
	ExpiryDiscountValue   *float64 `json:"expiryDiscountValue,omitempty"`

	MinimumPurchase *float64 `json:"minimumPurchase,omitempty"`
	StartDate       string   `json:"startDate"`
	EndDate         string   `json:"endDate"`
	DaysOfWeek      []int    `json:"daysOfWeek"`
	HourStart       string   `json:"hourStart"`
	HourEnd         string   `json:"hourEnd"`

	Description string `json:"description"`
	Notes       string `json:"notes"`

	ComboItems     []promoComboItemInput    `json:"comboItems"`
	ProductScopes  []promoProductScopeInput `json:"productScopes"`
	CategoryIDs    []string                 `json:"categoryIds"`
}

func (h *PromotionsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in promotionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Name == "" || in.Kind == "" {
		writeError(w, http.StatusBadRequest, "nama dan jenis wajib diisi")
		return
	}
	if in.Level == "" {
		in.Level = "line"
	}
	if in.Status == "" {
		in.Status = "active"
	}
	if in.DaysOfWeek == nil {
		in.DaysOfWeek = []int{}
	}

	p := promotionFromInput(uuid.Nil, in)
	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextPromotionCode(ctx, tx)
		if err != nil {
			return err
		}
		p.Code = code
		if _, err := tx.NewInsert().Model(&p).Returning("*").Exec(ctx); err != nil {
			return err
		}
		return writePromoChildren(ctx, tx, p.ID, in)
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondPromo(w, h.deps.DB, p.ID, http.StatusCreated, r.Context())
}

func (h *PromotionsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in promotionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Level == "" {
		in.Level = "line"
	}
	if in.Status == "" {
		in.Status = "active"
	}
	if in.DaysOfWeek == nil {
		in.DaysOfWeek = []int{}
	}

	p := promotionFromInput(id, in)
	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		res, err := tx.NewUpdate().Model(&p).
			Where("id = ?", id).
			OmitZero().
			ExcludeColumn("id", "code", "usage_count", "created_at", "updated_at").
			Set("updated_at = current_timestamp").
			Exec(ctx)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return fmt.Errorf("not found")
		}
		// Updates above only touch non-zero columns; ensure the array & nullable
		// fields explicitly land.
		if _, err := tx.NewUpdate().Table("promotions").
			Where("id = ?", id).
			Set("name = ?", in.Name).
			Set("kind = ?", in.Kind).
			Set("level = ?", in.Level).
			Set("status = ?", in.Status).
			Set("usage_limit = ?", in.UsageLimit).
			Set("discount_unit = ?", in.DiscountUnit).
			Set("discount_value = ?", in.DiscountValue).
			Set("combo_price = ?", in.ComboPrice).
			Set("buy_quantity = ?", in.BuyQuantity).
			Set("get_quantity = ?", in.GetQuantity).
			Set("bogo_product_id = ?", optUUID(in.BogoProductID)).
			Set("bogo_variant_id = ?", optUUID(in.BogoVariantID)).
			Set("buy_unit_id = ?", optUUID(in.BuyUnitID)).
			Set("buy_unit_factor = ?", in.BuyUnitFactor).
			Set("get_unit_id = ?", optUUID(in.GetUnitID)).
			Set("get_unit_factor = ?", in.GetUnitFactor).
			Set("member_pricelist_id = ?", in.MemberPricelistID).
			Set("member_percent_off = ?", in.MemberPercentOff).
			Set("days_to_expiry_threshold = ?", in.DaysToExpiryThreshold).
			Set("expiry_discount_unit = ?", in.ExpiryDiscountUnit).
			Set("expiry_discount_value = ?", in.ExpiryDiscountValue).
			Set("minimum_purchase = ?", in.MinimumPurchase).
			Set("start_date = ?", in.StartDate).
			Set("end_date = ?", in.EndDate).
			Set("days_of_week = ?", bun.In(in.DaysOfWeek)).
			Set("hour_start = ?", in.HourStart).
			Set("hour_end = ?", in.HourEnd).
			Set("description = ?", in.Description).
			Set("notes = ?", in.Notes).
			Set("updated_at = current_timestamp").
			Exec(ctx); err != nil {
			return err
		}
		// Replace all children.
		if _, err := tx.NewDelete().Table("promotion_combo_items").Where("promotion_id = ?", id).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Table("promotion_product_scopes").Where("promotion_id = ?", id).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Table("promotion_category_scopes").Where("promotion_id = ?", id).Exec(ctx); err != nil {
			return err
		}
		return writePromoChildren(ctx, tx, id, in)
	})
	if err != nil {
		if err.Error() == "not found" {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondPromo(w, h.deps.DB, id, http.StatusOK, r.Context())
}

func (h *PromotionsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Table("promotions").Where("id = ?", id).Exec(r.Context())
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

// IncrementUsage bumps usage_count by 1. Called by the POS terminal after
// each successful charge that applied this promo.
func (h *PromotionsHandler) IncrementUsage(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewUpdate().Table("promotions").
		Where("id = ?", id).
		Set("usage_count = usage_count + 1").
		Set("updated_at = current_timestamp").
		Exec(r.Context())
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

func promotionFromInput(id uuid.UUID, in promotionInput) models.Promotion {
	return models.Promotion{
		ID:                    id,
		Name:                  in.Name,
		Kind:                  in.Kind,
		Level:                 in.Level,
		Status:                in.Status,
		UsageLimit:            in.UsageLimit,
		DiscountUnit:          in.DiscountUnit,
		DiscountValue:         in.DiscountValue,
		ComboPrice:            in.ComboPrice,
		BuyQuantity:           in.BuyQuantity,
		GetQuantity:           in.GetQuantity,
		BogoProductID:         optUUID(in.BogoProductID),
		BogoVariantID:         optUUID(in.BogoVariantID),
		BuyUnitID:             optUUID(in.BuyUnitID),
		BuyUnitFactor:         in.BuyUnitFactor,
		GetUnitID:             optUUID(in.GetUnitID),
		GetUnitFactor:         in.GetUnitFactor,
		MemberPricelistID:     in.MemberPricelistID,
		MemberPercentOff:      in.MemberPercentOff,
		DaysToExpiryThreshold: in.DaysToExpiryThreshold,
		ExpiryDiscountUnit:    in.ExpiryDiscountUnit,
		ExpiryDiscountValue:   in.ExpiryDiscountValue,
		MinimumPurchase:       in.MinimumPurchase,
		StartDate:             in.StartDate,
		EndDate:               in.EndDate,
		DaysOfWeek:            in.DaysOfWeek,
		HourStart:             in.HourStart,
		HourEnd:               in.HourEnd,
		Description:           in.Description,
		Notes:                 in.Notes,
	}
}

func writePromoChildren(ctx context.Context, tx bun.Tx, id uuid.UUID, in promotionInput) error {
	if len(in.ComboItems) > 0 {
		rows := make([]models.PromotionComboItem, 0, len(in.ComboItems))
		for _, c := range in.ComboItems {
			pid, err := uuid.Parse(c.ProductID)
			if err != nil {
				return fmt.Errorf("comboItem productId invalid: %w", err)
			}
			rows = append(rows, models.PromotionComboItem{
				PromotionID: id,
				ProductID:   pid,
				VariantID:   optUUID(c.VariantID),
				UnitID:      optUUID(c.UnitID),
				UnitFactor:  c.UnitFactor,
				Quantity:    c.Quantity,
			})
		}
		if _, err := tx.NewInsert().Model(&rows).Exec(ctx); err != nil {
			return err
		}
	}
	if len(in.ProductScopes) > 0 {
		rows := make([]models.PromotionProductScope, 0, len(in.ProductScopes))
		for _, s := range in.ProductScopes {
			pid, err := uuid.Parse(s.ProductID)
			if err != nil {
				return fmt.Errorf("productScope productId invalid: %w", err)
			}
			rows = append(rows, models.PromotionProductScope{
				PromotionID: id,
				ProductID:   pid,
				VariantID:   optUUID(s.VariantID),
				UnitID:      optUUID(s.UnitID),
				UnitFactor:  s.UnitFactor,
			})
		}
		if _, err := tx.NewInsert().Model(&rows).Exec(ctx); err != nil {
			return err
		}
	}
	if len(in.CategoryIDs) > 0 {
		rows := make([]models.PromotionCategoryScope, 0, len(in.CategoryIDs))
		for _, c := range in.CategoryIDs {
			cid, err := uuid.Parse(c)
			if err != nil {
				return fmt.Errorf("categoryId invalid: %w", err)
			}
			rows = append(rows, models.PromotionCategoryScope{
				PromotionID: id,
				CategoryID:  cid,
			})
		}
		if _, err := tx.NewInsert().Model(&rows).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func respondPromo(w http.ResponseWriter, db *bun.DB, id uuid.UUID, status int, ctx context.Context) {
	var p models.Promotion
	if err := db.NewSelect().
		Model(&p).
		Relation("ComboItems").
		Relation("ProductScopes").
		Relation("CategoryScopes").
		Where("pm.id = ?", id).
		Scan(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	ensurePromoArrays(&p)
	writeJSON(w, status, promotionToResponse(&p))
}

func ensurePromoArrays(p *models.Promotion) {
	if p.ComboItems == nil {
		p.ComboItems = []models.PromotionComboItem{}
	}
	if p.ProductScopes == nil {
		p.ProductScopes = []models.PromotionProductScope{}
	}
	if p.CategoryScopes == nil {
		p.CategoryScopes = []models.PromotionCategoryScope{}
	}
	if p.DaysOfWeek == nil {
		p.DaysOfWeek = []int{}
	}
}

// promotionToResponse flattens CategoryScopes to a categoryIds string array
// so the frontend keeps its existing shape.
func promotionToResponse(p *models.Promotion) map[string]any {
	cats := make([]string, 0, len(p.CategoryScopes))
	for _, c := range p.CategoryScopes {
		cats = append(cats, c.CategoryID.String())
	}
	return map[string]any{
		"id":                    p.ID,
		"code":                  p.Code,
		"name":                  p.Name,
		"kind":                  p.Kind,
		"level":                 p.Level,
		"status":                p.Status,
		"usageCount":            p.UsageCount,
		"usageLimit":            p.UsageLimit,
		"discountUnit":          p.DiscountUnit,
		"discountValue":         p.DiscountValue,
		"comboPrice":            p.ComboPrice,
		"buyQuantity":           p.BuyQuantity,
		"getQuantity":           p.GetQuantity,
		"bogoProductId":         p.BogoProductID,
		"bogoVariantId":         p.BogoVariantID,
		"buyUnitId":             p.BuyUnitID,
		"buyUnitFactor":         p.BuyUnitFactor,
		"getUnitId":             p.GetUnitID,
		"getUnitFactor":         p.GetUnitFactor,
		"memberPricelistId":     p.MemberPricelistID,
		"memberPercentOff":      p.MemberPercentOff,
		"daysToExpiryThreshold": p.DaysToExpiryThreshold,
		"expiryDiscountUnit":    p.ExpiryDiscountUnit,
		"expiryDiscountValue":   p.ExpiryDiscountValue,
		"minimumPurchase":       p.MinimumPurchase,
		"startDate":             p.StartDate,
		"endDate":               p.EndDate,
		"daysOfWeek":            p.DaysOfWeek,
		"hourStart":             p.HourStart,
		"hourEnd":               p.HourEnd,
		"description":           p.Description,
		"notes":                 p.Notes,
		"comboItems":            p.ComboItems,
		"productScopes":         p.ProductScopes,
		"categoryIds":           cats,
	}
}

func nextPromotionCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("PRM-%d-", year)
	var count int
	if err := tx.NewSelect().Table("promotions").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}
