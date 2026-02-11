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
