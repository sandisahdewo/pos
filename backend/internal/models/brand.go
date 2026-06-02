package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type BrandStatus = string

const (
	BrandStatusActive   BrandStatus = "active"
	BrandStatusArchived BrandStatus = "archived"
)

type Brand struct {
	bun.BaseModel `bun:"table:brands,alias:b"`

	ID          uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name        string    `bun:",notnull" json:"name"`
	Slug        string    `bun:",notnull,unique" json:"slug"`
	Description string    `bun:",notnull,default:''" json:"description"`
	ImageURL    string    `bun:"image_url,notnull,default:''" json:"imageUrl"`
	Status      string    `bun:",notnull,default:'active'" json:"status"`
	CreatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
