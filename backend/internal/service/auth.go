package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"pos/internal/config"
	"pos/internal/database/sqlc"
	"pos/internal/model"
)

type AuthService struct {
	pool     *pgxpool.Pool
	queries  *sqlc.Queries
	token    *TokenService
	cfg      *config.Config
	enqueuer JobEnqueuer
}

// JobEnqueuer is an interface for enqueuing background jobs.
// Implemented by the worker package to avoid circular imports.
type JobEnqueuer interface {
	EnqueueEmailVerification(ctx context.Context, userID uuid.UUID, email, token string) error
	EnqueuePasswordReset(ctx context.Context, userID uuid.UUID, email, token string) error
	EnqueueInvitationEmail(ctx context.Context, email, token, tenantName string) error
}

func NewAuthService(pool *pgxpool.Pool, queries *sqlc.Queries, token *TokenService, cfg *config.Config, enqueuer JobEnqueuer) *AuthService {
	return &AuthService{
		pool:     pool,
		queries:  queries,
		token:    token,
		cfg:      cfg,
		enqueuer: enqueuer,
	}
}

// Register creates a new tenant, user, store, and default admin role.
func (s *AuthService) Register(ctx context.Context, req model.RegisterRequest) (*model.RegisterResponse, error) {
	// Hash password
	passwordHash, err := s.hashPassword(req.Password)
	if err != nil {
		return nil, model.InternalError("failed to hash password", err)
	}

	// Generate slug from tenant name
	slug := generateSlug(req.TenantName)

	var user sqlc.User
	var store sqlc.Store

	// Run registration in a transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// 1. Create tenant
	tenant, err := qtx.CreateTenant(ctx, sqlc.CreateTenantParams{
		Name: req.TenantName,
		Slug: slug,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a tenant with a similar name already exists")
		}
		return nil, model.InternalError("failed to create tenant", err)
	}

	// 2. Create user
	user, err = qtx.CreateUser(ctx, sqlc.CreateUserParams{
		TenantID:     tenant.ID,
		Email:        strings.ToLower(req.Email),
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a user with this email already exists")
		}
		return nil, model.InternalError("failed to create user", err)
	}

	// 3. Create first store
	store, err = qtx.CreateStore(ctx, sqlc.CreateStoreParams{
		TenantID: tenant.ID,
		Name:     req.StoreName,
		Address:  pgtype.Text{String: req.StoreAddress, Valid: req.StoreAddress != ""},
	})
	if err != nil {
		return nil, model.InternalError("failed to create store", err)
	}

	// 4. Create default Administrator role
	adminRole, err := qtx.CreateRole(ctx, sqlc.CreateRoleParams{
		TenantID:        tenant.ID,
		Name:            "Administrator",
		Description:     pgtype.Text{String: "Full system access", Valid: true},
		IsSystemDefault: true,
	})
	if err != nil {
		return nil, model.InternalError("failed to create admin role", err)
	}

	// 5. Grant all permissions on all features
	features, err := qtx.ListFeatures(ctx)
	if err != nil {
		return nil, model.InternalError("failed to list features", err)
	}

	for _, f := range features {
		if len(f.Actions) == 0 {
			continue // Skip parent features with no actions
		}
		_, err := qtx.SetRolePermission(ctx, sqlc.SetRolePermissionParams{
			RoleID:    adminRole.ID,
			FeatureID: f.ID,
			Actions:   f.Actions,
		})
		if err != nil {
			return nil, model.InternalError("failed to set role permission", err)
		}
	}

	// 6. Assign user to Administrator role
	_, err = qtx.AssignUserRole(ctx, sqlc.AssignUserRoleParams{
		UserID: user.ID,
		RoleID: adminRole.ID,
	})
	if err != nil {
		return nil, model.InternalError("failed to assign admin role", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit registration", err)
	}

	// Enqueue email verification (after commit, non-blocking)
	plainToken, tokenHash, err := GenerateRandomToken()
	if err != nil {
		slog.Error("failed to generate verification token", "error", err)
	} else {
		_, err = s.queries.CreateEmailVerification(ctx, sqlc.CreateEmailVerificationParams{
			UserID:    user.ID,
			TokenHash: tokenHash,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(24 * time.Hour), Valid: true},
		})
		if err != nil {
			slog.Error("failed to create email verification", "error", err)
		} else if s.enqueuer != nil {
			if err := s.enqueuer.EnqueueEmailVerification(ctx, user.ID, user.Email, plainToken); err != nil {
				slog.Error("failed to enqueue email verification", "error", err)
			}
		}
	}

	// Generate JWT tokens
	accessToken, err := s.token.GenerateAccessToken(user.ID, tenant.ID, user.Email)
	if err != nil {
		return nil, model.InternalError("failed to generate access token", err)
	}

	refreshPlain, refreshHash, err := GenerateRandomToken()
	if err != nil {
		return nil, model.InternalError("failed to generate refresh token", err)
	}

	_, err = s.queries.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(s.cfg.JWT.RefreshTTL), Valid: true},
	})
	if err != nil {
		return nil, model.InternalError("failed to store refresh token", err)
	}

	_ = store // Store was created as part of registration

	return &model.RegisterResponse{
		User:   toUserResponse(user),
		Tokens: model.AuthTokens{AccessToken: accessToken, RefreshToken: refreshPlain},
	}, nil
}

