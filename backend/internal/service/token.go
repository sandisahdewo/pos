package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"pos/internal/config"
	"pos/internal/middleware"
)

type TokenService struct {
	cfg *config.JWTConfig
}

func NewTokenService(cfg *config.JWTConfig) *TokenService {
	return &TokenService{cfg: cfg}
}

// GenerateAccessToken creates a signed JWT access token.
func (s *TokenService) GenerateAccessToken(userID, tenantID uuid.UUID, email string) (string, error) {
	now := time.Now()
	claims := middleware.Claims{
		UserID:   userID,
		TenantID: tenantID,
		Email:    email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.AccessTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.Secret))
	if err != nil {
		return "", fmt.Errorf("signing access token: %w", err)
	}

	return signed, nil
}

// GenerateRandomToken creates a cryptographically random token (hex-encoded, 64 chars).
func GenerateRandomToken() (plainToken string, tokenHash string, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", fmt.Errorf("generating random bytes: %w", err)
	}

	plainToken = hex.EncodeToString(bytes)
	tokenHash = HashToken(plainToken)

	return plainToken, tokenHash, nil
}

// HashToken creates a SHA-256 hash of a plain token for storage.
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
