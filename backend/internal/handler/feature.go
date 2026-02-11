package handler

import (
	"net/http"

	"pos/internal/service"
)

type FeatureHandler struct {
	role *service.RoleService
}

func NewFeatureHandler(role *service.RoleService) *FeatureHandler {
	return &FeatureHandler{role: role}
}

func (h *FeatureHandler) List(w http.ResponseWriter, r *http.Request) {
	features, err := h.role.ListFeatures(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, features)
}
