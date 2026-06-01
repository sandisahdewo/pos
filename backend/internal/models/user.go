package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// UserStatus values stored in the `status` column. Validated at the handler
// edge; the DB takes any TEXT.
type UserStatus = string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusInactive UserStatus = "inactive"
)

// User is the unified employee + auth principal. The `users` table doubles as
// the employees master — every cashier / admin is one row.
type User struct {
	bun.BaseModel `bun:"table:users,alias:u"`

	ID           uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Email        string    `bun:",notnull,unique" json:"email"`
	PasswordHash string    `bun:",notnull" json:"-"`
	Name         string    `bun:",notnull" json:"name"`
	Phone        string    `bun:",notnull,default:''" json:"phone"`
	Status       string    `bun:",notnull,default:'active'" json:"status"`
	JoinedAt     time.Time `bun:"joined_at,type:date,notnull,default:current_date" json:"joinedAt"`
	PIN          string    `bun:"pin,notnull,default:''" json:"pin"`
	CreatedAt    time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt    time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`

	// RoleIDs are populated by handlers via a separate user_roles query and
	// returned in the JSON response. Not stored on the users row.
	RoleIDs []uuid.UUID `bun:"-" json:"roleIds"`
}
