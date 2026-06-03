package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type ShiftAssignmentsHandler struct {
	deps Deps
}

func NewShiftAssignmentsHandler(deps Deps) *ShiftAssignmentsHandler {
	return &ShiftAssignmentsHandler{deps: deps}
}

type shiftAssignmentInput struct {
	Date          string  `json:"date"`
	TemplateID    string  `json:"templateId"`
	EmployeeID    string  `json:"employeeId"`
	Notes         string  `json:"notes"`
	Status        string  `json:"status"`
	ActualShiftID *string `json:"actualShiftId,omitempty"`
}

func (h *ShiftAssignmentsHandler) List(w http.ResponseWriter, r *http.Request) {
	items := []models.ShiftAssignment{}
	q := h.deps.DB.NewSelect().Model(&items).Order("date ASC")
	if from := strings.TrimSpace(r.URL.Query().Get("from")); from != "" {
		q = q.Where("date >= ?", from)
	}
	if to := strings.TrimSpace(r.URL.Query().Get("to")); to != "" {
		q = q.Where("date <= ?", to)
	}
	if emp := strings.TrimSpace(r.URL.Query().Get("employeeId")); emp != "" {
		if _, err := uuid.Parse(emp); err == nil {
			q = q.Where("employee_id = ?", emp)
		}
	}
	if err := q.Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *ShiftAssignmentsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in shiftAssignmentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	row, errMsg := buildAssignment(&in)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	if _, err := h.deps.DB.NewInsert().Model(row).Returning("*").Exec(r.Context()); err != nil {
		if strings.Contains(err.Error(), "duplicate key value") {
			writeError(w, http.StatusBadRequest, "jadwal duplikat (tanggal + template + pegawai sudah ada)")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, row)
}

func (h *ShiftAssignmentsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in shiftAssignmentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	row, errMsg := buildAssignment(&in)
	if errMsg != "" {
		writeError(w, http.StatusBadRequest, errMsg)
		return
	}
	row.ID = id
	res, err := h.deps.DB.NewUpdate().Model(row).WherePK().
		ExcludeColumn("id", "created_at", "updated_at").
		Set("updated_at = current_timestamp").Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (h *ShiftAssignmentsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.ShiftAssignment)(nil)).
		Where("id = ?", id).Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// BulkRequest mirrors the frontend's bulkGenerate args: weekdays (0–6) →
// list of {templateId, employeeId} pairs. Backend expands the date range and
// inserts ON CONFLICT DO NOTHING so re-running is safe.
type bulkAssignmentRequest struct {
	StartDate string                                `json:"startDate"`
	EndDate   string                                `json:"endDate"`
	Pattern   map[string][]struct {
		TemplateID string `json:"templateId"`
		EmployeeID string `json:"employeeId"`
	} `json:"pattern"`
	Notes string `json:"notes"`
}

func (h *ShiftAssignmentsHandler) Bulk(w http.ResponseWriter, r *http.Request) {
	var req bulkAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	start, err1 := parseISODate(req.StartDate)
	end, err2 := parseISODate(req.EndDate)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, "startDate / endDate harus YYYY-MM-DD")
		return
	}
	if end.Before(start) {
		writeError(w, http.StatusBadRequest, "endDate sebelum startDate")
		return
	}

	rows := []models.ShiftAssignment{}
	cursor := start
	for !cursor.After(end) {
		dow := cursor.Weekday()
		slots := req.Pattern[itoa(int(dow))]
		date := cursor.Format("2006-01-02")
		for _, s := range slots {
			tplID, err := uuid.Parse(s.TemplateID)
			if err != nil {
				continue
			}
			empID, err := uuid.Parse(s.EmployeeID)
			if err != nil {
				continue
			}
			rows = append(rows, models.ShiftAssignment{
				Date:       date,
				TemplateID: tplID,
				EmployeeID: empID,
				Notes:      req.Notes,
				Status:     models.AssignmentStatusPlanned,
			})
		}
		cursor = cursor.AddDate(0, 0, 1)
	}

	if len(rows) == 0 {
		writeJSON(w, http.StatusOK, map[string]int{"created": 0, "skipped": 0})
		return
	}
	res, err := h.deps.DB.NewInsert().Model(&rows).
		On("CONFLICT (date, template_id, employee_id) DO NOTHING").
		Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	created, _ := res.RowsAffected()
	writeJSON(w, http.StatusOK, map[string]int64{
		"created": created,
		"skipped": int64(len(rows)) - created,
	})
}

func buildAssignment(in *shiftAssignmentInput) (*models.ShiftAssignment, string) {
	if strings.TrimSpace(in.Date) == "" {
		return nil, "date wajib diisi"
	}
	tplID, err := uuid.Parse(in.TemplateID)
	if err != nil {
		return nil, "templateId tidak valid"
	}
	empID, err := uuid.Parse(in.EmployeeID)
	if err != nil {
		return nil, "employeeId tidak valid"
	}
	row := &models.ShiftAssignment{
		Date:       strings.TrimSpace(in.Date),
		TemplateID: tplID,
		EmployeeID: empID,
		Notes:      strings.TrimSpace(in.Notes),
		Status:     assignmentStatusOrDefault(in.Status),
	}
	if in.ActualShiftID != nil && strings.TrimSpace(*in.ActualShiftID) != "" {
		if sid, err := uuid.Parse(*in.ActualShiftID); err == nil {
			row.ActualShiftID = &sid
		}
	}
	return row, ""
}

func assignmentStatusOrDefault(s string) string {
	switch strings.TrimSpace(s) {
	case models.AssignmentStatusCompleted, models.AssignmentStatusAbsent, models.AssignmentStatusReplaced:
		return s
	}
	return models.AssignmentStatusPlanned
}