// Login validates credentials and returns JWT tokens.
func (s *AuthService) Login(ctx context.Context, req model.LoginRequest) (*model.LoginResponse, error) {
	user, err := s.queries.GetUserByEmail(ctx, strings.ToLower(req.Email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.UnauthorizedError("invalid email or password")
		}
		return nil, model.InternalError("failed to find user", err)
	}

	if !user.IsActive {
		return nil, model.UnauthorizedError("account is deactivated")
	}

	match, err := argon2id.ComparePasswordAndHash(req.Password, user.PasswordHash)
	if err != nil {
		return nil, model.InternalError("failed to verify password", err)
	}
	if !match {
		return nil, model.UnauthorizedError("invalid email or password")
	}

	accessToken, err := s.token.GenerateAccessToken(user.ID, user.TenantID, user.Email)
	if err != nil {
		return nil, model.InternalError("failed to generate access token", err)
	}

	refreshPlain, refreshHash, err := GenerateRandomToken()
	if err != nil {
		return nil, model.InternalError("failed to generate refresh token", err)
	}

	_, err = s.queries.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(s.cfg.JWT.RefreshTTL), Valid: true},
	})
	if err != nil {
		return nil, model.InternalError("failed to store refresh token", err)
	}

	return &model.LoginResponse{
		User:   toUserResponse(user),
		Tokens: model.AuthTokens{AccessToken: accessToken, RefreshToken: refreshPlain},
	}, nil
}

// VerifyEmail consumes a verification token and marks the user's email as verified.
func (s *AuthService) VerifyEmail(ctx context.Context, req model.VerifyEmailRequest) error {
	tokenHash := HashToken(req.Token)

	verification, err := s.queries.GetEmailVerificationByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.UnauthorizedError("invalid or expired verification token")
		}
		return model.InternalError("failed to find verification", err)
	}

	if verification.IsUsed {
		return model.UnauthorizedError("verification token already used")
	}

	if verification.ExpiresAt.Valid && verification.ExpiresAt.Time.Before(time.Now()) {
		return model.UnauthorizedError("verification token has expired")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.MarkEmailVerificationUsed(ctx, verification.ID); err != nil {
		return model.InternalError("failed to mark verification used", err)
	}

	if err := qtx.UpdateUserEmailVerified(ctx, sqlc.UpdateUserEmailVerifiedParams{
		IsEmailVerified: true,
		ID:              verification.UserID,
	}); err != nil {
		return model.InternalError("failed to update email verified status", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return model.InternalError("failed to commit email verification", err)
	}

	return nil
}

// ForgotPassword always returns success to prevent email enumeration.
func (s *AuthService) ForgotPassword(ctx context.Context, req model.ForgotPasswordRequest) error {
	user, err := s.queries.GetUserByEmail(ctx, strings.ToLower(req.Email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // Always return success
		}
		return model.InternalError("failed to find user", err)
	}

	plainToken, tokenHash, err := GenerateRandomToken()
	if err != nil {
		return model.InternalError("failed to generate reset token", err)
	}

	_, err = s.queries.CreatePasswordReset(ctx, sqlc.CreatePasswordResetParams{
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(1 * time.Hour), Valid: true},
	})
	if err != nil {
		return model.InternalError("failed to create password reset", err)
	}

	if s.enqueuer != nil {
		if err := s.enqueuer.EnqueuePasswordReset(ctx, user.ID, user.Email, plainToken); err != nil {
			slog.Error("failed to enqueue password reset email", "error", err)
		}
	}

	return nil
}

