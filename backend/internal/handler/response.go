package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"pos/internal/model"
)

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		if err := json.NewEncoder(w).Encode(data); err != nil {
			slog.Error("failed to encode response", "error", err)
		}
	}
}

func respondError(w http.ResponseWriter, err error) {
	appErr, ok := model.IsAppError(err)
	if !ok {
		slog.Error("unhandled error", "error", err)
		respondJSON(w, http.StatusInternalServerError, model.ErrorResponse{
			Error: "internal server error",
		})
		return
	}

	if appErr.Code >= 500 {
		slog.Error("server error", "error", appErr.Error(), "code", appErr.Code)
	}

	respondJSON(w, appErr.Code, model.ErrorResponse{
		Error: appErr.Message,
	})
}

func respondValidationError(w http.ResponseWriter, details map[string]string) {
	respondJSON(w, http.StatusUnprocessableEntity, model.ErrorResponse{
		Error:   "validation failed",
		Details: details,
	})
}

func respondMessage(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, model.APIResponse{Message: message})
}
