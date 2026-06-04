package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// ─── Pricing types (mirror frontend PricingStrategy / PricingTier / PricelistEntry) ───
// PricingStrategy is a tagged union in TS but a flat struct here. All three
// kinds (fixed, markup_amount, markup_pct) share the same `value` field.

type PricingStrategy struct {
	Kind  string  `json:"kind"`
	Value float64 `json:"value"`
}

type PricingTier struct {
	MinQty  float64         `json:"minQty"`
	Pricing PricingStrategy `json:"pricing"`
}

type PricelistEntry struct {
	PricelistID string          `json:"pricelistId"`
	Pricing     PricingStrategy `json:"pricing"`
	Tiers       []PricingTier   `json:"tiers"`
}

// ─── API-shaped sub-entities (response JSON mirrors frontend Product) ───────
// These are NOT directly mapped to DB rows; handlers assemble them from the
// normalized child tables. The response keeps the same nested shape the
// frontend Product type expects — variants own their prices+components,
// packagings own their prices, extras own their components.

type ProductPackaging struct {
	ID      uuid.UUID        `json:"id"`
	UnitID  string           `json:"unitId"`
	Factor  float64          `json:"factor"`
	Prices  []PricelistEntry `json:"prices"`
	Barcode string           `json:"barcode"`
}

type ProductAttribute struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Values []string  `json:"values"`
}

type CompositeComponent struct {
	ID         uuid.UUID  `json:"id"`
	ProductID  uuid.UUID  `json:"productId"`
	VariantID  *uuid.UUID `json:"variantId,omitempty"`
	Quantity   float64    `json:"quantity"`
	UnitID     *uuid.UUID `json:"unitId,omitempty"`
	UnitFactor *float64   `json:"unitFactor,omitempty"`
}

type ProductVariant struct {
	ID             uuid.UUID            `json:"id"`
	Name           string               `json:"name"`
	PrintName      string               `json:"printName"`
	SKU            string               `json:"sku"`
	Cost           float64              `json:"cost"`
	Prices         []PricelistEntry     `json:"prices"`
	Barcode        string               `json:"barcode"`
	Values         map[string]string    `json:"values"`
	ImageURL       string               `json:"imageUrl"`
	Components     []CompositeComponent `json:"components"`
	ProductionMode *string              `json:"productionMode,omitempty"`
}

type ProductExtra struct {
	ID         uuid.UUID            `json:"id"`
	Name       string               `json:"name"`
	PriceDelta float64              `json:"priceDelta"`
	Components []CompositeComponent `json:"components"`
}

type ProductSupplier struct {
	ID           uuid.UUID `json:"id"`
	SupplierID   uuid.UUID `json:"supplierId"`
	IsPrimary    bool      `json:"isPrimary"`
	UnitCost     float64   `json:"unitCost"`
	LeadTimeDays *int      `json:"leadTimeDays,omitempty"`
	SupplierSKU  string    `json:"supplierSku"`
	MinOrderQty  *float64  `json:"minOrderQty,omitempty"`
	Notes        string    `json:"notes"`
}

// ─── Product ────────────────────────────────────────────────────────────────

type ProductStatus = string

const (
	ProductStatusActive   ProductStatus = "active"
	ProductStatusArchived ProductStatus = "archived"
)

type ProductKind = string

const (
	ProductKindGoods     ProductKind = "goods"
	ProductKindComposite ProductKind = "composite"
)