// ResetPassword validates the reset token and updates the password.
func (s *AuthService) ResetPassword(ctx context.Context, req model.ResetPasswordRequest) error {
	tokenHash := HashToken(req.Token)

	reset, err := s.queries.GetPasswordResetByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.UnauthorizedError("invalid or expired reset token")
		}
		return model.InternalError("failed to find reset token", err)
	}

	if reset.IsUsed {
		return model.UnauthorizedError("reset token already used")
	}

	if reset.ExpiresAt.Valid && reset.ExpiresAt.Time.Before(time.Now()) {
		return model.UnauthorizedError("reset token has expired")
	}

	passwordHash, err := s.hashPassword(req.Password)
	if err != nil {
		return model.InternalError("failed to hash password", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.UpdateUserPassword(ctx, sqlc.UpdateUserPasswordParams{
		PasswordHash: passwordHash,
		ID:           reset.UserID,
	}); err != nil {
		return model.InternalError("failed to update password", err)
	}

	if err := qtx.MarkPasswordResetUsed(ctx, reset.ID); err != nil {
		return model.InternalError("failed to mark reset used", err)
	}

	// Revoke all refresh tokens for security
	if err := qtx.RevokeAllUserRefreshTokens(ctx, reset.UserID); err != nil {
		return model.InternalError("failed to revoke refresh tokens", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return model.InternalError("failed to commit password reset", err)
	}

	return nil
}

// RefreshToken performs refresh token rotation.
func (s *AuthService) RefreshToken(ctx context.Context, req model.RefreshTokenRequest) (*model.AuthTokens, error) {
	tokenHash := HashToken(req.RefreshToken)

	storedToken, err := s.queries.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.UnauthorizedError("invalid refresh token")
		}
		return nil, model.InternalError("failed to find refresh token", err)
	}

	// Reuse detection: if token is already revoked, revoke ALL user tokens
	if storedToken.Revoked {
		slog.Warn("refresh token reuse detected", "user_id", storedToken.UserID)
		if err := s.queries.RevokeAllUserRefreshTokens(ctx, storedToken.UserID); err != nil {
			slog.Error("failed to revoke all user refresh tokens", "error", err)
		}
		return nil, model.UnauthorizedError("refresh token has been revoked")
	}

	if storedToken.ExpiresAt.Valid && storedToken.ExpiresAt.Time.Before(time.Now()) {
		return nil, model.UnauthorizedError("refresh token has expired")
	}

	// Revoke old token
	if err := s.queries.RevokeRefreshToken(ctx, storedToken.ID); err != nil {
		return nil, model.InternalError("failed to revoke old refresh token", err)
	}

	// Get user for JWT claims
	user, err := s.queries.GetUserByID(ctx, storedToken.UserID)
	if err != nil {
		return nil, model.InternalError("failed to find user", err)
	}

	if !user.IsActive {
		return nil, model.UnauthorizedError("account is deactivated")
	}

	// Generate new tokens
	accessToken, err := s.token.GenerateAccessToken(user.ID, user.TenantID, user.Email)
	if err != nil {
		return nil, model.InternalError("failed to generate access token", err)
	}

	newRefreshPlain, newRefreshHash, err := GenerateRandomToken()
	if err != nil {
		return nil, model.InternalError("failed to generate refresh token", err)
	}

	_, err = s.queries.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: newRefreshHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(s.cfg.JWT.RefreshTTL), Valid: true},
	})
	if err != nil {
		return nil, model.InternalError("failed to store refresh token", err)
	}

	return &model.AuthTokens{
		AccessToken:  accessToken,
		RefreshToken: newRefreshPlain,
	}, nil
}

