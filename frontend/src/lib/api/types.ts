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
