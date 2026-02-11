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
