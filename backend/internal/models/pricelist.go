package models

import (
	"time"

	"github.com/uptrace/bun"
)

// Pricelist uses a TEXT primary key (slug) so product seed data can
// reference well-known IDs like 'pl_retail', 'pl_wholesale', 'pl_vip'.
type Pricelist struct {
	bun.BaseModel `bun:"table:pricelists,alias:pl"`

	ID          string    `bun:",pk" json:"id"`
	Name        string    `bun:",notnull" json:"name"`
	Description string    `bun:",notnull,default:''" json:"description"`
	IsDefault   bool      `bun:"is_default,notnull,default:false" json:"isDefault"`
	CreatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
