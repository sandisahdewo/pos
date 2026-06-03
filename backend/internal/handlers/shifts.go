package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

type ShiftsHandler struct {
	deps Deps
}

func NewShiftsHandler(deps Deps) *ShiftsHandler {
	return &ShiftsHandler{deps: deps}
}

func (h *ShiftsHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := loadShiftSessions(r.Context(), h.deps.DB, r.URL.Query())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if items == nil {
		items = []models.ShiftSession{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *ShiftsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	s, err := loadShiftSession(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *ShiftsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in models.ShiftSession
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.EmployeeID == uuid.Nil {
		writeError(w, http.StatusBadRequest, "employeeId wajib diisi")
		return
	}
	in.ID = uuid.Nil
	in.Status = models.ShiftStatusOpen
	if in.OpenedAt.IsZero() {
		in.OpenedAt = time.Now()
	}
	in.EnsureSlices()

	err := h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		code, err := nextShiftCode(ctx, tx)
		if err != nil {
			return err
		}
		in.Code = code
		if _, err := tx.NewInsert().Model(&in).Returning("*").Exec(ctx); err != nil {
			return err
		}
		return saveShiftEntries(ctx, tx, &in)
	})
	if err != nil {
		if strings.Contains(err.Error(), "shift_sessions_one_open") {
			writeError(w, http.StatusBadRequest, "masih ada shift terbuka. Tutup dulu sebelum membuka yang baru.")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	full, err := loadShiftSession(r.Context(), h.deps.DB, in.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, full)
}

func (h *ShiftsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in models.ShiftSession
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.ID = id
	in.EnsureSlices()

	err = h.deps.DB.RunInTx(r.Context(), nil, func(ctx context.Context, tx bun.Tx) error {
		res, err := tx.NewUpdate().Model(&in).WherePK().
			ExcludeColumn("id", "code", "created_at", "updated_at").
			Set("updated_at = current_timestamp").Exec(ctx)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return errNotFound
		}
		return saveShiftEntries(ctx, tx, &in)
	})
	if errors.Is(err, errNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		if strings.Contains(err.Error(), "shift_sessions_one_open") {
			writeError(w, http.StatusBadRequest, "hanya satu shift terbuka pada satu waktu")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	full, err := loadShiftSession(r.Context(), h.deps.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, full)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func nextShiftCode(ctx context.Context, tx bun.Tx) (string, error) {
	year := time.Now().Year()
	prefix := fmt.Sprintf("SHF-%d-", year)
	var count int
	err := tx.NewSelect().Table("shift_sessions").
		ColumnExpr("count(*)").
		Where("code LIKE ?", prefix+"%").
		Scan(ctx, &count)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%03d", prefix, count+1), nil
}

func loadShiftSessions(ctx context.Context, db *bun.DB, q map[string][]string) ([]models.ShiftSession, error) {
	var sessions []models.ShiftSession
	qb := db.NewSelect().Model(&sessions).Order("opened_at DESC")
	if vals := q["status"]; len(vals) > 0 && vals[0] != "" {
		qb = qb.Where("status = ?", vals[0])
	}
	if vals := q["employeeId"]; len(vals) > 0 && vals[0] != "" {
		if _, err := uuid.Parse(vals[0]); err == nil {
			qb = qb.Where("employee_id = ?", vals[0])
		}
	}
	if err := qb.Scan(ctx); err != nil {
		return nil, err
	}
	if len(sessions) == 0 {
		return sessions, nil
	}
	ids := make([]uuid.UUID, len(sessions))
	idx := make(map[uuid.UUID]int, len(sessions))
	for i := range sessions {
		ids[i] = sessions[i].ID
		idx[sessions[i].ID] = i
		sessions[i].EnsureSlices()
	}
	var entries []models.ShiftCashEntry
	if err := db.NewSelect().Model(&entries).
		Where("shift_session_id IN (?)", bun.In(ids)).
		Order("happened_at ASC, position ASC").Scan(ctx); err != nil {
		return nil, err
	}
	for _, e := range entries {
		i := idx[e.ShiftSessionID]
		sessions[i].Entries = append(sessions[i].Entries, e)
	}
	return sessions, nil
}

func loadShiftSession(ctx context.Context, db *bun.DB, id uuid.UUID) (*models.ShiftSession, error) {
	var s models.ShiftSession
	if err := db.NewSelect().Model(&s).Where("id = ?", id).Scan(ctx); err != nil {
		return nil, err
	}
	s.EnsureSlices()
	if err := db.NewSelect().Model(&s.Entries).
		Where("shift_session_id = ?", id).
		Order("happened_at ASC, position ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if s.Entries == nil {
		s.Entries = []models.ShiftCashEntry{}
	}
	return &s, nil
}

func saveShiftEntries(ctx context.Context, tx bun.Tx, s *models.ShiftSession) error {
	if _, err := tx.NewDelete().Model((*models.ShiftCashEntry)(nil)).
		Where("shift_session_id = ?", s.ID).Exec(ctx); err != nil {
		return err
	}
	for i := range s.Entries {
		e := &s.Entries[i]
		e.ID = uuid.Nil
		e.ShiftSessionID = s.ID
		e.Position = i
		if e.At.IsZero() {
			e.At = time.Now()
		}
		if _, err := tx.NewInsert().Model(e).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func parseISODate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", strings.TrimSpace(s))
}

func itoa(n int) string { return strconv.Itoa(n) }
