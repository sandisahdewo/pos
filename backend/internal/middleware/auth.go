package middleware

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/sandisahdewo/pos/backend/internal/auth"
)

// RequireAuth extracts the Bearer token, validates it, and attaches the claims
// to the request context via auth.WithClaims. Handlers read them via
// auth.ClaimsFrom(r.Context()).
func RequireAuth(issuer *auth.Issuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			if !strings.HasPrefix(h, "Bearer ") {
				writeError(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			tokenStr := strings.TrimPrefix(h, "Bearer ")
			claims, err := issuer.Parse(tokenStr)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid token")
				return
			}
			next.ServeHTTP(w, r.WithContext(auth.WithClaims(r.Context(), claims)))
		})
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
