package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type BatchOwnership = string

const (
	BatchOwnershipOwned       BatchOwnership = "owned"
	BatchOwnershipConsignment BatchOwnership = "consignment"
)

type Batch struct {
	bun.BaseModel `bun:"table:batches,alias:bt"`

	ID                        uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code                      string     `bun:",notnull,unique" json:"code"`
	ProductID                 uuid.UUID  `bun:"product_id,notnull" json:"productId"`
	VariantID                 *uuid.UUID `bun:"variant_id" json:"variantId,omitempty"`
	Ownership                 string     `bun:",notnull,default:'owned'" json:"ownership"`
	SupplierID                *uuid.UUID `bun:"supplier_id" json:"supplierId,omitempty"`
	SourcePurchaseOrderID     *uuid.UUID `bun:"source_purchase_order_id" json:"sourcePurchaseOrderId,omitempty"`
	SourcePurchaseOrderLineID *uuid.UUID `bun:"source_purchase_order_line_id" json:"sourcePurchaseOrderLineId,omitempty"`
	UnitCost                  float64    `bun:"unit_cost,notnull,default:0" json:"unitCost"`
	QtyReceived               float64    `bun:"qty_received,notnull" json:"qtyReceived"`
	QtyRemaining              float64    `bun:"qty_remaining,notnull" json:"qtyRemaining"`
	ReceivedAt                string     `bun:"received_at,notnull,default:''" json:"receivedAt"`
	ExpiresAt                 string     `bun:"expires_at,notnull,default:''" json:"expiresAt"`
	LocationID                uuid.UUID  `bun:"location_id,notnull" json:"locationId"`
	Notes                     string     `bun:",notnull,default:''" json:"notes"`
	CreatedAt                 time.Time  `bun:",notnull,default:current_timestamp" json:"-"`
	UpdatedAt                 time.Time  `bun:",notnull,default:current_timestamp" json:"-"`
}
