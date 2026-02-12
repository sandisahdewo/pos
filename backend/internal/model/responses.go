package model

import (
	"time"

	"github.com/google/uuid"
)

// Generic API response wrapper
type APIResponse struct {
	Data    any    `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
}

// Error response
type ErrorResponse struct {
	Error   string            `json:"error"`
	Details map[string]string `json:"details,omitempty"`
}

// Auth responses

type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type RegisterResponse struct {
	User   UserResponse `json:"user"`
	Tokens AuthTokens   `json:"tokens"`
}

type LoginResponse struct {
	User   UserResponse `json:"user"`
	Tokens AuthTokens   `json:"tokens"`
}

// User responses

type UserResponse struct {
	ID              uuid.UUID `json:"id"`
	TenantID        uuid.UUID `json:"tenant_id"`
	Email           string    `json:"email"`
	FirstName       string    `json:"first_name"`
	LastName        string    `json:"last_name"`
	IsEmailVerified bool      `json:"is_email_verified"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type UserDetailResponse struct {
	UserResponse
	Roles  []RoleResponse  `json:"roles"`
	Stores []StoreResponse `json:"stores"`
}

type MeResponse struct {
	UserResponse
	Roles       []RoleResponse            `json:"roles"`
	Permissions map[string][]string       `json:"permissions"`
	Stores      []StoreResponse           `json:"stores"`
	AllStores   bool                      `json:"all_stores_access"`
}

// Store responses

type StoreResponse struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Phone     string    `json:"phone"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Role responses

type RoleResponse struct {
	ID              uuid.UUID `json:"id"`
	TenantID        uuid.UUID `json:"tenant_id"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	IsSystemDefault bool      `json:"is_system_default"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type RoleDetailResponse struct {
	RoleResponse
	Permissions []PermissionResponse `json:"permissions"`
}

type PermissionResponse struct {
	ID            uuid.UUID `json:"id"`
	FeatureID     uuid.UUID `json:"feature_id"`
	FeatureSlug   string    `json:"feature_slug"`
	FeatureName   string    `json:"feature_name"`
	FeatureModule string    `json:"feature_module"`
	Actions       []string  `json:"actions"`
}

// Feature responses

type FeatureResponse struct {
	ID        uuid.UUID        `json:"id"`
	ParentID  *uuid.UUID       `json:"parent_id"`
	Name      string           `json:"name"`
	Slug      string           `json:"slug"`
	Module    string           `json:"module"`
	Actions   []string         `json:"actions"`
	SortOrder int32            `json:"sort_order"`
	Children  []FeatureResponse `json:"children,omitempty"`
}

// Invitation responses

type InvitationResponse struct {
	ID        uuid.UUID   `json:"id"`
	TenantID  uuid.UUID   `json:"tenant_id"`
	InvitedBy uuid.UUID   `json:"invited_by"`
	Email     string      `json:"email"`
	RoleID    uuid.UUID   `json:"role_id"`
	StoreIDs  []uuid.UUID `json:"store_ids"`
	Status    string      `json:"status"`
	ExpiresAt time.Time   `json:"expires_at"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// Category responses

type CategoryResponse struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	PricingMode string    `json:"pricing_mode"`
	MarkupValue float64   `json:"markup_value"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CategoryDetailResponse struct {
	CategoryResponse
	Units    []UnitResponse    `json:"units"`
	Variants []VariantResponse `json:"variants"`
}

// Unit responses

type UnitResponse struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Variant responses

type VariantResponse struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type VariantDetailResponse struct {
	VariantResponse
	Values []VariantValueResponse `json:"values"`
}

type VariantValueResponse struct {
	ID        uuid.UUID `json:"id"`
	VariantID uuid.UUID `json:"variant_id"`
	Value     string    `json:"value"`
	SortOrder int32     `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Unit conversion responses

type UnitConversionResponse struct {
	ID               uuid.UUID `json:"id"`
	TenantID         uuid.UUID `json:"tenant_id"`
	FromUnitID       uuid.UUID `json:"from_unit_id"`
	ToUnitID         uuid.UUID `json:"to_unit_id"`
	FromUnitName     string    `json:"from_unit_name"`
	ToUnitName       string    `json:"to_unit_name"`
	ConversionFactor float64   `json:"conversion_factor"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// Warehouse responses

type WarehouseResponse struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Phone     string    `json:"phone"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Supplier responses

type SupplierResponse struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	ContactName string    `json:"contact_name"`
	Email       string    `json:"email"`
	Phone       string    `json:"phone"`
	Address     string    `json:"address"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Product responses

type ProductResponse struct {
	ID           uuid.UUID `json:"id"`
	TenantID     uuid.UUID `json:"tenant_id"`
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	HasVariants  bool      `json:"has_variants"`
	SellMethod   string    `json:"sell_method"`
	Status       string    `json:"status"`
	TaxRate      float64   `json:"tax_rate"`
	DiscountRate float64   `json:"discount_rate"`
	MinQuantity  float64   `json:"min_quantity"`
	MaxQuantity  float64   `json:"max_quantity"`
	PricingMode  string    `json:"pricing_mode"`
	MarkupValue  float64   `json:"markup_value"`
	FixedPrice   float64   `json:"fixed_price"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type ProductDetailResponse struct {
	ProductResponse
	Variants   []ProductVariantResponse `json:"variants"`
	Images     []ProductImageResponse   `json:"images"`
	PriceTiers []PriceTierResponse      `json:"price_tiers"`
}

type ProductVariantResponse struct {
	ID          uuid.UUID                    `json:"id"`
	ProductID   uuid.UUID                    `json:"product_id"`
	SKU         string                       `json:"sku"`
	Barcode     string                       `json:"barcode"`
	UnitID      uuid.UUID                    `json:"unit_id"`
	UnitName    string                       `json:"unit_name"`
	RetailPrice float64                      `json:"retail_price"`
	IsActive    bool                         `json:"is_active"`
	CreatedAt   time.Time                    `json:"created_at"`
	UpdatedAt   time.Time                    `json:"updated_at"`
	Values      []ProductVariantValueResponse `json:"values"`
	Images      []ProductVariantImageResponse `json:"images"`
	PriceTiers  []PriceTierResponse          `json:"price_tiers"`
}

type ProductVariantValueResponse struct {
	ID             uuid.UUID `json:"id"`
	VariantValueID uuid.UUID `json:"variant_value_id"`
	VariantID      uuid.UUID `json:"variant_id"`
	VariantName    string    `json:"variant_name"`
	Value          string    `json:"value"`
}

type ProductImageResponse struct {
	ID        uuid.UUID `json:"id"`
	ProductID uuid.UUID `json:"product_id"`
	ImageURL  string    `json:"image_url"`
	SortOrder int32     `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

type ProductVariantImageResponse struct {
	ID               uuid.UUID `json:"id"`
	ProductVariantID uuid.UUID `json:"product_variant_id"`
	ImageURL         string    `json:"image_url"`
	SortOrder        int32     `json:"sort_order"`
	CreatedAt        time.Time `json:"created_at"`
}

type PriceTierResponse struct {
	ID               uuid.UUID  `json:"id"`
	ProductID        *uuid.UUID `json:"product_id"`
	ProductVariantID *uuid.UUID `json:"product_variant_id"`
	MinQuantity      int32      `json:"min_quantity"`
	Price            float64    `json:"price"`
	CreatedAt        time.Time  `json:"created_at"`
}

type StockSummaryResponse struct {
	WarehouseID   uuid.UUID `json:"warehouse_id"`
	WarehouseName string    `json:"warehouse_name"`
	VariantID     uuid.UUID `json:"variant_id"`
	VariantSKU    string    `json:"variant_sku"`
	CurrentStock  float64   `json:"current_stock"`
}

type StockLedgerEntryResponse struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	ProductVariantID uuid.UUID  `json:"product_variant_id"`
	WarehouseID      uuid.UUID  `json:"warehouse_id"`
	Quantity         float64    `json:"quantity"`
	UnitID           uuid.UUID  `json:"unit_id"`
	UnitName         string     `json:"unit_name"`
	Reason           string     `json:"reason"`
	ReferenceType    string     `json:"reference_type"`
	ReferenceID      *uuid.UUID `json:"reference_id"`
	Notes            string     `json:"notes"`
	CreatedAt        time.Time  `json:"created_at"`
}
