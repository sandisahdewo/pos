package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	App    AppConfig
	DB     DBConfig
	Redis  RedisConfig
	JWT    JWTConfig
	SMTP   SMTPConfig
	Argon2 Argon2Config
}

type AppConfig struct {
	Port string
	Env  string // "development" or "production"
	URL  string
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

func (c DBConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Name, c.SSLMode,
	)
}

type RedisConfig struct {
	Host string
	Port string
}

func (c RedisConfig) Addr() string {
	return c.Host + ":" + c.Port
}

type JWTConfig struct {
	Secret     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

type SMTPConfig struct {
	Host string
	Port int
	From string
}

type Argon2Config struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

func Load() (*Config, error) {
	accessTTL, err := time.ParseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_TTL: %w", err)
	}

	refreshTTL, err := time.ParseDuration(getEnv("JWT_REFRESH_TTL", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_TTL: %w", err)
	}

	smtpPort, err := strconv.Atoi(getEnv("SMTP_PORT", "1025"))
	if err != nil {
		return nil, fmt.Errorf("invalid SMTP_PORT: %w", err)
	}

	return &Config{
		App: AppConfig{
			Port: getEnv("APP_PORT", "8080"),
			Env:  getEnv("APP_ENV", "development"),
			URL:  getEnv("APP_URL", "http://localhost:5173"),
		},
		DB: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "pos_user"),
			Password: getEnv("DB_PASSWORD", "pos_password"),
			Name:     getEnv("DB_NAME", "pos_db"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host: getEnv("REDIS_HOST", "localhost"),
			Port: getEnv("REDIS_PORT", "6379"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", ""),
			AccessTTL:  accessTTL,
			RefreshTTL: refreshTTL,
		},
		SMTP: SMTPConfig{
			Host: getEnv("SMTP_HOST", "localhost"),
			Port: smtpPort,
			From: getEnv("SMTP_FROM", "noreply@pos.local"),
		},
		Argon2: Argon2Config{
			Memory:      getEnvUint32("ARGON2_MEMORY", 65536),
			Iterations:  getEnvUint32("ARGON2_ITERATIONS", 3),
			Parallelism: uint8(getEnvUint32("ARGON2_PARALLELISM", 2)),
			SaltLength:  getEnvUint32("ARGON2_SALT_LENGTH", 16),
			KeyLength:   getEnvUint32("ARGON2_KEY_LENGTH", 32),
		},
	}, nil
}

func (c *Config) IsDevelopment() bool {
	return c.App.Env == "development"
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvUint32(key string, fallback uint32) uint32 {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.ParseUint(val, 10, 32)
	if err != nil {
		return fallback
	}
	return uint32(n)
}
