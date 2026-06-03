package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Payout struct {
	bun.BaseModel `bun:"table:payouts,alias:py"`

	ID                  uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code                string    `bun:",notnull,unique" json:"code"`
	SupplierID          uuid.UUID `bun:"supplier_id,notnull" json:"supplierId"`
	Amount              float64   `bun:"amount,notnull" json:"amount"`
	PaidAt              string    `bun:"paid_at,notnull,default:''" json:"paidAt"`
	Method              string    `bun:",notnull,default:'cash'" json:"method"`
	CoversPeriodStart   string    `bun:"covers_period_start,notnull,default:''" json:"coversPeriodStart"`
	CoversPeriodEnd     string    `bun:"covers_period_end,notnull,default:''" json:"coversPeriodEnd"`
	Notes               string    `bun:",notnull,default:''" json:"notes"`
	CreatedAt           time.Time `bun:",notnull,default:current_timestamp" json:"-"`
	UpdatedAt           time.Time `bun:",notnull,default:current_timestamp" json:"-"`
}
