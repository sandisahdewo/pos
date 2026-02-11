package service_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"pos/internal/database/sqlc"
	"pos/internal/model"
	"pos/internal/service"
	"pos/internal/testutil"
)

func TestAuthService_Register(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)

	cfg := testutil.TestConfig()
	tokenSvc := service.NewTokenService(&cfg.JWT)
	authSvc := service.NewAuthService(pool, queries, tokenSvc, cfg, &testutil.NoopEnqueuer{})

	ctx := context.Background()

	t.Run("successful registration", func(t *testing.T) {
		req := model.RegisterRequest{
			TenantName:   "Acme Corp",
			Email:        "admin@acme.com",
			Password:     "securePass123",
			FirstName:    "John",
			LastName:     "Doe",
			StoreName:    "Main Store",
			StoreAddress: "123 Main St",
		}

		resp, err := authSvc.Register(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Verify user response
		assert.Equal(t, "admin@acme.com", resp.User.Email)
		assert.Equal(t, "John", resp.User.FirstName)
		assert.Equal(t, "Doe", resp.User.LastName)
		assert.True(t, resp.User.IsActive)
		assert.NotEqual(t, uuid.Nil, resp.User.ID)

		// Verify tokens returned
		assert.NotEmpty(t, resp.Tokens.AccessToken)
		assert.NotEmpty(t, resp.Tokens.RefreshToken)
	})

	t.Run("duplicate tenant name", func(t *testing.T) {
		req := model.RegisterRequest{
			TenantName:   "Acme Corp",
			Email:        "other@acme.com",
			Password:     "securePass123",
			FirstName:    "Jane",
			LastName:     "Smith",
			StoreName:    "Second Store",
			StoreAddress: "",
		}

		resp, err := authSvc.Register(ctx, req)
		assert.Nil(t, resp)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("duplicate email", func(t *testing.T) {
		req := model.RegisterRequest{
			TenantName:   "Other Corp",
			Email:        "admin@acme.com",
			Password:     "securePass123",
			FirstName:    "Jane",
			LastName:     "Smith",
			StoreName:    "New Store",
			StoreAddress: "",
		}

		resp, err := authSvc.Register(ctx, req)
		assert.Nil(t, resp)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})
}

func TestAuthService_Login(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	authSvc, _, resp, req := testutil.CreateTestUser(t, pool, queries)

	ctx := context.Background()

	t.Run("successful login", func(t *testing.T) {
		loginResp, err := authSvc.Login(ctx, model.LoginRequest{
			Email:    req.Email,
			Password: req.Password,
		})
		require.NoError(t, err)
		require.NotNil(t, loginResp)
		assert.Equal(t, resp.User.ID, loginResp.User.ID)
		assert.NotEmpty(t, loginResp.Tokens.AccessToken)
		assert.NotEmpty(t, loginResp.Tokens.RefreshToken)
	})

	t.Run("wrong password", func(t *testing.T) {
		loginResp, err := authSvc.Login(ctx, model.LoginRequest{
			Email:    req.Email,
			Password: "wrongpassword",
		})
		assert.Nil(t, loginResp)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
	})

	t.Run("nonexistent email", func(t *testing.T) {
		loginResp, err := authSvc.Login(ctx, model.LoginRequest{
			Email:    "noone@nowhere.com",
			Password: "anything",
		})
		assert.Nil(t, loginResp)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
	})

	t.Run("deactivated user cannot login", func(t *testing.T) {
		// Deactivate user
		err := queries.DeactivateUser(ctx, resp.User.ID)
		require.NoError(t, err)

		loginResp, err := authSvc.Login(ctx, model.LoginRequest{
			Email:    req.Email,
			Password: req.Password,
		})
		assert.Nil(t, loginResp)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
		assert.Contains(t, appErr.Message, "deactivated")
	})
}

func TestAuthService_VerifyEmail(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)

	cfg := testutil.TestConfig()
	tokenSvc := service.NewTokenService(&cfg.JWT)
	authSvc := service.NewAuthService(pool, queries, tokenSvc, cfg, &testutil.NoopEnqueuer{})

	ctx := context.Background()

	// Register a user
	suffix := uuid.New().String()[:8]
	regResp, err := authSvc.Register(ctx, model.RegisterRequest{
		TenantName: "Verify Tenant " + suffix,
		Email:      "verify-" + suffix + "@test.com",
		Password:   "testpass123",
		FirstName:  "Test",
		LastName:   "User",
		StoreName:  "Verify Store " + suffix,
	})
	require.NoError(t, err)

	// Generate a verification token manually
	plainToken, tokenHash, err := service.GenerateRandomToken()
	require.NoError(t, err)

	_, err = queries.CreateEmailVerification(ctx, sqlc.CreateEmailVerificationParams{
		UserID:    regResp.User.ID,
		TokenHash: tokenHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(24 * time.Hour), Valid: true},
	})
	require.NoError(t, err)

	t.Run("successful verification", func(t *testing.T) {
		err := authSvc.VerifyEmail(ctx, model.VerifyEmailRequest{Token: plainToken})
		require.NoError(t, err)

		// Verify user is now email verified
		user, err := queries.GetUserByID(ctx, regResp.User.ID)
		require.NoError(t, err)
		assert.True(t, user.IsEmailVerified)
	})

	t.Run("already used token", func(t *testing.T) {
		err := authSvc.VerifyEmail(ctx, model.VerifyEmailRequest{Token: plainToken})
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
		assert.Contains(t, appErr.Message, "already used")
	})

	t.Run("invalid token", func(t *testing.T) {
		err := authSvc.VerifyEmail(ctx, model.VerifyEmailRequest{Token: "invalidtoken"})
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
	})

	t.Run("expired token", func(t *testing.T) {
		expiredPlain, expiredHash, err := service.GenerateRandomToken()
		require.NoError(t, err)

		_, err = queries.CreateEmailVerification(ctx, sqlc.CreateEmailVerificationParams{
			UserID:    regResp.User.ID,
			TokenHash: expiredHash,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true},
		})
		require.NoError(t, err)

		err = authSvc.VerifyEmail(ctx, model.VerifyEmailRequest{Token: expiredPlain})
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
		assert.Contains(t, appErr.Message, "expired")
	})
}

