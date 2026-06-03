package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type StockOpname struct {
	bun.BaseModel `bun:"table:stock_opnames,alias:so"`

	ID          uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code        string     `bun:",notnull,unique" json:"code"`
	LocationID  *uuid.UUID `bun:"location_id" json:"locationId,omitempty"`
	StartedAt   time.Time  `bun:"started_at,notnull,default:current_timestamp" json:"startedAt"`
	CompletedAt *time.Time `bun:"completed_at" json:"completedAt,omitempty"`
	Status      string     `bun:",notnull,default:'draft'" json:"status"`
	PerformedBy string     `bun:"performed_by,notnull,default:''" json:"performedBy"`
	Notes       string     `bun:",notnull,default:''" json:"notes"`
	CreatedAt   time.Time  `bun:",notnull,default:current_timestamp" json:"-"`
	UpdatedAt   time.Time  `bun:",notnull,default:current_timestamp" json:"-"`

	Lines []StockOpnameLine `bun:"rel:has-many,join:id=opname_id" json:"lines"`
}

type StockOpnameLine struct {
	bun.BaseModel `bun:"table:stock_opname_lines,alias:sol"`

	ID          uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	OpnameID    uuid.UUID  `bun:"opname_id,notnull" json:"-"`
	ProductID   uuid.UUID  `bun:"product_id,notnull" json:"productId"`
	VariantID   *uuid.UUID `bun:"variant_id" json:"variantId,omitempty"`
	ExpectedQty float64    `bun:"expected_qty,notnull,default:0" json:"expectedQty"`
	CountedQty  *float64   `bun:"counted_qty" json:"countedQty"`
	UnitCost    float64    `bun:"unit_cost,notnull,default:0" json:"unitCost"`
	Notes       string     `bun:",notnull,default:''" json:"notes"`
}
