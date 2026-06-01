package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel `bun:"table:users,alias:u"`

	ID           uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Email        string    `bun:",notnull,unique" json:"email"`
	PasswordHash string    `bun:",notnull" json:"-"`
	Name         string    `bun:",notnull" json:"name"`
	Role         string    `bun:",notnull,default:'cashier'" json:"role"`
	CreatedAt    time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt    time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
