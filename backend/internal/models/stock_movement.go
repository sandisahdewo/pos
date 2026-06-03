package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// StockMovementReference is the small "what triggered this" pointer.
// kind ∈ {po, order, opname, manual, transfer, return, production}
// id is the originating row id; code is an optional human-readable label.
type StockMovementReference struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Code string `json:"code,omitempty"`
}

type StockMovement struct {
	bun.BaseModel `bun:"table:stock_movements,alias:sm"`

	ID          uuid.UUID              `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code        string                 `bun:",notnull,unique" json:"code"`
	At          time.Time              `bun:"happened_at,notnull,default:current_timestamp" json:"at"`
	Kind        string                 `bun:",notnull" json:"kind"`
	ProductID   *uuid.UUID             `bun:"product_id" json:"productId,omitempty"`
	VariantID   *uuid.UUID             `bun:"variant_id" json:"variantId,omitempty"`
	LocationID  *uuid.UUID             `bun:"location_id" json:"locationId,omitempty"`
	BatchID     *uuid.UUID             `bun:"batch_id" json:"batchId,omitempty"`
	QtyDelta    float64                `bun:"qty_delta,notnull" json:"qtyDelta"`
	QtyAfter    float64                `bun:"qty_after,notnull,default:0" json:"qtyAfter"`
	UnitCost    *float64               `bun:"unit_cost" json:"unitCost,omitempty"`
	Reference   StockMovementReference `bun:"reference,type:jsonb,notnull,default:'{}'" json:"reference"`
	Reason      *string                `bun:"reason" json:"reason,omitempty"`
	ImageURL    string                 `bun:"image_url,notnull,default:''" json:"imageUrl,omitempty"`
	PerformedBy string                 `bun:"performed_by,notnull,default:''" json:"performedBy"`
	Notes       string                 `bun:",notnull,default:''" json:"notes"`
}
