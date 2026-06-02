package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Tag struct {
	bun.BaseModel `bun:"table:tags,alias:tg"`

	ID            uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name          string    `bun:",notnull,unique" json:"name"`
	Color         string    `bun:",notnull,default:'neutral'" json:"color"`
	PublicVisible bool      `bun:"public_visible,notnull,default:true" json:"publicVisible"`
	Description   string    `bun:",notnull,default:''" json:"description"`
	CreatedAt     time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt     time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}
