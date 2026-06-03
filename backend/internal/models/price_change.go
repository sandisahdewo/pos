package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type PriceChange struct {
	bun.BaseModel `bun:"table:price_changes,alias:pc"`

	ID             uuid.UUID       `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code           string          `bun:",notnull,unique" json:"code"`
	At             time.Time       `bun:"happened_at,notnull,default:current_timestamp" json:"at"`
	ProductID      *uuid.UUID      `bun:"product_id" json:"productId,omitempty"`
	ProductName    string          `bun:"product_name,notnull,default:''" json:"productName"`
	VariantID      *uuid.UUID      `bun:"variant_id" json:"variantId,omitempty"`
	VariantName    string          `bun:"variant_name,notnull,default:''" json:"variantName,omitempty"`
	PackagingIndex *int            `bun:"packaging_index" json:"packagingIndex,omitempty"`
	PackagingLabel string          `bun:"packaging_label,notnull,default:''" json:"packagingLabel,omitempty"`
	PricelistID    *string         `bun:"pricelist_id" json:"pricelistId,omitempty"`
	PricelistName  string          `bun:"pricelist_name,notnull,default:''" json:"pricelistName"`
	TierMinQty     *float64        `bun:"tier_min_qty" json:"tierMinQty,omitempty"`
	OldStrategy    json.RawMessage `bun:"old_strategy,type:jsonb,notnull,default:'{}'" json:"oldStrategy"`
	NewStrategy    json.RawMessage `bun:"new_strategy,type:jsonb,notnull,default:'{}'" json:"newStrategy"`
	OldSale        float64         `bun:"old_sale,notnull,default:0" json:"oldSale"`
	NewSale        float64         `bun:"new_sale,notnull,default:0" json:"newSale"`
	Cost           float64         `bun:"cost,notnull,default:0" json:"cost"`
	Source         string          `bun:",notnull,default:'manual'" json:"source"`
	Notes          string          `bun:",notnull,default:''" json:"notes"`
	PerformedBy    string          `bun:"performed_by,notnull,default:''" json:"performedBy"`
}
