package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"pos/internal/database/sqlc"
	"pos/internal/model"
)

const (
	ContextKeyPermissions    contextKey = "permissions"
	ContextKeyStoreIDs       contextKey = "store_ids"
	ContextKeyAllStoreAccess contextKey = "all_stores_access"
)

// LoadPermissions queries the user's role permissions and attaches them to context.
func LoadPermissions(queries *sqlc.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := UserIDFromContext(r.Context())
			if userID == uuid.Nil {
				writeAuthError(w, "unauthorized")
				return
			}

			rows, err := queries.LoadUserPermissions(r.Context(), userID)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(model.ErrorResponse{Error: "failed to load permissions"})
				return
			}

			perms := make(map[string]map[string]bool)
			for _, row := range rows {
				if perms[row.FeatureSlug] == nil {
					perms[row.FeatureSlug] = make(map[string]bool)
				}
				for _, action := range row.Actions {
					perms[row.FeatureSlug][action] = true
				}
			}

			ctx := context.WithValue(r.Context(), ContextKeyPermissions, perms)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// LoadStoreAccess queries the user's assigned stores and attaches them to context.
func LoadStoreAccess(queries *sqlc.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := UserIDFromContext(r.Context())
			if userID == uuid.Nil {
				writeAuthError(w, "unauthorized")
				return
			}

			// Check if user has system default (admin) role
			hasDefault, err := queries.HasSystemDefaultRole(r.Context(), userID)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(model.ErrorResponse{Error: "failed to check role"})
				return
			}

			ctx := r.Context()

			if hasDefault {
				ctx = context.WithValue(ctx, ContextKeyAllStoreAccess, true)
			} else {
				storeIDs, err := queries.GetUserStoreIDs(r.Context(), userID)
				if err != nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					json.NewEncoder(w).Encode(model.ErrorResponse{Error: "failed to load store access"})
					return
				}
				ctx = context.WithValue(ctx, ContextKeyStoreIDs, storeIDs)
				ctx = context.WithValue(ctx, ContextKeyAllStoreAccess, false)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePermission is a middleware factory that checks for a specific feature+action.
func RequirePermission(featureSlug, action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !HasPermission(r.Context(), featureSlug, action) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(model.ErrorResponse{Error: "insufficient permissions"})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// HasPermission checks if the user in context has a specific permission.
func HasPermission(ctx context.Context, featureSlug, action string) bool {
	perms, ok := ctx.Value(ContextKeyPermissions).(map[string]map[string]bool)
	if !ok {
		return false
	}
	actions, ok := perms[featureSlug]
	if !ok {
		return false
	}
	return actions[action]
}

// GetAccessibleStoreIDs returns the user's accessible store IDs, or nil if all-access.
func GetAccessibleStoreIDs(ctx context.Context) []uuid.UUID {
	if allAccess, ok := ctx.Value(ContextKeyAllStoreAccess).(bool); ok && allAccess {
		return nil
	}
	ids, _ := ctx.Value(ContextKeyStoreIDs).([]uuid.UUID)
	return ids
}

// HasAllStoreAccess returns true if the user has access to all stores (admin).
func HasAllStoreAccess(ctx context.Context) bool {
	allAccess, ok := ctx.Value(ContextKeyAllStoreAccess).(bool)
	return ok && allAccess
}

// CanAccessStore checks if the user can access a specific store.
func CanAccessStore(ctx context.Context, storeID uuid.UUID) bool {
	if HasAllStoreAccess(ctx) {
		return true
	}
	ids := GetAccessibleStoreIDs(ctx)
	for _, id := range ids {
		if id == storeID {
			return true
		}
	}
	return false
}
