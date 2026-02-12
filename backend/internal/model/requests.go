package model

import "github.com/google/uuid"

// Auth requests

type RegisterRequest struct {
	TenantName   string `json:"tenant_name" validate:"required,min=2,max=100"`
	Email        string `json:"email" validate:"required,email,max=255"`
	Password     string `json:"password" validate:"required,min=8,max=128"`
	FirstName    string `json:"first_name" validate:"required,min=1,max=100"`
	LastName     string `json:"last_name" validate:"required,min=1,max=100"`
	StoreName    string `json:"store_name" validate:"required,min=1,max=100"`
	StoreAddress string `json:"store_address" validate:"omitempty,max=500"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type VerifyEmailRequest struct {
	Token string `json:"token" validate:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" validate:"required"`
	Password string `json:"password" validate:"required,min=8,max=128"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8,max=128"`
}

type AcceptInvitationRequest struct {
	Token     string `json:"token" validate:"required"`
	Password  string `json:"password" validate:"required,min=8,max=128"`
	FirstName string `json:"first_name" validate:"required,min=1,max=100"`
	LastName  string `json:"last_name" validate:"required,min=1,max=100"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// Store requests

type CreateStoreRequest struct {
	Name    string `json:"name" validate:"required,min=1,max=100"`
	Address string `json:"address" validate:"omitempty,max=500"`
	Phone   string `json:"phone" validate:"omitempty,max=50"`
}

type UpdateStoreRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=100"`
	Address  string `json:"address" validate:"omitempty,max=500"`
	Phone    string `json:"phone" validate:"omitempty,max=50"`
	IsActive bool   `json:"is_active"`
}

// Role requests

type CreateRoleRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"omitempty,max=500"`
}

type UpdateRoleRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=100"`
	Description string `json:"description" validate:"omitempty,max=500"`
}

type PermissionEntry struct {
	FeatureID uuid.UUID `json:"feature_id" validate:"required"`
	Actions   []string  `json:"actions" validate:"required,min=1,dive,required"`
}

type UpdateRolePermissionsRequest struct {
	Permissions []PermissionEntry `json:"permissions" validate:"required,dive"`
}

// User requests

type UpdateUserRequest struct {
	FirstName string `json:"first_name" validate:"required,min=1,max=100"`
	LastName  string `json:"last_name" validate:"required,min=1,max=100"`
	IsActive  bool   `json:"is_active"`
}

type UpdateUserStoresRequest struct {
	StoreIDs []uuid.UUID `json:"store_ids" validate:"required"`
}

// Invitation requests

type CreateInvitationRequest struct {
	Email    string      `json:"email" validate:"required,email,max=255"`
	RoleID   uuid.UUID   `json:"role_id" validate:"required"`
	StoreIDs []uuid.UUID `json:"store_ids" validate:"omitempty"`
}

// Category requests

type CreateCategoryRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=255"`
	Description string  `json:"description" validate:"omitempty,max=500"`
	PricingMode string  `json:"pricing_mode" validate:"omitempty,max=50"`
	MarkupValue float64 `json:"markup_value" validate:"omitempty"`
}

type UpdateCategoryRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=255"`
	Description string  `json:"description" validate:"omitempty,max=500"`
	PricingMode string  `json:"pricing_mode" validate:"omitempty,max=50"`
	MarkupValue float64 `json:"markup_value" validate:"omitempty"`
	IsActive    bool    `json:"is_active"`
}

type UpdateCategoryUnitsRequest struct {
	UnitIDs []uuid.UUID `json:"unit_ids" validate:"required"`
}

type UpdateCategoryVariantsRequest struct {
	VariantIDs []uuid.UUID `json:"variant_ids" validate:"required"`
}

// Unit requests

type CreateUnitRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	Description string `json:"description" validate:"omitempty,max=500"`
}

type UpdateUnitRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	Description string `json:"description" validate:"omitempty,max=500"`
	IsActive    bool   `json:"is_active"`
}

// Variant requests

type CreateVariantRequest struct {
	Name        string              `json:"name" validate:"required,min=1,max=255"`
	Description string              `json:"description" validate:"omitempty,max=500"`
	Values      []VariantValueEntry `json:"values" validate:"omitempty,dive"`
}

type UpdateVariantRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	Description string `json:"description" validate:"omitempty,max=500"`
	IsActive    bool   `json:"is_active"`
}

type VariantValueEntry struct {
	Value     string `json:"value" validate:"required,min=1,max=255"`
	SortOrder int32  `json:"sort_order"`
}

type CreateVariantValueRequest struct {
	Value     string `json:"value" validate:"required,min=1,max=255"`
	SortOrder int32  `json:"sort_order"`
}

type UpdateVariantValueRequest struct {
	Value     string `json:"value" validate:"required,min=1,max=255"`
	SortOrder int32  `json:"sort_order"`
	IsActive  bool   `json:"is_active"`
}

// Unit conversion requests

type CreateUnitConversionRequest struct {
	FromUnitID       uuid.UUID `json:"from_unit_id" validate:"required"`
	ToUnitID         uuid.UUID `json:"to_unit_id" validate:"required"`
	ConversionFactor float64   `json:"conversion_factor" validate:"required,gt=0"`
}

type UpdateUnitConversionRequest struct {
	FromUnitID       uuid.UUID `json:"from_unit_id" validate:"required"`
	ToUnitID         uuid.UUID `json:"to_unit_id" validate:"required"`
	ConversionFactor float64   `json:"conversion_factor" validate:"required,gt=0"`
}

