package handler

import (
	"net/http"

	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
)

type UploadHandler struct {
	upload *service.UploadService
}

func NewUploadHandler(upload *service.UploadService) *UploadHandler {
	return &UploadHandler{upload: upload}
}

func (h *UploadHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB max
		respondError(w, model.ValidationError("file too large or invalid form"))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, model.ValidationError("no file provided"))
		return
	}
	defer file.Close()

	tenantID := middleware.TenantIDFromContext(r.Context())

	imageURL, err := h.upload.UploadImage(r.Context(), tenantID, file, header)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"image_url": imageURL})
}
