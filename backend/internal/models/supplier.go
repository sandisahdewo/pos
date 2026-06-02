package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type SupplierStatus = string

const (
	SupplierStatusActive   SupplierStatus = "active"
	SupplierStatusArchived SupplierStatus = "archived"
)

type Supplier struct {
	bun.BaseModel `bun:"table:suppliers,alias:s"`

	ID            uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name          string    `bun:",notnull" json:"name"`
	ContactPerson string    `bun:"contact_person,notnull,default:''" json:"contactPerson"`
	Email         string    `bun:",notnull,default:''" json:"email"`
	Phone         string    `bun:",notnull,default:''" json:"phone"`
	Address       string    `bun:",notnull,default:''" json:"address"`
	LeadTimeDays  int       `bun:"lead_time_days,notnull,default:0" json:"leadTimeDays"`
	Status        string    `bun:",notnull,default:'active'" json:"status"`
	Notes         string    `bun:",notnull,default:''" json:"notes"`
	CreatedAt     time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt     time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
