package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type LocationKind = string

const (
	LocationKindShelf     LocationKind = "shelf"
	LocationKindRack      LocationKind = "rack"
	LocationKindWarehouse LocationKind = "warehouse"
)

type LocationStatus = string

const (
	LocationStatusActive   LocationStatus = "active"
	LocationStatusArchived LocationStatus = "archived"
)

type Location struct {
	bun.BaseModel `bun:"table:locations,alias:l"`

	ID               uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name             string    `bun:",notnull" json:"name"`
	Slug             string    `bun:",notnull,unique" json:"slug"`
	Kind             string    `bun:",notnull,default:'shelf'" json:"kind"`
	CustomerVisible  bool      `bun:"customer_visible,notnull,default:false" json:"customerVisible"`
	IsDefaultReceipt bool      `bun:"is_default_receipt,notnull,default:false" json:"isDefaultReceipt"`
	DisplayOrder     int       `bun:"display_order,notnull,default:0" json:"displayOrder"`
	Description      string    `bun:",notnull,default:''" json:"description"`
	Status           string    `bun:",notnull,default:'active'" json:"status"`
	CreatedAt        time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt        time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
