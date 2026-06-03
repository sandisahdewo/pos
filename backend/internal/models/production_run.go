package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type ProductionRun struct {
	bun.BaseModel `bun:"table:production_runs,alias:pr"`

	ID               uuid.UUID                   `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code             string                      `bun:",notnull,unique" json:"code"`
	ProductID        uuid.UUID                   `bun:"product_id,notnull" json:"productId"`
	VariantID        *uuid.UUID                  `bun:"variant_id" json:"variantId,omitempty"`
	IntendedQty      float64                     `bun:"intended_qty,notnull" json:"intendedQty"`
	ProducedQty      float64                     `bun:"produced_qty,notnull" json:"producedQty"`
	ProducedBatchID  *uuid.UUID                  `bun:"produced_batch_id" json:"producedBatchId,omitempty"`
	UnitCost         float64                     `bun:"unit_cost,notnull,default:0" json:"unitCost"`
	LocationID       uuid.UUID                   `bun:"location_id,notnull" json:"locationId"`
	ExpiresAt        string                      `bun:"expires_at,notnull,default:''" json:"expiresAt"`
	ShiftID          *uuid.UUID                  `bun:"shift_id" json:"shiftId,omitempty"`
	Status           string                      `bun:",notnull,default:'completed'" json:"status"`
	Notes            string                      `bun:",notnull,default:''" json:"notes"`
	CreatedAt        time.Time                   `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt        time.Time                   `bun:",notnull,default:current_timestamp" json:"-"`

	Consumptions []ProductionRunConsumption `bun:"rel:has-many,join:id=production_run_id" json:"componentConsumptions"`
}

type ProductionRunConsumption struct {
	bun.BaseModel `bun:"table:production_run_consumptions,alias:prc"`

	ID              uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"-"`
	ProductionRunID uuid.UUID  `bun:"production_run_id,notnull" json:"-"`
	ProductID       uuid.UUID  `bun:"product_id,notnull" json:"productId"`
	VariantID       *uuid.UUID `bun:"variant_id" json:"variantId,omitempty"`
	BatchID         *uuid.UUID `bun:"batch_id" json:"batchId,omitempty"`
	BatchCode       string     `bun:"batch_code,notnull,default:''" json:"batchCode"`
	QtyConsumed     float64    `bun:"qty_consumed,notnull" json:"qtyConsumed"`
	UnitCost        float64    `bun:"unit_cost,notnull,default:0" json:"unitCost"`
}
