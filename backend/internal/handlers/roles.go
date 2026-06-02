package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type RolesHandler struct {
	deps Deps
}

func NewRolesHandler(deps Deps) *RolesHandler {
	return &RolesHandler{deps: deps}
}

type roleInput struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

func (h *RolesHandler) List(w http.ResponseWriter, r *http.Request) {
	roles := []models.Role{}
	err := h.deps.DB.NewSelect().Model(&roles).Order("name ASC").Scan(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// N+1 acceptable here — role count is small (<20 typical).
	for i := range roles {
		perms, err := loadPermissionsForRole(r.Context(), h.deps.DB, roles[i].ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		roles[i].Permissions = perms
	}
	writeJSON(w, http.StatusOK, roles)
}

func (h *RolesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var role models.Role
	if err := h.deps.DB.NewSelect().Model(&role).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	perms, err := loadPermissionsForRole(r.Context(), h.deps.DB, role.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	role.Permissions = perms
	writeJSON(w, http.StatusOK, role)
}

func (h *RolesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in roleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		writeError(w, http.StatusBadRequest, "nama peran wajib diisi")
		return
	}
	role := &models.Role{
		Name:        strings.TrimSpace(in.Name),
		Description: strings.TrimSpace(in.Description),
		IsSystem:    false,
	}
	_, err := h.deps.DB.NewInsert().Model(role).Returning("*").Exec(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := replaceRolePermissions(r.Context(), h.deps.DB, role.ID, in.Permissions); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	perms, _ := loadPermissionsForRole(r.Context(), h.deps.DB, role.ID)
	role.Permissions = perms
	writeJSON(w, http.StatusCreated, role)
}

func (h *RolesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in roleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	var existing models.Role
	if err := h.deps.DB.NewSelect().Model(&existing).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	q := h.deps.DB.NewUpdate().Table("roles").Where("id = ?", id).
		Set("description = ?", strings.TrimSpace(in.Description)).
		Set("updated_at = current_timestamp")
	// System roles: only description editable. Name + permissions locked.
	if !existing.IsSystem {
		if strings.TrimSpace(in.Name) == "" {
			writeError(w, http.StatusBadRequest, "nama peran wajib diisi")
			return
		}
		q = q.Set("name = ?", strings.TrimSpace(in.Name))
	}
	if _, err := q.Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !existing.IsSystem {
		if err := replaceRolePermissions(r.Context(), h.deps.DB, id, in.Permissions); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	var role models.Role
	if err := h.deps.DB.NewSelect().Model(&role).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	perms, _ := loadPermissionsForRole(r.Context(), h.deps.DB, id)
	role.Permissions = perms
	writeJSON(w, http.StatusOK, role)
}

func (h *RolesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var existing models.Role
	if err := h.deps.DB.NewSelect().Model(&existing).Where("id = ?", id).Scan(r.Context()); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if existing.IsSystem {
		writeError(w, http.StatusBadRequest, "peran sistem tidak bisa dihapus")
		return
	}
	// Block delete when any user still references the role. user_roles uses
	// ON DELETE RESTRICT but we want a friendlier message than the FK error.
	var assigned int
	if err := h.deps.DB.NewSelect().
		Table("user_roles").
		ColumnExpr("count(*)").
		Where("role_id = ?", id).
		Scan(r.Context(), &assigned); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if assigned > 0 {
		writeError(w, http.StatusBadRequest, "peran masih dipakai oleh pegawai")
		return
	}
	if _, err := h.deps.DB.NewDelete().Model((*models.Role)(nil)).Where("id = ?", id).Exec(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
