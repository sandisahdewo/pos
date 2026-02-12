// API response wrappers

export interface APIResponse<T = unknown> {
	data?: T;
	message?: string;
}

export interface ErrorResponse {
	error: string;
	details?: Record<string, string>;
}

export interface PaginationResponse {
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationResponse;
}

// Auth

export interface AuthTokens {
	access_token: string;
	refresh_token: string;
}

export interface RegisterRequest {
	tenant_name: string;
	email: string;
	password: string;
	first_name: string;
	last_name: string;
	store_name: string;
	store_address?: string;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterResponse {
	user: UserResponse;
	tokens: AuthTokens;
}

export interface LoginResponse {
	user: UserResponse;
	tokens: AuthTokens;
}

export interface VerifyEmailRequest {
	token: string;
}

export interface ForgotPasswordRequest {
	email: string;
}

export interface ResetPasswordRequest {
	token: string;
	password: string;
}

export interface RefreshTokenRequest {
	refresh_token: string;
}

export interface ChangePasswordRequest {
	current_password: string;
	new_password: string;
}

export interface AcceptInvitationRequest {
	token: string;
	password: string;
	first_name: string;
	last_name: string;
}

export interface LogoutRequest {
	refresh_token: string;
}

// User

export interface UserResponse {
	id: string;
	tenant_id: string;
	email: string;
	first_name: string;
	last_name: string;
	is_email_verified: boolean;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface UserDetailResponse extends UserResponse {
	roles: RoleResponse[];
	stores: StoreResponse[];
}

export interface MeResponse extends UserResponse {
	roles: RoleResponse[];
	permissions: Record<string, string[]>;
	stores: StoreResponse[];
	all_stores_access: boolean;
}

// Store

export interface StoreResponse {
	id: string;
	tenant_id: string;
	name: string;
	address: string;
	phone: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateStoreRequest {
	name: string;
	address?: string;
	phone?: string;
}

export interface UpdateStoreRequest {
	name: string;
	address?: string;
	phone?: string;
	is_active: boolean;
}

// Role

export interface RoleResponse {
	id: string;
	tenant_id: string;
	name: string;
	description: string;
	is_system_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface RoleDetailResponse extends RoleResponse {
	permissions: PermissionResponse[];
}

export interface PermissionResponse {
	id: string;
	feature_id: string;
	feature_slug: string;
	feature_name: string;
	feature_module: string;
	actions: string[];
}

export interface CreateRoleRequest {
	name: string;
	description?: string;
}

export interface UpdateRoleRequest {
	name: string;
	description?: string;
}

export interface PermissionEntry {
	feature_id: string;
	actions: string[];
}

export interface UpdateRolePermissionsRequest {
	permissions: PermissionEntry[];
}

// Feature

export interface FeatureResponse {
	id: string;
	parent_id: string | null;
	name: string;
	slug: string;
	module: string;
	actions: string[];
	sort_order: number;
	children?: FeatureResponse[];
}

// Invitation

export interface InvitationResponse {
	id: string;
	tenant_id: string;
	invited_by: string;
	email: string;
	role_id: string;
	store_ids: string[];
	status: string;
	expires_at: string;
	created_at: string;
	updated_at: string;
}

export interface CreateInvitationRequest {
	email: string;
	role_id: string;
	store_ids?: string[];
}

// User management

export interface UpdateUserRequest {
	first_name: string;
	last_name: string;
	is_active: boolean;
}

export interface UpdateUserStoresRequest {
	store_ids: string[];
}

// Category

export interface CategoryResponse {
	id: string;
	tenant_id: string;
	name: string;
	description: string;
	pricing_mode: string;
	markup_value: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CategoryDetailResponse extends CategoryResponse {
	units: UnitResponse[];
	variants: VariantResponse[];
}

export interface CreateCategoryRequest {
	name: string;
	description?: string;
	pricing_mode?: string;
	markup_value?: number;
}

export interface UpdateCategoryRequest {
	name: string;
	description?: string;
	pricing_mode?: string;
	markup_value?: number;
	is_active: boolean;
}

export interface UpdateCategoryUnitsRequest {
	unit_ids: string[];
}

export interface UpdateCategoryVariantsRequest {
	variant_ids: string[];
}

// Unit

export interface UnitResponse {
	id: string;
	tenant_id: string;
	name: string;
	description: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateUnitRequest {
	name: string;
	description?: string;
}

export interface UpdateUnitRequest {
	name: string;
	description?: string;
	is_active: boolean;
}

// Variant

export interface VariantResponse {
	id: string;
	tenant_id: string;
	name: string;
	description: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface VariantDetailResponse extends VariantResponse {
	values: VariantValueResponse[];
}

export interface VariantValueResponse {
	id: string;
	variant_id: string;
	value: string;
	sort_order: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateVariantRequest {
	name: string;
	description?: string;
	values?: { value: string; sort_order: number }[];
}

export interface CreateVariantValueRequest {
	value: string;
	sort_order: number;
}

export interface UpdateVariantValueRequest {
	value: string;
	sort_order: number;
	is_active: boolean;
}

// Unit Conversion

export interface UnitConversionResponse {
	id: string;
	tenant_id: string;
	from_unit_id: string;
	to_unit_id: string;
	from_unit_name: string;
	to_unit_name: string;
	conversion_factor: number;
	created_at: string;
	updated_at: string;
}

export interface CreateUnitConversionRequest {
	from_unit_id: string;
	to_unit_id: string;
	conversion_factor: number;
}

export interface UpdateUnitConversionRequest {
	from_unit_id: string;
	to_unit_id: string;
	conversion_factor: number;
}

// Warehouse

export interface WarehouseResponse {
	id: string;
	tenant_id: string;
	name: string;
	address: string;
	phone: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateWarehouseRequest {
	name: string;
	address?: string;
	phone?: string;
}

export interface UpdateWarehouseRequest {
	name: string;
	address?: string;
	phone?: string;
	is_active: boolean;
}

// Supplier

export interface SupplierResponse {
	id: string;
	tenant_id: string;
	name: string;
	contact_name: string;
	email: string;
	phone: string;
	address: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateSupplierRequest {
	name: string;
	contact_name?: string;
	email?: string;
	phone?: string;
	address?: string;
}

export interface UpdateSupplierRequest {
	name: string;
	contact_name?: string;
	email?: string;
	phone?: string;
	address?: string;
	is_active: boolean;
}

// Product

export interface ProductResponse {
	id: string;
	tenant_id: string;
	category_id: string;
	category_name: string;
	name: string;
	description: string;
	has_variants: boolean;
	sell_method: string;
	status: string;
	tax_rate: number;
	discount_rate: number;
	min_quantity: number;
	max_quantity: number;
	pricing_mode: string;
	markup_value: number;
	fixed_price: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ProductDetailResponse extends ProductResponse {
	variants: ProductVariantResponse[];
	images: ProductImageResponse[];
	price_tiers: PriceTierResponse[];
}

export interface ProductVariantResponse {
	id: string;
	product_id: string;
	sku: string;
	barcode: string;
	unit_id: string;
	unit_name: string;
	retail_price: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	values: ProductVariantValueResponse[];
	images: ProductVariantImageResponse[];
	price_tiers: PriceTierResponse[];
}

export interface ProductVariantValueResponse {
	id: string;
	variant_value_id: string;
	variant_id: string;
	variant_name: string;
	value: string;
}

export interface ProductImageResponse {
	id: string;
	product_id: string;
	image_url: string;
	sort_order: number;
	created_at: string;
}

export interface ProductVariantImageResponse {
	id: string;
	product_variant_id: string;
	image_url: string;
	sort_order: number;
	created_at: string;
}

export interface PriceTierResponse {
	id: string;
	product_id: string | null;
	product_variant_id: string | null;
	min_quantity: number;
	price: number;
	created_at: string;
}

export interface StockSummaryResponse {
	warehouse_id: string;
	warehouse_name: string;
	variant_id: string;
	variant_sku: string;
	current_stock: number;
}

export interface StockLedgerEntryResponse {
	id: string;
	tenant_id: string;
	product_variant_id: string;
	warehouse_id: string;
	quantity: number;
	unit_id: string;
	reason: string;
	reference_type: string;
	reference_id: string;
	notes: string;
	created_at: string;
}

export interface CreateProductRequest {
	category_id: string;
	name: string;
	description?: string;
	has_variants: boolean;
	sell_method: string;
	status: string;
	tax_rate?: number;
	discount_rate?: number;
	min_quantity?: number;
	max_quantity?: number;
	pricing_mode?: string;
	markup_value?: number;
	fixed_price?: number;
	variants?: ProductVariantEntry[];
	images?: string[];
	price_tiers?: PriceTierEntry[];
}

export interface ProductVariantEntry {
	sku: string;
	barcode?: string;
	unit_id: string;
	retail_price: number;
	values?: string[];
	images?: string[];
	price_tiers?: PriceTierEntry[];
}

export interface PriceTierEntry {
	min_quantity: number;
	price: number;
}

export interface UpdateProductRequest extends CreateProductRequest {
	is_active: boolean;
}