// Product is both the DB row and the API response shape. Scalars are mapped
// to columns; the nested arrays (variants, packagings, suppliers, prices,
// components, extras, attributes) are skipped by Bun and populated by
// handlers via separate queries against the child tables.
type Product struct {
	bun.BaseModel `bun:"table:products,alias:p"`

	ID          uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	SKU         string     `bun:"sku,notnull,unique" json:"sku"`
	Name        string     `bun:",notnull" json:"name"`
	PrintName   string     `bun:"print_name,notnull,default:''" json:"printName"`
	Kind        string     `bun:",notnull,default:'goods'" json:"kind"`
	CategoryID  *uuid.UUID `bun:"category_id" json:"categoryId,omitempty"`
	UnitID      *uuid.UUID `bun:"unit_id" json:"unitId,omitempty"`
	Cost        float64    `bun:",notnull,default:0" json:"cost"`
	Status      string     `bun:",notnull,default:'active'" json:"status"`
	Description string     `bun:",notnull,default:''" json:"description"`
	TaxRateID   *string    `bun:"tax_rate_id" json:"taxRateId,omitempty"`
	BrandID     *uuid.UUID `bun:"brand_id" json:"brandId,omitempty"`
	Tags        []string   `bun:",array,notnull,default:'{}'" json:"tags"`
	ImageURL    string     `bun:"image_url,notnull,default:''" json:"imageUrl"`
	Barcode     string     `bun:",notnull,default:''" json:"barcode"`

	Metadata map[string]string `bun:"metadata,type:jsonb,notnull,default:'{}'" json:"metadata,omitempty"`

	RequiresBatchLabel              bool    `bun:"requires_batch_label,notnull,default:false" json:"requiresBatchLabel,omitempty"`
	RequiresExpiration              bool    `bun:"requires_expiration,notnull,default:false" json:"requiresExpiration,omitempty"`
	BPOMNumber                      string  `bun:"bpom_number,notnull,default:''" json:"bpomNumber,omitempty"`
	HalalCertNumber                 string  `bun:"halal_cert_number,notnull,default:''" json:"halalCertNumber,omitempty"`
	WarrantyMonths                  *int    `bun:"warranty_months" json:"warrantyMonths,omitempty"`
	MarkupCostSource                string  `bun:"markup_cost_source,notnull,default:'manual'" json:"markupCostSource,omitempty"`
	ProductionMode                  *string `bun:"production_mode" json:"productionMode,omitempty"`
	ShelfLifeAfterProductionHours   *int    `bun:"shelf_life_after_production_hrs" json:"shelfLifeAfterProductionHours,omitempty"`

	CreatedAt time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`

	// API-only: assembled from child tables. Bun ignores these via bun:"-".
	Suppliers  []ProductSupplier    `bun:"-" json:"suppliers"`
	Attributes []ProductAttribute   `bun:"-" json:"attributes"`
	Packagings []ProductPackaging   `bun:"-" json:"units"`
	Variants   []ProductVariant     `bun:"-" json:"variants"`
	Extras     []ProductExtra       `bun:"-" json:"extras"`
	Prices     []PricelistEntry     `bun:"-" json:"prices"`
	Components []CompositeComponent `bun:"-" json:"components"`
}

// ─── DB row types for child tables ──────────────────────────────────────────
// These are internal to the handler / loader; not exposed in the API directly.

type ProductAttributeRow struct {
	bun.BaseModel `bun:"table:product_attributes,alias:pa"`

	ID        uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID uuid.UUID `bun:"product_id,notnull"`
	Name      string    `bun:",notnull"`
	Values    []string  `bun:",array,notnull,default:'{}'"`
	Position  int       `bun:",notnull,default:0"`
}

type ProductVariantRow struct {
	bun.BaseModel `bun:"table:product_variants,alias:pv"`

	ID             uuid.UUID         `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID      uuid.UUID         `bun:"product_id,notnull"`
	Name           string            `bun:",notnull,default:''"`
	PrintName      string            `bun:"print_name,notnull,default:''"`
	SKU            string            `bun:"sku,notnull,unique"`
	Cost           float64           `bun:",notnull,default:0"`
	Barcode        string            `bun:",notnull,default:''"`
	ImageURL       string            `bun:"image_url,notnull,default:''"`
	Values         map[string]string `bun:"values,type:jsonb,notnull,default:'{}'"`
	ProductionMode *string           `bun:"production_mode"`
	Position       int               `bun:",notnull,default:0"`
}

