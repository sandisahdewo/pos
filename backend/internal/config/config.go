package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	JWTSecret       []byte
	JWTTokenTTL     time.Duration
	BcryptCost      int
	CORSAllowOrigin string
}

func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	return &Config{
		HTTPAddr:        envOr("HTTP_ADDR", ":8080"),
		DatabaseURL:     dbURL,
		JWTSecret:       []byte(jwtSecret),
		JWTTokenTTL:     envDuration("JWT_TOKEN_TTL", 24*time.Hour),
		BcryptCost:      envInt("BCRYPT_COST", 12),
		CORSAllowOrigin: envOr("CORS_ALLOW_ORIGIN", "http://localhost:5173"),
	}, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
