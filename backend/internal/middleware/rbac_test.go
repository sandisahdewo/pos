package middleware_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"pos/internal/middleware"
	"pos/internal/model"
)

func TestHasPermission(t *testing.T) {
	perms := map[string]map[string]bool{
		"master-data.product": {"read": true, "create": true},
		"reporting.sales":     {"read": true},
	}
	ctx := context.WithValue(context.Background(), middleware.ContextKeyPermissions, perms)

	t.Run("has permission", func(t *testing.T) {
		assert.True(t, middleware.HasPermission(ctx, "master-data.product", "read"))
		assert.True(t, middleware.HasPermission(ctx, "master-data.product", "create"))
		assert.True(t, middleware.HasPermission(ctx, "reporting.sales", "read"))
	})

	t.Run("missing action", func(t *testing.T) {
		assert.False(t, middleware.HasPermission(ctx, "master-data.product", "delete"))
		assert.False(t, middleware.HasPermission(ctx, "reporting.sales", "create"))
	})

	t.Run("missing feature", func(t *testing.T) {
		assert.False(t, middleware.HasPermission(ctx, "purchase.product", "read"))
	})

	t.Run("empty context", func(t *testing.T) {
		assert.False(t, middleware.HasPermission(context.Background(), "master-data.product", "read"))
	})
}

func TestCanAccessStore(t *testing.T) {
	storeA := uuid.New()
	storeB := uuid.New()
	storeC := uuid.New()

	t.Run("admin has all store access", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, true)
		assert.True(t, middleware.CanAccessStore(ctx, storeA))
		assert.True(t, middleware.CanAccessStore(ctx, storeB))
		assert.True(t, middleware.CanAccessStore(ctx, uuid.New()))
	})

	t.Run("user with specific store access", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, false)
		ctx = context.WithValue(ctx, middleware.ContextKeyStoreIDs, []uuid.UUID{storeA, storeB})

		assert.True(t, middleware.CanAccessStore(ctx, storeA))
		assert.True(t, middleware.CanAccessStore(ctx, storeB))
		assert.False(t, middleware.CanAccessStore(ctx, storeC))
	})

	t.Run("user with no store access", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, false)
		ctx = context.WithValue(ctx, middleware.ContextKeyStoreIDs, []uuid.UUID{})

		assert.False(t, middleware.CanAccessStore(ctx, storeA))
	})

	t.Run("empty context", func(t *testing.T) {
		assert.False(t, middleware.CanAccessStore(context.Background(), storeA))
	})
}

func TestHasAllStoreAccess(t *testing.T) {
	t.Run("true when set", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, true)
		assert.True(t, middleware.HasAllStoreAccess(ctx))
	})

	t.Run("false when explicitly set", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, false)
		assert.False(t, middleware.HasAllStoreAccess(ctx))
	})

	t.Run("false when not set", func(t *testing.T) {
		assert.False(t, middleware.HasAllStoreAccess(context.Background()))
	})
}

func TestGetAccessibleStoreIDs(t *testing.T) {
	storeA := uuid.New()
	storeB := uuid.New()

	t.Run("returns nil for all access", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, true)
		ids := middleware.GetAccessibleStoreIDs(ctx)
		assert.Nil(t, ids)
	})

	t.Run("returns store IDs for limited access", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), middleware.ContextKeyAllStoreAccess, false)
		ctx = context.WithValue(ctx, middleware.ContextKeyStoreIDs, []uuid.UUID{storeA, storeB})
		ids := middleware.GetAccessibleStoreIDs(ctx)
		assert.Equal(t, []uuid.UUID{storeA, storeB}, ids)
	})

	t.Run("returns nil for empty context", func(t *testing.T) {
		ids := middleware.GetAccessibleStoreIDs(context.Background())
		assert.Nil(t, ids)
	})
}

func TestRequirePermission(t *testing.T) {
	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	t.Run("allows when permission exists", func(t *testing.T) {
		perms := map[string]map[string]bool{
			"master-data.product": {"read": true},
		}
		ctx := context.WithValue(context.Background(), middleware.ContextKeyPermissions, perms)

		req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
		rr := httptest.NewRecorder()

		handler := middleware.RequirePermission("master-data.product", "read")(okHandler)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "ok", rr.Body.String())
	})

	t.Run("denies when permission missing", func(t *testing.T) {
		perms := map[string]map[string]bool{
			"reporting.sales": {"read": true},
		}
		ctx := context.WithValue(context.Background(), middleware.ContextKeyPermissions, perms)

		req := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
		rr := httptest.NewRecorder()

		handler := middleware.RequirePermission("master-data.product", "create")(okHandler)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusForbidden, rr.Code)

		var resp model.ErrorResponse
		err := json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Contains(t, resp.Error, "insufficient permissions")
	})

	t.Run("denies with empty context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rr := httptest.NewRecorder()

		handler := middleware.RequirePermission("master-data.product", "read")(okHandler)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusForbidden, rr.Code)
	})
}

func TestAuthenticate(t *testing.T) {
	secret := "test-secret-for-auth-middleware"

	okHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.UserIDFromContext(r.Context())
		tenantID := middleware.TenantIDFromContext(r.Context())
		email := middleware.EmailFromContext(r.Context())

		resp := map[string]string{
			"user_id":   userID.String(),
			"tenant_id": tenantID.String(),
			"email":     email,
		}
		json.NewEncoder(w).Encode(resp)
	})

	handler := middleware.Authenticate(secret)(okHandler)

	t.Run("valid token passes claims to context", func(t *testing.T) {
		userID := uuid.New()
		tenantID := uuid.New()
		email := "test@example.com"

		token := makeTestJWT(userID, tenantID, email, secret)

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var resp map[string]string
		err := json.NewDecoder(rr.Body).Decode(&resp)
		require.NoError(t, err)
		assert.Equal(t, userID.String(), resp["user_id"])
		assert.Equal(t, tenantID.String(), resp["tenant_id"])
		assert.Equal(t, email, resp["email"])
	})

	t.Run("missing header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("invalid token returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer invalid.token.here")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("wrong secret returns 401", func(t *testing.T) {
		token := makeTestJWT(uuid.New(), uuid.New(), "test@test.com", "wrong-secret")
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("non-bearer scheme returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})
}

// makeTestJWT creates a signed JWT for testing the auth middleware.
func makeTestJWT(userID, tenantID uuid.UUID, email, secret string) string {
	now := time.Now()
	claims := middleware.Claims{
		UserID:   userID,
		TenantID: tenantID,
		Email:    email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		panic("failed to sign test JWT: " + err.Error())
	}
	return signed
}