type ProductPackagingRow struct {
	bun.BaseModel `bun:"table:product_packagings,alias:pkg"`

	ID        uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID uuid.UUID `bun:"product_id,notnull"`
	UnitID    uuid.UUID `bun:"unit_id,notnull"`
	Factor    float64   `bun:",notnull"`
	Barcode   string    `bun:",notnull,default:''"`
	Position  int       `bun:",notnull,default:0"`
}

type ProductSupplierRow struct {
	bun.BaseModel `bun:"table:product_suppliers,alias:ps"`

	ID           uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID    uuid.UUID `bun:"product_id,notnull"`
	SupplierID   uuid.UUID `bun:"supplier_id,notnull"`
	IsPrimary    bool      `bun:"is_primary,notnull,default:false"`
	UnitCost     float64   `bun:"unit_cost,notnull,default:0"`
	LeadTimeDays *int      `bun:"lead_time_days"`
	SupplierSKU  string    `bun:"supplier_sku,notnull,default:''"`
	MinOrderQty  *float64  `bun:"min_order_qty"`
	Notes        string    `bun:",notnull,default:''"`
}

type ProductExtraRow struct {
	bun.BaseModel `bun:"table:product_extras,alias:pe"`

	ID         uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID  uuid.UUID `bun:"product_id,notnull"`
	Name       string    `bun:",notnull"`
	PriceDelta float64   `bun:"price_delta,notnull,default:0"`
	Position   int       `bun:",notnull,default:0"`
}

type ProductPriceRow struct {
	bun.BaseModel `bun:"table:product_prices,alias:pp"`

	ID           uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID    uuid.UUID  `bun:"product_id,notnull"`
	VariantID    *uuid.UUID `bun:"variant_id"`
	PackagingID  *uuid.UUID `bun:"packaging_id"`
	PricelistID  string     `bun:"pricelist_id,notnull"`
	PricingKind  string     `bun:"pricing_kind,notnull"`
	PricingValue float64    `bun:"pricing_value,notnull,default:0"`
}

type ProductPriceTierRow struct {
	bun.BaseModel `bun:"table:product_price_tiers,alias:ppt"`

	ID           uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()"`
	PriceID      uuid.UUID `bun:"price_id,notnull"`
	MinQty       float64   `bun:"min_qty,notnull"`
	PricingKind  string    `bun:"pricing_kind,notnull"`
	PricingValue float64   `bun:"pricing_value,notnull,default:0"`
}

type ProductComponentRow struct {
	bun.BaseModel `bun:"table:product_components,alias:pc"`

	ID                 uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()"`
	ProductID          uuid.UUID  `bun:"product_id,notnull"`
	ParentVariantID    *uuid.UUID `bun:"parent_variant_id"`
	ExtraID            *uuid.UUID `bun:"extra_id"`
	ComponentProductID uuid.UUID  `bun:"component_product_id,notnull"`
	ComponentVariantID *uuid.UUID `bun:"component_variant_id"`
	Quantity           float64    `bun:",notnull"`
	UnitID             *uuid.UUID `bun:"unit_id"`
	UnitFactor         *float64   `bun:"unit_factor"`
	Position           int        `bun:",notnull,default:0"`
}

// EnsureSlices initializes nil child arrays so JSON marshaling produces []
// instead of null. Called after loading from DB.
func (p *Product) EnsureSlices() {
	if p.Tags == nil {
		p.Tags = []string{}
	}
	if p.Suppliers == nil {
		p.Suppliers = []ProductSupplier{}
	}
	if p.Attributes == nil {
		p.Attributes = []ProductAttribute{}
	}
	if p.Packagings == nil {
		p.Packagings = []ProductPackaging{}
	}
	if p.Variants == nil {
		p.Variants = []ProductVariant{}
	}
	if p.Extras == nil {
		p.Extras = []ProductExtra{}
	}
	if p.Prices == nil {
		p.Prices = []PricelistEntry{}
	}
	if p.Components == nil {
		p.Components = []CompositeComponent{}
	}
	if p.Metadata == nil {
		p.Metadata = map[string]string{}
	}
}
