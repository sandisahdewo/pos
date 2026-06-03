package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

// ─── Shift template ────────────────────────────────────────────────────────

type ShiftTemplateStatus = string

const (
	ShiftTemplateStatusActive   ShiftTemplateStatus = "active"
	ShiftTemplateStatusArchived ShiftTemplateStatus = "archived"
)

type ShiftTemplate struct {
	bun.BaseModel `bun:"table:shift_templates,alias:st"`

	ID        uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Name      string    `bun:",notnull" json:"name"`
	StartTime string    `bun:"start_time,notnull,default:'00:00'" json:"startTime"`
	EndTime   string    `bun:"end_time,notnull,default:'00:00'" json:"endTime"`
	Notes     string    `bun:",notnull,default:''" json:"notes"`
	Status    string    `bun:",notnull,default:'active'" json:"status"`
	CreatedAt time.Time `bun:",notnull,default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `bun:",notnull,default:current_timestamp" json:"updatedAt"`
}

// ─── Shift session + cash entries ──────────────────────────────────────────

type ShiftStatus = string

const (
	ShiftStatusOpen      ShiftStatus = "open"
	ShiftStatusClosed    ShiftStatus = "closed"
	ShiftStatusCancelled ShiftStatus = "cancelled"
)

// CashDenomination — small {unit, count} pair for cash count details.
type CashDenomination struct {
	Unit  int `json:"unit"`
	Count int `json:"count"`
}

// CashCount — flat total + optional breakdown by denomination. Stored as
// JSONB on the shift_sessions row (small, never queried directly).
type CashCount struct {
	Total         float64            `json:"total"`
	Denominations []CashDenomination `json:"denominations,omitempty"`
}

type ShiftCashEntry struct {
	bun.BaseModel `bun:"table:shift_cash_entries,alias:sce"`

	ID             uuid.UUID `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	ShiftSessionID uuid.UUID `bun:"shift_session_id,notnull" json:"-"`
	At             time.Time `bun:"happened_at,notnull,default:current_timestamp" json:"at"`
	Kind           string    `bun:",notnull" json:"kind"`     // 'in' | 'out'
	Category       string    `bun:",notnull,default:'lain'" json:"category"`
	Amount         float64   `bun:",notnull" json:"amount"`
	Notes          string    `bun:",notnull,default:''" json:"notes"`
	PerformedBy    string    `bun:"performed_by,notnull,default:''" json:"performedBy"`
	Position       int       `bun:",notnull,default:0" json:"-"`
}

type ShiftSession struct {
	bun.BaseModel `bun:"table:shift_sessions,alias:ss"`

	ID                  uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Code                string     `bun:",notnull,unique" json:"code"`
	EmployeeID          uuid.UUID  `bun:"employee_id,notnull" json:"employeeId"`
	TemplateID          *uuid.UUID `bun:"template_id" json:"templateId,omitempty"`
	OpenedAt            time.Time  `bun:"opened_at,notnull,default:current_timestamp" json:"openedAt"`
	ClosedAt            *time.Time `bun:"closed_at" json:"closedAt,omitempty"`
	Status              string     `bun:",notnull,default:'open'" json:"status"`
	OpeningCash         CashCount  `bun:"opening_cash,type:jsonb,notnull,default:'{\"total\":0}'" json:"openingCash"`
	ClosingCash         *CashCount `bun:"closing_cash,type:jsonb" json:"closingCash,omitempty"`
	ExpectedClosingCash *float64   `bun:"expected_closing_cash" json:"expectedClosingCash,omitempty"`
	Variance            *float64   `bun:"variance" json:"variance,omitempty"`
	Notes               string     `bun:",notnull,default:''" json:"notes"`
	CreatedAt           time.Time  `bun:",notnull,default:current_timestamp" json:"-"`
	UpdatedAt           time.Time  `bun:",notnull,default:current_timestamp" json:"-"`

	// API-only: filled from shift_cash_entries.
	Entries []ShiftCashEntry `bun:"-" json:"entries"`
}

func (s *ShiftSession) EnsureSlices() {
	if s.Entries == nil {
		s.Entries = []ShiftCashEntry{}
	}
}

// ─── Shift assignment (planned schedule) ───────────────────────────────────

type ShiftAssignmentStatus = string

const (
	AssignmentStatusPlanned   ShiftAssignmentStatus = "planned"
	AssignmentStatusCompleted ShiftAssignmentStatus = "completed"
	AssignmentStatusAbsent    ShiftAssignmentStatus = "absent"
	AssignmentStatusReplaced  ShiftAssignmentStatus = "replaced"
)

type ShiftAssignment struct {
	bun.BaseModel `bun:"table:shift_assignments,alias:sa"`

	ID            uuid.UUID  `bun:",pk,type:uuid,default:gen_random_uuid()" json:"id"`
	Date          string     `bun:",notnull" json:"date"`
	TemplateID    uuid.UUID  `bun:"template_id,notnull" json:"templateId"`
	EmployeeID    uuid.UUID  `bun:"employee_id,notnull" json:"employeeId"`
	Notes         string     `bun:",notnull,default:''" json:"notes"`
	Status        string     `bun:",notnull,default:'planned'" json:"status"`
	ActualShiftID *uuid.UUID `bun:"actual_shift_id" json:"actualShiftId,omitempty"`
	CreatedAt     time.Time  `bun:",notnull,default:current_timestamp" json:"-"`
	UpdatedAt     time.Time  `bun:",notnull,default:current_timestamp" json:"-"`
}
