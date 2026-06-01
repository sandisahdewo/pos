package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// WildcardPermission grants every permission. Stored as a literal '*' row in
// role_permissions; handlers check for it before any specific permission.
const WildcardPermission = "*"

type Role struct {
	bun.BaseModel `bun:"table:roles,alias:r"`

	ID          uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name        string    `bun:",notnull,unique" json:"name"`
	Description string    `bun:",notnull,default:''" json:"description"`
	IsSystem    bool      `bun:",notnull,default:false" json:"isSystem"`
	CreatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`

	// Joined permissions string list. Populated by handlers via a separate
	// query; not part of the roles row itself.
	Permissions []string `bun:"-" json:"permissions"`
}

type RolePermission struct {
	bun.BaseModel `bun:"table:role_permissions,alias:rp"`

	RoleID     uuid.UUID `bun:"role_id,pk,type:uuid" json:"roleId"`
	Permission string    `bun:",pk" json:"permission"`
}

type UserRole struct {
	bun.BaseModel `bun:"table:user_roles,alias:ur"`

	UserID     uuid.UUID `bun:"user_id,pk,type:uuid" json:"userId"`
	RoleID     uuid.UUID `bun:"role_id,pk,type:uuid" json:"roleId"`
	AssignedAt time.Time `bun:"assigned_at,notnull,default:current_timestamp" json:"assignedAt"`
}
