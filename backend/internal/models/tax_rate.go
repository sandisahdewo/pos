package models

import (
	"time"

	"github.com/uptrace/bun"
)

// TaxRate uses a TEXT primary key (slug). See migration for the rationale.
type TaxRate struct {
	bun.BaseModel `bun:"table:tax_rates,alias:tr"`

	ID          string    `bun:",pk" json:"id"`
	Name        string    `bun:",notnull" json:"name"`
	Rate        float64   `bun:",notnull,default:0" json:"rate"`
	Description string    `bun:",notnull,default:''" json:"description"`
	IsDefault   bool      `bun:"is_default,notnull,default:false" json:"isDefault"`
	CreatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
