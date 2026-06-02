package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Category struct {
	bun.BaseModel `bun:"table:categories,alias:c"`

	ID          uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name        string     `bun:",notnull" json:"name"`
	Slug        string     `bun:",notnull,unique" json:"slug"`
	Description string     `bun:",notnull,default:''" json:"description"`
	Color       string     `bun:",notnull,default:'neutral'" json:"color"`
	TaxRateID   *string    `bun:"tax_rate_id" json:"taxRateId,omitempty"`
	ParentID    *uuid.UUID `bun:"parent_id" json:"parentId,omitempty"`
	CreatedAt   time.Time  `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time  `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
