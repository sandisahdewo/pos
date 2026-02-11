package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"pos/internal/database/sqlc"
	"pos/internal/handler"
	"pos/internal/middleware"
	"pos/internal/model"
	"pos/internal/service"
	"pos/internal/testutil"
)

// setupAuthRouter creates a chi router with auth routes for testing.
func setupAuthRouter(t *testing.T) (*httptest.Server, *sqlc.Queries) {
	t.Helper()
	pool, queries := testutil.SetupTestDB(t)
	cfg := testutil.TestConfig()
	tokenSvc := service.NewTokenService(&cfg.JWT)
	authSvc := service.NewAuthService(pool, queries, tokenSvc, cfg, &testutil.NoopEnqueuer{})
	authHandler := handler.NewAuthHandler(authSvc)

	r := chi.NewRouter()
	r.Post("/api/v1/auth/register", authHandler.Register)
	r.Post("/api/v1/auth/login", authHandler.Login)
	r.Post("/api/v1/auth/refresh", authHandler.RefreshToken)
	r.Post("/api/v1/auth/forgot-password", authHandler.ForgotPassword)
	r.Post("/api/v1/auth/verify-email", authHandler.VerifyEmail)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(cfg.JWT.Secret))
		r.Post("/api/v1/auth/logout", authHandler.Logout)
		r.Put("/api/v1/auth/change-password", authHandler.ChangePassword)
		r.Get("/api/v1/me", authHandler.GetMe)
	})

	srv := httptest.NewServer(r)
	t.Cleanup(func() { srv.Close() })
	return srv, queries
}

func TestHandler_Register(t *testing.T) {
	srv, _ := setupAuthRouter(t)

	t.Run("successful registration", func(t *testing.T) {
		body := model.RegisterRequest{
			TenantName: "Handler Test Corp",
			Email:      "handler@test.com",
			Password:   "securePass123",
			FirstName:  "Handler",
			LastName:   "Test",
			StoreName:  "Handler Store",
		}
		resp := doPost(t, srv, "/api/v1/auth/register", body)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var result model.RegisterResponse
		decodeJSON(t, resp, &result)
		assert.Equal(t, "handler@test.com", result.User.Email)
		assert.NotEmpty(t, result.Tokens.AccessToken)
		assert.NotEmpty(t, result.Tokens.RefreshToken)
	})

	t.Run("validation error for missing fields", func(t *testing.T) {
		body := model.RegisterRequest{
			Email: "invalid",
		}
		resp := doPost(t, srv, "/api/v1/auth/register", body)
		assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)

		var result model.ErrorResponse
		decodeJSON(t, resp, &result)
		assert.NotEmpty(t, result.Details)
	})

	t.Run("invalid JSON body", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/auth/register", bytes.NewBufferString("not json"))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	})
}