// Warehouse requests

type CreateWarehouseRequest struct {
	Name    string `json:"name" validate:"required,min=1,max=255"`
	Address string `json:"address" validate:"omitempty,max=500"`
	Phone   string `json:"phone" validate:"omitempty,max=50"`
}

type UpdateWarehouseRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=255"`
	Address  string `json:"address" validate:"omitempty,max=500"`
	Phone    string `json:"phone" validate:"omitempty,max=50"`
	IsActive bool   `json:"is_active"`
}

// Supplier requests

type CreateSupplierRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	ContactName string `json:"contact_name" validate:"omitempty,max=255"`
	Email       string `json:"email" validate:"omitempty,email,max=255"`
	Phone       string `json:"phone" validate:"omitempty,max=50"`
	Address     string `json:"address" validate:"omitempty,max=500"`
}

type UpdateSupplierRequest struct {
	Name        string `json:"name" validate:"required,min=1,max=255"`
	ContactName string `json:"contact_name" validate:"omitempty,max=255"`
	Email       string `json:"email" validate:"omitempty,email,max=255"`
	Phone       string `json:"phone" validate:"omitempty,max=50"`
	Address     string `json:"address" validate:"omitempty,max=500"`
	IsActive    bool   `json:"is_active"`
}

// Product requests

type CreateProductRequest struct {
	CategoryID  uuid.UUID             `json:"category_id" validate:"required"`
	Name        string                `json:"name" validate:"required,min=1,max=255"`
	Description string                `json:"description" validate:"omitempty,max=2000"`
	HasVariants bool                  `json:"has_variants"`
	SellMethod  string                `json:"sell_method" validate:"required,oneof=fifo lifo"`
	Status      string                `json:"status" validate:"required,oneof=active inactive"`
	TaxRate     float64               `json:"tax_rate" validate:"omitempty,min=0,max=100"`
	DiscountRate float64              `json:"discount_rate" validate:"omitempty,min=0,max=100"`
	MinQuantity float64               `json:"min_quantity" validate:"omitempty,min=0"`
	MaxQuantity float64               `json:"max_quantity" validate:"omitempty,min=0"`
	PricingMode string                `json:"pricing_mode" validate:"omitempty,max=50"`
	MarkupValue float64               `json:"markup_value" validate:"omitempty"`
	FixedPrice  float64               `json:"fixed_price" validate:"omitempty,min=0"`
	Variants    []ProductVariantEntry `json:"variants" validate:"omitempty,dive"`
	Images      []string              `json:"images" validate:"omitempty"`
	PriceTiers  []PriceTierEntry      `json:"price_tiers" validate:"omitempty,dive"`
}

type ProductVariantEntry struct {
	SKU        string         `json:"sku" validate:"required,min=1,max=100"`
	Barcode    string         `json:"barcode" validate:"omitempty,max=100"`
	UnitID     uuid.UUID      `json:"unit_id" validate:"required"`
	RetailPrice float64       `json:"retail_price" validate:"min=0"`
	Values     []uuid.UUID    `json:"values" validate:"omitempty"`
	Images     []string       `json:"images" validate:"omitempty"`
	PriceTiers []PriceTierEntry `json:"price_tiers" validate:"omitempty,dive"`
}

type PriceTierEntry struct {
	MinQuantity int32   `json:"min_quantity" validate:"required,min=1"`
	Price       float64 `json:"price" validate:"required,min=0"`
}

type UpdateProductRequest struct {
	CategoryID  uuid.UUID             `json:"category_id" validate:"required"`
	Name        string                `json:"name" validate:"required,min=1,max=255"`
	Description string                `json:"description" validate:"omitempty,max=2000"`
	HasVariants bool                  `json:"has_variants"`
	SellMethod  string                `json:"sell_method" validate:"required,oneof=fifo lifo"`
	Status      string                `json:"status" validate:"required,oneof=active inactive"`
	TaxRate     float64               `json:"tax_rate" validate:"omitempty,min=0,max=100"`
	DiscountRate float64              `json:"discount_rate" validate:"omitempty,min=0,max=100"`
	MinQuantity float64               `json:"min_quantity" validate:"omitempty,min=0"`
	MaxQuantity float64               `json:"max_quantity" validate:"omitempty,min=0"`
	PricingMode string                `json:"pricing_mode" validate:"omitempty,max=50"`
	MarkupValue float64               `json:"markup_value" validate:"omitempty"`
	FixedPrice  float64               `json:"fixed_price" validate:"omitempty,min=0"`
	IsActive    bool                  `json:"is_active"`
	Variants    []ProductVariantEntry `json:"variants" validate:"omitempty,dive"`
	Images      []string              `json:"images" validate:"omitempty"`
	PriceTiers  []PriceTierEntry      `json:"price_tiers" validate:"omitempty,dive"`
}

type StockAdjustmentRequest struct {
	VariantID   uuid.UUID `json:"variant_id" validate:"required"`
	WarehouseID uuid.UUID `json:"warehouse_id" validate:"required"`
	Quantity    float64   `json:"quantity" validate:"required"`
	UnitID      uuid.UUID `json:"unit_id" validate:"required"`
	Reason      string    `json:"reason" validate:"required,oneof=purchase_delivery sale adjustment transfer_in transfer_out"`
	Notes       string    `json:"notes" validate:"omitempty,max=2000"`
}
