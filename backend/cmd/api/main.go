package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hibiken/asynq"

	"pos/internal/config"
	"pos/internal/database"
	"pos/internal/database/sqlc"
	"pos/internal/handler"
	"pos/internal/router"
	"pos/internal/service"
	"pos/internal/worker"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Setup logger
	var logHandler slog.Handler
	if cfg.IsDevelopment() {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	} else {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	slog.SetDefault(slog.New(logHandler))

	// Connect to database
	ctx := context.Background()
	pool, err := database.NewPool(ctx, cfg.DB)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("database connected")

	// Initialize sqlc queries
	queries := sqlc.New(pool)

	// Initialize Asynq client for background job enqueuing
	asynqClient := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.Redis.Addr()})
	defer asynqClient.Close()
	enqueuer := worker.NewEnqueuer(asynqClient)

	// Initialize services
	tokenService := service.NewTokenService(&cfg.JWT)
	authService := service.NewAuthService(pool, queries, tokenService, cfg, enqueuer)
	storeService := service.NewStoreService(queries)
	roleService := service.NewRoleService(pool, queries)
	userService := service.NewUserService(pool, queries)
	invitationService := service.NewInvitationService(queries, enqueuer)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService)
	storeHandler := handler.NewStoreHandler(storeService)
	roleHandler := handler.NewRoleHandler(roleService)
	featureHandler := handler.NewFeatureHandler(roleService)
	userHandler := handler.NewUserHandler(userService)
	invitationHandler := handler.NewInvitationHandler(invitationService)

	// Setup router
	r := router.New(cfg, queries, router.Handlers{
		Auth:       authHandler,
		Store:      storeHandler,
		Role:       roleHandler,
		Feature:    featureHandler,
		User:       userHandler,
		Invitation: invitationHandler,
	})

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.App.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		slog.Info("starting API server", "port", cfg.App.Port, "env", cfg.App.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