// AcceptInvitation creates a user from an invitation token.
func (s *AuthService) AcceptInvitation(ctx context.Context, req model.AcceptInvitationRequest) (*model.LoginResponse, error) {
	tokenHash := HashToken(req.Token)

	invitation, err := s.queries.GetInvitationByTokenHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.UnauthorizedError("invalid invitation token")
		}
		return nil, model.InternalError("failed to find invitation", err)
	}

	if invitation.Status != "pending" {
		return nil, model.UnauthorizedError("invitation is no longer valid")
	}

	if invitation.ExpiresAt.Valid && invitation.ExpiresAt.Time.Before(time.Now()) {
		return nil, model.UnauthorizedError("invitation has expired")
	}

	passwordHash, err := s.hashPassword(req.Password)
	if err != nil {
		return nil, model.InternalError("failed to hash password", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, model.InternalError("failed to begin transaction", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// Create user with auto-verified email
	user, err := qtx.CreateUser(ctx, sqlc.CreateUserParams{
		TenantID:     invitation.TenantID,
		Email:        strings.ToLower(invitation.Email),
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, model.ConflictError("a user with this email already exists")
		}
		return nil, model.InternalError("failed to create user", err)
	}

	// Auto-verify email
	if err := qtx.UpdateUserEmailVerified(ctx, sqlc.UpdateUserEmailVerifiedParams{
		IsEmailVerified: true,
		ID:              user.ID,
	}); err != nil {
		return nil, model.InternalError("failed to verify email", err)
	}

	// Assign role
	_, err = qtx.AssignUserRole(ctx, sqlc.AssignUserRoleParams{
		UserID:     user.ID,
		RoleID:     invitation.RoleID,
		AssignedBy: pgtype.UUID{Bytes: invitation.InvitedBy, Valid: true},
	})
	if err != nil {
		return nil, model.InternalError("failed to assign role", err)
	}

	// Assign stores from invitation
	for _, storeID := range invitation.StoreIds {
		_, err = qtx.AssignUserStore(ctx, sqlc.AssignUserStoreParams{
			UserID:     user.ID,
			StoreID:    storeID,
			AssignedBy: pgtype.UUID{Bytes: invitation.InvitedBy, Valid: true},
		})
		if err != nil {
			return nil, model.InternalError("failed to assign store", err)
		}
	}

	// Mark invitation as accepted
	if err := qtx.UpdateInvitationStatus(ctx, sqlc.UpdateInvitationStatusParams{
		Status: "accepted",
		ID:     invitation.ID,
	}); err != nil {
		return nil, model.InternalError("failed to update invitation status", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, model.InternalError("failed to commit invitation acceptance", err)
	}

	// Generate tokens
	accessToken, err := s.token.GenerateAccessToken(user.ID, invitation.TenantID, user.Email)
	if err != nil {
		return nil, model.InternalError("failed to generate access token", err)
	}

	refreshPlain, refreshHash, err := GenerateRandomToken()
	if err != nil {
		return nil, model.InternalError("failed to generate refresh token", err)
	}

	_, err = s.queries.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(s.cfg.JWT.RefreshTTL), Valid: true},
	})
	if err != nil {
		return nil, model.InternalError("failed to store refresh token", err)
	}

	return &model.LoginResponse{
		User:   toUserResponse(user),
		Tokens: model.AuthTokens{AccessToken: accessToken, RefreshToken: refreshPlain},
	}, nil
}