func TestHandler_Login(t *testing.T) {
	srv, _ := setupAuthRouter(t)

	// Register first
	regBody := model.RegisterRequest{
		TenantName: "Login Test Corp",
		Email:      "login@test.com",
		Password:   "securePass123",
		FirstName:  "Login",
		LastName:   "Test",
		StoreName:  "Login Store",
	}
	regResp := doPost(t, srv, "/api/v1/auth/register", regBody)
	require.Equal(t, http.StatusCreated, regResp.StatusCode)
	regResp.Body.Close()

	t.Run("successful login", func(t *testing.T) {
		resp := doPost(t, srv, "/api/v1/auth/login", model.LoginRequest{
			Email:    "login@test.com",
			Password: "securePass123",
		})
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.LoginResponse
		decodeJSON(t, resp, &result)
		assert.Equal(t, "login@test.com", result.User.Email)
		assert.NotEmpty(t, result.Tokens.AccessToken)
	})

	t.Run("wrong password returns 401", func(t *testing.T) {
		resp := doPost(t, srv, "/api/v1/auth/login", model.LoginRequest{
			Email:    "login@test.com",
			Password: "wrongpass",
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("nonexistent email returns 401", func(t *testing.T) {
		resp := doPost(t, srv, "/api/v1/auth/login", model.LoginRequest{
			Email:    "noone@nowhere.com",
			Password: "anything",
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

func TestHandler_RefreshToken(t *testing.T) {
	srv, _ := setupAuthRouter(t)

	// Register a user
	regBody := model.RegisterRequest{
		TenantName: "Refresh Test Corp",
		Email:      "refresh@test.com",
		Password:   "securePass123",
		FirstName:  "Refresh",
		LastName:   "Test",
		StoreName:  "Refresh Store",
	}
	regResp := doPost(t, srv, "/api/v1/auth/register", regBody)
	require.Equal(t, http.StatusCreated, regResp.StatusCode)

	var regResult model.RegisterResponse
	decodeJSON(t, regResp, &regResult)

	t.Run("successful token refresh", func(t *testing.T) {
		resp := doPost(t, srv, "/api/v1/auth/refresh", model.RefreshTokenRequest{
			RefreshToken: regResult.Tokens.RefreshToken,
		})
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var tokens model.AuthTokens
		decodeJSON(t, resp, &tokens)
		assert.NotEmpty(t, tokens.AccessToken)
		assert.NotEmpty(t, tokens.RefreshToken)
		assert.NotEqual(t, regResult.Tokens.RefreshToken, tokens.RefreshToken)
	})

	t.Run("reusing old token fails", func(t *testing.T) {
		resp := doPost(t, srv, "/api/v1/auth/refresh", model.RefreshTokenRequest{
			RefreshToken: regResult.Tokens.RefreshToken,
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

func TestHandler_FullAuthFlow(t *testing.T) {
	srv, _ := setupAuthRouter(t)

	// Step 1: Register
	regBody := model.RegisterRequest{
		TenantName: "Flow Test Corp",
		Email:      "flow@test.com",
		Password:   "securePass123",
		FirstName:  "Flow",
		LastName:   "Test",
		StoreName:  "Flow Store",
	}
	regResp := doPost(t, srv, "/api/v1/auth/register", regBody)
	require.Equal(t, http.StatusCreated, regResp.StatusCode)

	var regResult model.RegisterResponse
	decodeJSON(t, regResp, &regResult)

	// Step 2: Login
	loginResp := doPost(t, srv, "/api/v1/auth/login", model.LoginRequest{
		Email:    "flow@test.com",
		Password: "securePass123",
	})
	require.Equal(t, http.StatusOK, loginResp.StatusCode)

	var loginResult model.LoginResponse
	decodeJSON(t, loginResp, &loginResult)
	accessToken := loginResult.Tokens.AccessToken
	refreshToken := loginResult.Tokens.RefreshToken

	// Step 3: Get Me (authenticated)
	meReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+accessToken)
	meResp, err := http.DefaultClient.Do(meReq)
	require.NoError(t, err)
	defer meResp.Body.Close()
	assert.Equal(t, http.StatusOK, meResp.StatusCode)

	// Step 4: Refresh token
	refreshResp := doPost(t, srv, "/api/v1/auth/refresh", model.RefreshTokenRequest{
		RefreshToken: refreshToken,
	})
	require.Equal(t, http.StatusOK, refreshResp.StatusCode)

	var newTokens model.AuthTokens
	decodeJSON(t, refreshResp, &newTokens)

	// Step 5: Logout with new refresh token
	logoutReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/auth/logout", nil)
	logoutReq.Header.Set("Authorization", "Bearer "+newTokens.AccessToken)
	logoutBody, _ := json.Marshal(model.LogoutRequest{RefreshToken: newTokens.RefreshToken})
	logoutReq.Body = http.NoBody
	// Actually set the body
	logoutReq, _ = http.NewRequest(http.MethodPost, srv.URL+"/api/v1/auth/logout",
		bytes.NewBuffer(logoutBody))
	logoutReq.Header.Set("Authorization", "Bearer "+newTokens.AccessToken)
	logoutReq.Header.Set("Content-Type", "application/json")
	logoutResp, err := http.DefaultClient.Do(logoutReq)
	require.NoError(t, err)
	defer logoutResp.Body.Close()
	assert.Equal(t, http.StatusOK, logoutResp.StatusCode)

	// Step 6: Using the revoked refresh token should fail
	failRefresh := doPost(t, srv, "/api/v1/auth/refresh", model.RefreshTokenRequest{
		RefreshToken: newTokens.RefreshToken,
	})
	assert.Equal(t, http.StatusUnauthorized, failRefresh.StatusCode)
}

func TestHandler_ForgotPassword(t *testing.T) {
	srv, _ := setupAuthRouter(t)

	t.Run("always returns success", func(t *testing.T) {
		resp := doPost(t, srv, "/api/v1/auth/forgot-password", model.ForgotPasswordRequest{
			Email: "anyone@anywhere.com",
		})
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestHandler_Unauthenticated(t *testing.T) {
	srv, _ := setupAuthRouter(t)

	t.Run("me without token returns 401", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/me", nil)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("change password without token returns 401", func(t *testing.T) {
		body, _ := json.Marshal(model.ChangePasswordRequest{
			CurrentPassword: "old",
			NewPassword:     "newpass123",
		})
		req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/v1/auth/change-password",
			bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

// -- Helpers --

func doPost(t *testing.T, srv *httptest.Server, path string, body any) *http.Response {
	t.Helper()
	jsonBody, err := json.Marshal(body)
	require.NoError(t, err)

	resp, err := http.Post(srv.URL+path, "application/json", bytes.NewBuffer(jsonBody))
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func decodeJSON(t *testing.T, resp *http.Response, target any) {
	t.Helper()
	err := json.NewDecoder(resp.Body).Decode(target)
	require.NoError(t, err)
}
