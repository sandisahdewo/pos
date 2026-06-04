package models

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

type AppSettings struct {
	bun.BaseModel `bun:"table:app_settings,alias:asg"`

	ID        int             `bun:",pk" json:"-"`
	Value     json.RawMessage `bun:"value,type:jsonb,notnull,default:'{}'" json:"value"`
	UpdatedAt time.Time       `bun:"updated_at,notnull,default:current_timestamp" json:"updatedAt"`
}
