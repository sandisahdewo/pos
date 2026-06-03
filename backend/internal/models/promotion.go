package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Promotion struct {
	bun.BaseModel `bun:"table:promotions,alias:pm"`

	ID         uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code       string    `bun:",notnull,unique" json:"code"`
	Name       string    `bun:",notnull" json:"name"`
	Kind       string    `bun:",notnull" json:"kind"`
	Level      string    `bun:",notnull,default:'line'" json:"level"`
	Status     string    `bun:",notnull,default:'active'" json:"status"`
	UsageCount int       `bun:"usage_count,notnull,default:0" json:"usageCount"`
	UsageLimit *int      `bun:"usage_limit" json:"usageLimit,omitempty"`

	DiscountUnit  *string  `bun:"discount_unit" json:"discountUnit,omitempty"`
	DiscountValue *float64 `bun:"discount_value" json:"discountValue,omitempty"`

	ComboPrice *float64 `bun:"combo_price" json:"comboPrice,omitempty"`

	BuyQuantity   *float64   `bun:"buy_quantity" json:"buyQuantity,omitempty"`
	GetQuantity   *float64   `bun:"get_quantity" json:"getQuantity,omitempty"`
	BogoProductID *uuid.UUID `bun:"bogo_product_id" json:"bogoProductId,omitempty"`
	BogoVariantID *uuid.UUID `bun:"bogo_variant_id" json:"bogoVariantId,omitempty"`
	BuyUnitID     *uuid.UUID `bun:"buy_unit_id" json:"buyUnitId,omitempty"`
	BuyUnitFactor *float64   `bun:"buy_unit_factor" json:"buyUnitFactor,omitempty"`
	GetUnitID     *uuid.UUID `bun:"get_unit_id" json:"getUnitId,omitempty"`
	GetUnitFactor *float64   `bun:"get_unit_factor" json:"getUnitFactor,omitempty"`

	MemberPricelistID *string  `bun:"member_pricelist_id" json:"memberPricelistId,omitempty"`
	MemberPercentOff  *float64 `bun:"member_percent_off" json:"memberPercentOff,omitempty"`

	DaysToExpiryThreshold *int     `bun:"days_to_expiry_threshold" json:"daysToExpiryThreshold,omitempty"`
	ExpiryDiscountUnit    *string  `bun:"expiry_discount_unit" json:"expiryDiscountUnit,omitempty"`
	ExpiryDiscountValue   *float64 `bun:"expiry_discount_value" json:"expiryDiscountValue,omitempty"`

	MinimumPurchase *float64 `bun:"minimum_purchase" json:"minimumPurchase,omitempty"`
	StartDate       string   `bun:"start_date,notnull,default:''" json:"startDate,omitempty"`
	EndDate         string   `bun:"end_date,notnull,default:''" json:"endDate,omitempty"`
	DaysOfWeek      []int    `bun:"days_of_week,array,notnull" json:"daysOfWeek"`
	HourStart       string   `bun:"hour_start,notnull,default:''" json:"hourStart,omitempty"`
	HourEnd         string   `bun:"hour_end,notnull,default:''" json:"hourEnd,omitempty"`

	Description string    `bun:",notnull,default:''" json:"description"`
	Notes       string    `bun:",notnull,default:''" json:"notes"`
	CreatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"-"`
	UpdatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"-"`

	ComboItems     []PromotionComboItem      `bun:"rel:has-many,join:id=promotion_id" json:"comboItems"`
	ProductScopes  []PromotionProductScope   `bun:"rel:has-many,join:id=promotion_id" json:"productScopes"`
	CategoryScopes []PromotionCategoryScope  `bun:"rel:has-many,join:id=promotion_id" json:"-"`
}

type PromotionComboItem struct {
	bun.BaseModel `bun:"table:promotion_combo_items,alias:pci"`

	ID          uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"-"`
	PromotionID uuid.UUID  `bun:"promotion_id,notnull" json:"-"`
	ProductID   uuid.UUID  `bun:"product_id,notnull" json:"productId"`
	VariantID   *uuid.UUID `bun:"variant_id" json:"variantId,omitempty"`
	UnitID      *uuid.UUID `bun:"unit_id" json:"unitId,omitempty"`
	UnitFactor  *float64   `bun:"unit_factor" json:"unitFactor,omitempty"`
	Quantity    float64    `bun:"quantity,notnull" json:"quantity"`
}

type PromotionProductScope struct {
	bun.BaseModel `bun:"table:promotion_product_scopes,alias:pps"`

	ID          uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"-"`
	PromotionID uuid.UUID  `bun:"promotion_id,notnull" json:"-"`
	ProductID   uuid.UUID  `bun:"product_id,notnull" json:"productId"`
	VariantID   *uuid.UUID `bun:"variant_id" json:"variantId,omitempty"`
	UnitID      *uuid.UUID `bun:"unit_id" json:"unitId,omitempty"`
	UnitFactor  *float64   `bun:"unit_factor" json:"unitFactor,omitempty"`
}

type PromotionCategoryScope struct {
	bun.BaseModel `bun:"table:promotion_category_scopes,alias:pcs"`

	PromotionID uuid.UUID `bun:"promotion_id,pk,notnull" json:"-"`
	CategoryID  uuid.UUID `bun:"category_id,pk,notnull" json:"-"`
}
