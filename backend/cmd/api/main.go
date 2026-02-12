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
	categoryService := service.NewCategoryService(pool, queries)
	unitService := service.NewUnitService(queries)
	variantService := service.NewVariantService(pool, queries)
	unitConversionService := service.NewUnitConversionService(queries)
	warehouseService := service.NewWarehouseService(queries)
	supplierService := service.NewSupplierService(queries)
	productService := service.NewProductService(pool, queries)
	stockService := service.NewStockService(queries)

	// Initialize S3/MinIO upload service
	uploadService, err := service.NewUploadService(
		cfg.S3.Endpoint,
		cfg.S3.AccessKey,
		cfg.S3.SecretKey,
		cfg.S3.Bucket,
		cfg.S3.Region,
		cfg.S3.UseSSL,
	)
	if err != nil {
		slog.Warn("failed to initialize S3 upload service, image uploads will be unavailable", "error", err)
	} else {
		if err := uploadService.InitBucket(ctx); err != nil {
			slog.Warn("failed to initialize S3 bucket", "error", err)
		} else {
			slog.Info("S3 upload service initialized", "bucket", cfg.S3.Bucket)
		}
	}

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService)
	storeHandler := handler.NewStoreHandler(storeService)
	roleHandler := handler.NewRoleHandler(roleService)
	featureHandler := handler.NewFeatureHandler(roleService)
	userHandler := handler.NewUserHandler(userService)
	invitationHandler := handler.NewInvitationHandler(invitationService)
	categoryHandler := handler.NewCategoryHandler(categoryService)
	unitHandler := handler.NewUnitHandler(unitService)
	variantHandler := handler.NewVariantHandler(variantService)
	unitConversionHandler := handler.NewUnitConversionHandler(unitConversionService)
	warehouseHandler := handler.NewWarehouseHandler(warehouseService)
	supplierHandler := handler.NewSupplierHandler(supplierService)
	productHandler := handler.NewProductHandler(productService)
	stockHandler := handler.NewStockHandler(stockService)
	uploadHandler := handler.NewUploadHandler(uploadService)

	// Setup router
	r := router.New(cfg, queries, router.Handlers{
		Auth:           authHandler,
		Store:          storeHandler,
		Role:           roleHandler,
		Feature:        featureHandler,
		User:           userHandler,
		Invitation:     invitationHandler,
		Category:       categoryHandler,
		Unit:           unitHandler,
		Variant:        variantHandler,
		UnitConversion: unitConversionHandler,
		Warehouse:      warehouseHandler,
		Supplier:       supplierHandler,
		Product:        productHandler,
		Stock:          stockHandler,
		Upload:         uploadHandler,
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
