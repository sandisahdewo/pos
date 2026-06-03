package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type OrderStatus = string

const (
	OrderStatusPaid      OrderStatus = "paid"
	OrderStatusCredit    OrderStatus = "credit"
	OrderStatusCancelled OrderStatus = "cancelled"
)

type PaymentMethod = string

const (
	PaymentMethodCash     PaymentMethod = "cash"
	PaymentMethodCard     PaymentMethod = "card"
	PaymentMethodQRIS     PaymentMethod = "qris"
	PaymentMethodTransfer PaymentMethod = "transfer"
)

// OrderLineExtra is one extra picked at sale time. Snapshotted as JSONB on
// the line — never queried directly.
type OrderLineExtra struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	PriceDelta float64 `json:"priceDelta"`
}

// BatchAllocation records which stock batch satisfied (part of) a line's
// quantity. Snapshotted JSONB so supplier renames / batch deletions don't
// break consignor payout history.
type BatchAllocation struct {
	BatchID    string   `json:"batchId"`
	QtyTaken   float64  `json:"qtyTaken"`
	Ownership  string   `json:"ownership"`
	UnitCost   float64  `json:"unitCost"`
	SupplierID *string  `json:"supplierId,omitempty"`
}

// OrderPromoApplication is the snapshot of a triggered promo on an order.
type OrderPromoApplication struct {
	PromoID         string   `json:"promoId"`
	PromoCode       string   `json:"promoCode"`
	PromoName       string   `json:"promoName"`
	Kind            string   `json:"kind"`
	Level           string   `json:"level"`
	AffectedLineIDs []string `json:"affectedLineIds"`
	DiscountAmount  float64  `json:"discountAmount"`
	Description     string   `json:"description"`
}

// OrderLine — API + DB row. extras / batch_allocations are JSONB.
type OrderLine struct {
	bun.BaseModel `bun:"table:order_lines,alias:ol"`

	ID                 uuid.UUID         `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	OrderID            uuid.UUID         `bun:"order_id,notnull" json:"-"`
	ProductID          uuid.UUID         `bun:"product_id,notnull" json:"productId"`
	VariantID          *uuid.UUID        `bun:"variant_id" json:"variantId,omitempty"`
	ProductName        string            `bun:"product_name,notnull" json:"productName"`
	VariantName        string            `bun:"variant_name,notnull,default:''" json:"variantName"`
	UnitID             *uuid.UUID        `bun:"unit_id" json:"unitId,omitempty"`
	UnitFactor         float64           `bun:"unit_factor,notnull,default:1" json:"unitFactor"`
	UnitCode           string            `bun:"unit_code,notnull,default:''" json:"unitCode"`
	Quantity           float64           `bun:",notnull" json:"quantity"`
	UnitPrice          float64           `bun:"unit_price,notnull,default:0" json:"unitPrice"`
	Extras             []OrderLineExtra  `bun:"extras,type:jsonb,notnull,default:'[]'" json:"extras"`
	TaxRatePct         float64           `bun:"tax_rate_pct,notnull,default:0" json:"taxRatePct"`
	LineSubtotal       float64           `bun:"line_subtotal,notnull,default:0" json:"lineSubtotal"`
	LinePromoDiscount  float64           `bun:"line_promo_discount,notnull,default:0" json:"linePromoDiscount,omitempty"`
	LineSubtotalNet    float64           `bun:"line_subtotal_net,notnull,default:0" json:"lineSubtotalNet,omitempty"`
	LineTax            float64           `bun:"line_tax,notnull,default:0" json:"lineTax"`
	LineTotal          float64           `bun:"line_total,notnull,default:0" json:"lineTotal"`
	BatchAllocations   []BatchAllocation `bun:"batch_allocations,type:jsonb,notnull,default:'[]'" json:"batchAllocations"`
	Position           int               `bun:",notnull,default:0" json:"-"`
}

type OrderPayment struct {
	bun.BaseModel `bun:"table:order_payments,alias:opm"`

	ID      uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	OrderID uuid.UUID `bun:"order_id,notnull" json:"-"`
	Amount  float64   `bun:",notnull" json:"amount"`
	Method  string    `bun:",notnull,default:'cash'" json:"method"`
	PaidAt  time.Time `bun:"paid_at,notnull,default:current_timestamp" json:"at"`
	Notes   string    `bun:",notnull,default:''" json:"notes"`
}

type Order struct {
	bun.BaseModel `bun:"table:orders,alias:o"`

	ID             uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code           string     `bun:",notnull,unique" json:"code"`
	PricelistID    *string    `bun:"pricelist_id" json:"pricelistId,omitempty"`
	CustomerID     *uuid.UUID `bun:"customer_id" json:"customerId,omitempty"`
	EmployeeID     *uuid.UUID `bun:"employee_id" json:"employeeId,omitempty"`
	ShiftID        *uuid.UUID `bun:"shift_id" json:"shiftId,omitempty"`
	PaymentMethod  string     `bun:"payment_method,notnull,default:'cash'" json:"paymentMethod"`
	AppliedPromos  []OrderPromoApplication `bun:"applied_promos,type:jsonb,notnull,default:'[]'" json:"appliedPromos,omitempty"`
	PromoDiscount  float64    `bun:"promo_discount,notnull,default:0" json:"promoDiscount,omitempty"`
	Subtotal       float64    `bun:",notnull,default:0" json:"subtotal"`
	NetSubtotal    float64    `bun:"net_subtotal,notnull,default:0" json:"netSubtotal,omitempty"`
	TaxTotal       float64    `bun:"tax_total,notnull,default:0" json:"taxTotal"`
	Total          float64    `bun:",notnull,default:0" json:"total"`
	PaidAmount     float64    `bun:"paid_amount,notnull,default:0" json:"paidAmount"`
	Status         string     `bun:",notnull,default:'paid'" json:"status"`
	Notes          string     `bun:",notnull,default:''" json:"notes"`
	ServiceType    *string    `bun:"service_type" json:"serviceType,omitempty"`
	TableNumber    string     `bun:"table_number,notnull,default:''" json:"tableNumber,omitempty"`
	CreatedAt      time.Time  `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt      time.Time  `bun:",notnull,default:current_timestamp" json:"-"`

	// API-only: filled from child tables.
	Lines    []OrderLine    `bun:"-" json:"lines"`
	Payments []OrderPayment `bun:"-" json:"payments"`
}

func (o *Order) EnsureSlices() {
	if o.Lines == nil {
		o.Lines = []OrderLine{}
	}
	if o.Payments == nil {
		o.Payments = []OrderPayment{}
	}
	if o.AppliedPromos == nil {
		o.AppliedPromos = []OrderPromoApplication{}
	}
}

