package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type PurchaseOrderType = string

const (
	POTypeStandard    PurchaseOrderType = "standard"
	POTypeConsignment PurchaseOrderType = "consignment"
)

type PurchaseOrderStatus = string

const (
	POStatusDraft     PurchaseOrderStatus = "draft"
	POStatusSent      PurchaseOrderStatus = "sent"
	POStatusPartial   PurchaseOrderStatus = "partial"
	POStatusReceived  PurchaseOrderStatus = "received"
	POStatusCancelled PurchaseOrderStatus = "cancelled"
)

type PurchaseOrderPaymentMethod = string

const (
	POPaymentCash     PurchaseOrderPaymentMethod = "cash"
	POPaymentTransfer PurchaseOrderPaymentMethod = "transfer"
	POPaymentOther    PurchaseOrderPaymentMethod = "other"
)

// PurchaseOrderLine — API + DB row in purchase_order_lines.
type PurchaseOrderLine struct {
	bun.BaseModel `bun:"table:purchase_order_lines,alias:pol"`

	ID              uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	PurchaseOrderID uuid.UUID  `bun:"purchase_order_id,notnull" json:"-"`
	ProductID       uuid.UUID  `bun:"product_id,notnull" json:"productId"`
	VariantID       *uuid.UUID `bun:"variant_id" json:"variantId,omitempty"`
	Quantity        float64    `bun:",notnull" json:"quantity"`
	ReceivedQty     float64    `bun:"received_qty,notnull,default:0" json:"receivedQty"`
	UnitID          *uuid.UUID `bun:"unit_id" json:"unitId,omitempty"`
	UnitFactor      float64    `bun:"unit_factor,notnull,default:1" json:"unitFactor"`
	UnitPrice       float64    `bun:"unit_price,notnull,default:0" json:"unitPrice"`
	Notes           string     `bun:",notnull,default:''" json:"notes"`
	Position        int        `bun:",notnull,default:0" json:"-"`
}

// PurchaseOrderPayment — API + DB row in purchase_order_payments.
type PurchaseOrderPayment struct {
	bun.BaseModel `bun:"table:purchase_order_payments,alias:pop"`

	ID              uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	PurchaseOrderID uuid.UUID `bun:"purchase_order_id,notnull" json:"-"`
	Amount          float64   `bun:",notnull" json:"amount"`
	Method          string    `bun:",notnull,default:'cash'" json:"method"`
	PaidAt          time.Time `bun:"paid_at,notnull,default:current_timestamp" json:"at"`
	Notes           string    `bun:",notnull,default:''" json:"notes"`
}

type PurchaseOrder struct {
	bun.BaseModel `bun:"table:purchase_orders,alias:po"`

	ID           uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code         string    `bun:",notnull,unique" json:"code"`
	Type         string    `bun:",notnull,default:'standard'" json:"type"`
	SupplierID   uuid.UUID `bun:"supplier_id,notnull" json:"supplierId"`
	Status       string    `bun:",notnull,default:'draft'" json:"status"`
	// Dates are stored as TEXT in YYYY-MM-DD form so empty ("") cleanly
	// represents "not set" — matches the frontend's string-based shape.
	OrderDate    string `bun:"order_date,notnull,default:''" json:"orderDate"`
	ExpectedDate string `bun:"expected_date,notnull,default:''" json:"expectedDate"`
	ReceivedDate string `bun:"received_date,notnull,default:''" json:"receivedDate"`
	PaidAmount   float64   `bun:"paid_amount,notnull,default:0" json:"paidAmount"`
	Notes        string    `bun:",notnull,default:''" json:"notes"`
	CreatedAt    time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt    time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`

	// API-only: filled from child tables.
	Lines    []PurchaseOrderLine    `bun:"-" json:"lines"`
	Payments []PurchaseOrderPayment `bun:"-" json:"payments"`
}

func (p *PurchaseOrder) EnsureSlices() {
	if p.Lines == nil {
		p.Lines = []PurchaseOrderLine{}
	}
	if p.Payments == nil {
		p.Payments = []PurchaseOrderPayment{}
	}
}