func TestAuthService_RefreshToken(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	authSvc, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	ctx := context.Background()

	t.Run("successful rotation", func(t *testing.T) {
		// Use the refresh token from registration
		newTokens, err := authSvc.RefreshToken(ctx, model.RefreshTokenRequest{
			RefreshToken: resp.Tokens.RefreshToken,
		})
		require.NoError(t, err)
		require.NotNil(t, newTokens)
		assert.NotEmpty(t, newTokens.AccessToken)
		assert.NotEmpty(t, newTokens.RefreshToken)
		// New token should be different from old one
		assert.NotEqual(t, resp.Tokens.RefreshToken, newTokens.RefreshToken)
	})

	t.Run("reuse detection revokes all tokens", func(t *testing.T) {
		// Re-use the old (now revoked) refresh token
		reused, err := authSvc.RefreshToken(ctx, model.RefreshTokenRequest{
			RefreshToken: resp.Tokens.RefreshToken,
		})
		assert.Nil(t, reused)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
		assert.Contains(t, appErr.Message, "revoked")
	})

	t.Run("invalid refresh token", func(t *testing.T) {
		result, err := authSvc.RefreshToken(ctx, model.RefreshTokenRequest{
			RefreshToken: "invalidtoken",
		})
		assert.Nil(t, result)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
	})
}

func TestAuthService_PasswordReset(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	authSvc, _, resp, req := testutil.CreateTestUser(t, pool, queries)

	ctx := context.Background()

	t.Run("forgot password always succeeds", func(t *testing.T) {
		// Existing email
		err := authSvc.ForgotPassword(ctx, model.ForgotPasswordRequest{Email: req.Email})
		require.NoError(t, err)

		// Nonexistent email also succeeds (no enumeration)
		err = authSvc.ForgotPassword(ctx, model.ForgotPasswordRequest{Email: "nonexistent@test.com"})
		require.NoError(t, err)
	})

	t.Run("reset password with valid token", func(t *testing.T) {
		plainToken, tokenHash, err := service.GenerateRandomToken()
		require.NoError(t, err)

		_, err = queries.CreatePasswordReset(ctx, sqlc.CreatePasswordResetParams{
			UserID:    resp.User.ID,
			TokenHash: tokenHash,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(1 * time.Hour), Valid: true},
		})
		require.NoError(t, err)

		err = authSvc.ResetPassword(ctx, model.ResetPasswordRequest{
			Token:    plainToken,
			Password: "newSecurePass456",
		})
		require.NoError(t, err)

		// Verify login with new password works
		loginResp, err := authSvc.Login(ctx, model.LoginRequest{
			Email:    req.Email,
			Password: "newSecurePass456",
		})
		require.NoError(t, err)
		assert.NotNil(t, loginResp)
	})

	t.Run("reset password with expired token", func(t *testing.T) {
		plainToken, tokenHash, err := service.GenerateRandomToken()
		require.NoError(t, err)

		_, err = queries.CreatePasswordReset(ctx, sqlc.CreatePasswordResetParams{
			UserID:    resp.User.ID,
			TokenHash: tokenHash,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true},
		})
		require.NoError(t, err)

		err = authSvc.ResetPassword(ctx, model.ResetPasswordRequest{
			Token:    plainToken,
			Password: "yetAnotherPass",
		})
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
		assert.Contains(t, appErr.Message, "expired")
	})
}

func TestAuthService_ChangePassword(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	authSvc, _, resp, req := testutil.CreateTestUser(t, pool, queries)

	ctx := context.Background()

	t.Run("successful password change", func(t *testing.T) {
		err := authSvc.ChangePassword(ctx, resp.User.ID, model.ChangePasswordRequest{
			CurrentPassword: req.Password,
			NewPassword:     "brandNewPass456",
		})
		require.NoError(t, err)

		// Verify can login with new password
		loginResp, err := authSvc.Login(ctx, model.LoginRequest{
			Email:    req.Email,
			Password: "brandNewPass456",
		})
		require.NoError(t, err)
		assert.NotNil(t, loginResp)
	})

	t.Run("wrong current password", func(t *testing.T) {
		err := authSvc.ChangePassword(ctx, resp.User.ID, model.ChangePasswordRequest{
			CurrentPassword: "wrongcurrent",
			NewPassword:     "something",
		})
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusUnauthorized, appErr.Code)
	})
}

func TestAuthService_GetMe(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	authSvc, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	ctx := context.Background()

	me, err := authSvc.GetMe(ctx, resp.User.ID)
	require.NoError(t, err)
	require.NotNil(t, me)

	assert.Equal(t, resp.User.ID, me.UserResponse.ID)
	assert.Equal(t, resp.User.Email, me.UserResponse.Email)
	// Admin user should have all store access
	assert.True(t, me.AllStores)
	// Should have roles
	require.NotEmpty(t, me.Roles)
	assert.Equal(t, "Administrator", me.Roles[0].Name)
	// Should have permissions
	assert.NotEmpty(t, me.Permissions)
	// Should have stores
	assert.NotEmpty(t, me.Stores)
}
