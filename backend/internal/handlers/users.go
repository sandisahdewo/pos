package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type UsersHandler struct {
	deps Deps
}

func NewUsersHandler(deps Deps) *UsersHandler {
	return &UsersHandler{deps: deps}
}

// userInput is the request body for create + update. Password is optional on
// update — empty means "keep existing hash". JoinedAt accepts YYYY-MM-DD.
type userInput struct {
	Email    string      `json:"email"`
	Name     string      `json:"name"`
	Phone    string      `json:"phone"`
	Password string      `json:"password"`
	PIN      string      `json:"pin"`
	Status   string      `json:"status"`
	JoinedAt string      `json:"joinedAt"`
	RoleIDs  []uuid.UUID `json:"roleIds"`
}

func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
	users := []models.User{}
	err := h.deps.DB.NewSelect().Model(&users).Order("name ASC").Scan(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// N+1 is fine here — user count is small per shop.
	for i := range users {
		ids, err := loadRoleIDsFor(r.Context(), h.deps.DB, users[i].ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		users[i].RoleIDs = ids
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *UsersHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var user models.User
	if err := h.deps.DB.NewSelect().Model(&user).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	ids, err := loadRoleIDsFor(r.Context(), h.deps.DB, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	user.RoleIDs = ids
	writeJSON(w, http.StatusOK, user)
}

func (h *UsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in userInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateUserInput(&in, true); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	hash, err := auth.HashPassword(in.Password, h.deps.BcryptCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash password")
		return
	}
	user := &models.User{
		Email:        strings.ToLower(strings.TrimSpace(in.Email)),
		Name:         strings.TrimSpace(in.Name),
		Phone:        strings.TrimSpace(in.Phone),
		PasswordHash: hash,
		PIN:          strings.TrimSpace(in.PIN),
		Status:       statusOrDefault(in.Status),
	}
	if t, ok := parseDate(in.JoinedAt); ok {
		user.JoinedAt = t
	} else {
		user.JoinedAt = time.Now()
	}
	if _, err := h.deps.DB.NewInsert().Model(user).Returning("*").Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := replaceUserRoles(r.Context(), h.deps.DB, user.ID, in.RoleIDs); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	user.RoleIDs = in.RoleIDs
	writeJSON(w, http.StatusCreated, user)
}

func (h *UsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in userInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if msg := validateUserInput(&in, false); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	q := h.deps.DB.NewUpdate().Table("users").Where("id = ?", id).
		Set("email = ?", strings.ToLower(strings.TrimSpace(in.Email))).
		Set("name = ?", strings.TrimSpace(in.Name)).
		Set("phone = ?", strings.TrimSpace(in.Phone)).
		Set("pin = ?", strings.TrimSpace(in.PIN)).
		Set("status = ?", statusOrDefault(in.Status)).
		Set("updated_at = current_timestamp")
	if t, ok := parseDate(in.JoinedAt); ok {
		q = q.Set("joined_at = ?", t)
	}
	if in.Password != "" {
		hash, err := auth.HashPassword(in.Password, h.deps.BcryptCost)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "hash password")
			return
		}
		q = q.Set("password_hash = ?", hash)
	}

	res, err := q.Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err := replaceUserRoles(r.Context(), h.deps.DB, id, in.RoleIDs); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var user models.User
	if err := h.deps.DB.NewSelect().Model(&user).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	user.RoleIDs = in.RoleIDs
	writeJSON(w, http.StatusOK, user)
}

func (h *UsersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if claims, ok := auth.ClaimsFrom(r.Context()); ok && claims.UserID == id {
		writeError(w, http.StatusBadRequest, "tidak bisa menghapus akun Anda sendiri")
		return
	}
	res, err := h.deps.DB.NewDelete().Model((*models.User)(nil)).Where("id = ?", id).Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func validateUserInput(in *userInput, requirePassword bool) string {
	if strings.TrimSpace(in.Email) == "" {
		return "email wajib diisi"
	}
	if strings.TrimSpace(in.Name) == "" {
		return "nama wajib diisi"
	}
	if len(in.RoleIDs) == 0 {
		return "pilih minimal satu peran"
	}
	if requirePassword && in.Password == "" {
		return "kata sandi wajib diisi"
	}
	if in.Password != "" && len(in.Password) < 6 {
		return "kata sandi minimal 6 karakter"
	}
	pin := strings.TrimSpace(in.PIN)
	if pin != "" {
		if len(pin) != 4 {
			return "PIN harus 4 digit"
		}
		for _, c := range pin {
			if c < '0' || c > '9' {
				return "PIN harus angka"
			}
		}
	}
	return ""
}

func statusOrDefault(s string) string {
	s = strings.TrimSpace(s)
	if s == models.UserStatusInactive {
		return models.UserStatusInactive
	}
	return models.UserStatusActive
}

func parseDate(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}
