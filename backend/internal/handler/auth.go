package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req model.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("failed to decode register request", "error", err)
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	resp, err := h.auth.Register(r.Context(), req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, resp)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req model.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	resp, err := h.auth.Login(r.Context(), req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req model.VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	if err := h.auth.VerifyEmail(r.Context(), req); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "email verified successfully")
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req model.ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	if err := h.auth.ForgotPassword(r.Context(), req); err != nil {
		respondError(w, err)
		return
	}

	// Always return success to prevent email enumeration
	respondMessage(w, http.StatusOK, "if the email exists, a reset link has been sent")
}

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req model.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	if err := h.auth.ResetPassword(r.Context(), req); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "password reset successfully")
}

func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req model.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	tokens, err := h.auth.RefreshToken(r.Context(), req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, tokens)
}

func (h *AuthHandler) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	var req model.AcceptInvitationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	resp, err := h.auth.AcceptInvitation(r.Context(), req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, resp)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req model.LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	if err := h.auth.Logout(r.Context(), req); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "logged out successfully")
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req model.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, model.ValidationError("invalid request body"))
		return
	}

	if details, err := model.ValidateWithDetails(&req); err != nil {
		respondValidationError(w, details)
		return
	}

	userID := middleware.UserIDFromContext(r.Context())
	if err := h.auth.ChangePassword(r.Context(), userID, req); err != nil {
		respondError(w, err)
		return
	}

	respondMessage(w, http.StatusOK, "password changed successfully")
}

func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())

	resp, err := h.auth.GetMe(r.Context(), userID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, resp)
}
