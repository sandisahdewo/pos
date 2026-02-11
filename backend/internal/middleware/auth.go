package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"pos/internal/model"
)

type contextKey string

const (
	ContextKeyUserID   contextKey = "user_id"
	ContextKeyTenantID contextKey = "tenant_id"
	ContextKeyEmail    contextKey = "email"
)

// Claims represents the JWT claims for this application.
type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Email    string    `json:"email"`
	jwt.RegisteredClaims
}

// Authenticate validates the JWT from the Authorization header and injects claims into context.
func Authenticate(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeAuthError(w, "missing authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				writeAuthError(w, "invalid authorization header format")
				return
			}

			tokenStr := parts[1]

			claims := &Claims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (any, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, model.UnauthorizedError("unexpected signing method")
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				writeAuthError(w, "invalid or expired token")
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyTenantID, claims.TenantID)
			ctx = context.WithValue(ctx, ContextKeyEmail, claims.Email)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext extracts the user ID from the request context.
func UserIDFromContext(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(ContextKeyUserID).(uuid.UUID)
	return id
}

// TenantIDFromContext extracts the tenant ID from the request context.
func TenantIDFromContext(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(ContextKeyTenantID).(uuid.UUID)
	return id
}

// EmailFromContext extracts the email from the request context.
func EmailFromContext(ctx context.Context) string {
	email, _ := ctx.Value(ContextKeyEmail).(string)
	return email
}

func writeAuthError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(model.ErrorResponse{
		Error: message,
	})
}