// Logout revokes the given refresh token.
func (s *AuthService) Logout(ctx context.Context, req model.LogoutRequest) error {
	tokenHash := HashToken(req.RefreshToken)

	storedToken, err := s.queries.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // Already logged out or invalid — no error
		}
		return model.InternalError("failed to find refresh token", err)
	}

	if err := s.queries.RevokeRefreshToken(ctx, storedToken.ID); err != nil {
		return model.InternalError("failed to revoke refresh token", err)
	}

	return nil
}

// ChangePassword verifies the current password and updates to the new one.
func (s *AuthService) ChangePassword(ctx context.Context, userID uuid.UUID, req model.ChangePasswordRequest) error {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return model.InternalError("failed to find user", err)
	}

	match, err := argon2id.ComparePasswordAndHash(req.CurrentPassword, user.PasswordHash)
	if err != nil {
		return model.InternalError("failed to verify password", err)
	}
	if !match {
		return model.UnauthorizedError("current password is incorrect")
	}

	newHash, err := s.hashPassword(req.NewPassword)
	if err != nil {
		return model.InternalError("failed to hash password", err)
	}

	if err := s.queries.UpdateUserPassword(ctx, sqlc.UpdateUserPasswordParams{
		PasswordHash: newHash,
		ID:           userID,
	}); err != nil {
		return model.InternalError("failed to update password", err)
	}

	return nil
}

// GetMe returns the user profile, roles, permissions, and accessible stores.
func (s *AuthService) GetMe(ctx context.Context, userID uuid.UUID) (*model.MeResponse, error) {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, model.InternalError("failed to find user", err)
	}

	// Get roles
	roles, err := s.queries.GetUserRoles(ctx, userID)
	if err != nil {
		return nil, model.InternalError("failed to get user roles", err)
	}

	// Check if user has system default role (admin)
	hasDefault, err := s.queries.HasSystemDefaultRole(ctx, userID)
	if err != nil {
		return nil, model.InternalError("failed to check admin role", err)
	}

	// Load permissions
	permRows, err := s.queries.LoadUserPermissions(ctx, userID)
	if err != nil {
		return nil, model.InternalError("failed to load permissions", err)
	}

	permissions := make(map[string][]string)
	for _, p := range permRows {
		permissions[p.FeatureSlug] = p.Actions
	}

	// Get accessible stores
	var stores []sqlc.Store
	if hasDefault {
		stores, err = s.queries.GetStoresByTenant(ctx, user.TenantID)
	} else {
		stores, err = s.queries.GetUserStores(ctx, userID)
	}
	if err != nil {
		return nil, model.InternalError("failed to get stores", err)
	}

	return &model.MeResponse{
		UserResponse: toUserResponse(user),
		Roles:        toRoleResponses(roles),
		Permissions:  permissions,
		Stores:       toStoreResponses(stores),
		AllStores:    hasDefault,
	}, nil
}

func (s *AuthService) hashPassword(password string) (string, error) {
	params := &argon2id.Params{
		Memory:      s.cfg.Argon2.Memory,
		Iterations:  s.cfg.Argon2.Iterations,
		Parallelism: s.cfg.Argon2.Parallelism,
		SaltLength:  s.cfg.Argon2.SaltLength,
		KeyLength:   s.cfg.Argon2.KeyLength,
	}
	hash, err := argon2id.CreateHash(password, params)
	if err != nil {
		return "", fmt.Errorf("argon2id hash: %w", err)
	}
	return hash, nil
}

func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.ReplaceAll(slug, " ", "-")
	// Remove non-alphanumeric characters (except hyphens)
	var result strings.Builder
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result.WriteRune(r)
		}
	}
	return result.String()
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
