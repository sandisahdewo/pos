package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/sandisahdewo/pos/backend/internal/models"
)

type AuthHandler struct {
	deps Deps
}

func NewAuthHandler(deps Deps) *AuthHandler {
	return &AuthHandler{deps: deps}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password required")
		return
	}

	var user models.User
	err := h.deps.DB.NewSelect().Model(&user).Where("email = ?", req.Email).Scan(r.Context())
	if err != nil {
		// Avoid leaking whether the email exists.
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if !auth.CheckPassword(req.Password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if user.Status != "active" {
		writeError(w, http.StatusForbidden, "akun pegawai ini tidak aktif")
		return
	}

	roleNames, err := loadRoleNamesFor(r.Context(), h.deps.DB, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	roleIDs, err := loadRoleIDsFor(r.Context(), h.deps.DB, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	user.RoleIDs = roleIDs

	token, err := h.deps.Issuer.Issue(user.ID, roleNames)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "issue token")
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{Token: token, User: user})
}

// Me returns the authenticated user's profile (with role IDs) based on the
// JWT claims. Roles + permissions can be fetched separately via /api/roles.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFrom(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "no claims")
		return
	}
	var user models.User
	err := h.deps.DB.NewSelect().Model(&user).Where("id = ?", claims.UserID).Scan(r.Context())
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
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
