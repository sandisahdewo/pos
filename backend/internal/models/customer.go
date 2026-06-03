package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type CustomerType = string
type CustomerStatus = string

const (
	CustomerTypeIndividual CustomerType = "individual"
	CustomerTypeBusiness   CustomerType = "business"
)

const (
	CustomerStatusActive   CustomerStatus = "active"
	CustomerStatusArchived CustomerStatus = "archived"
)

type Customer struct {
	bun.BaseModel `bun:"table:customers,alias:cu"`

	ID            uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name          string    `bun:",notnull" json:"name"`
	Type          string    `bun:",notnull,default:'individual'" json:"type"`
	Email         string    `bun:",notnull,default:''" json:"email"`
	Phone         string    `bun:",notnull,default:''" json:"phone"`
	Address       string    `bun:",notnull,default:''" json:"address"`
	PricelistID   *string   `bun:"pricelist_id" json:"pricelistId,omitempty"`
	TaxID         string    `bun:"tax_id,notnull,default:''" json:"taxId"`
	Status        string    `bun:",notnull,default:'active'" json:"status"`
	CreditAllowed bool      `bun:"credit_allowed,notnull,default:false" json:"creditAllowed"`
	Notes         string    `bun:",notnull,default:''" json:"notes"`
	JoinedAt      string    `bun:"joined_at,notnull,default:''" json:"joinedAt"`
	CreatedAt     time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt     time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
