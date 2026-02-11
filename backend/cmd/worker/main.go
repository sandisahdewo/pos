package main

import (
	"log/slog"
	"os"

	"github.com/hibiken/asynq"

	"pos/internal/config"
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

	// Initialize services
	emailService := service.NewEmailService(cfg)

	// Initialize task handlers
	handlers := worker.NewTaskHandlers(emailService)

	// Create Asynq server
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.Redis.Addr()},
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)

	// Register handlers
	mux := asynq.NewServeMux()
	mux.HandleFunc(worker.TypeEmailVerification, handlers.HandleEmailVerification)
	mux.HandleFunc(worker.TypePasswordReset, handlers.HandlePasswordReset)
	mux.HandleFunc(worker.TypeInvitationEmail, handlers.HandleInvitationEmail)

	slog.Info("starting worker", "redis", cfg.Redis.Addr())
	if err := srv.Run(mux); err != nil {
		slog.Error("worker failed", "error", err)
		os.Exit(1)
	}
}
