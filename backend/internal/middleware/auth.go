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

// RequireRole gates a route to callers whose JWT claims include any of the
// given role identifiers. Must be chained after RequireAuth.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := auth.ClaimsFrom(r.Context())
			if !ok {
				writeError(w, http.StatusUnauthorized, "no claims")
				return
			}
			for _, want := range roles {
				if claims.HasRole(want) {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, http.StatusForbidden, "akses ditolak")
		})
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
