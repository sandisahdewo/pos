package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/uptrace/bun"
)

// Deps holds shared handler dependencies. Constructed once in main and passed
// to each handler group constructor.
type Deps struct {
	DB         *bun.DB
	Issuer     *auth.Issuer
	BcryptCost int
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
