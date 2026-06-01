package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// Unit is the unit-of-measure entity (Pcs, Box, Kg, Slop, Batang, etc.).
// Modeled after the frontend's units store (see frontend/src/lib/stores/units.svelte.ts).
type Unit struct {
	bun.BaseModel `bun:"table:units,alias:un"`

	ID          uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name        string    `bun:",notnull" json:"name"`
	Code        string    `bun:",notnull,unique" json:"code"`
	Description string    `bun:",notnull,default:''" json:"description"`
	CreatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
