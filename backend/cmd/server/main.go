package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/sandisahdewo/pos/backend/internal/config"
	"github.com/sandisahdewo/pos/backend/internal/db"
	"github.com/sandisahdewo/pos/backend/internal/handlers"
	"github.com/sandisahdewo/pos/backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	bundb, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer bundb.Close()

	issuer := auth.NewIssuer(cfg.JWTSecret, cfg.JWTTokenTTL)

	router := server.NewRouter(server.Options{
		Deps: handlers.Deps{
			DB:         bundb,
			Issuer:     issuer,
			BcryptCost: cfg.BcryptCost,
		},
		Issuer:          issuer,
		CORSAllowOrigin: cfg.CORSAllowOrigin,
	})

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown: SIGINT/SIGTERM stops new connections and lets
	// in-flight requests finish (up to 15s).
	go func() {
		log.Printf("listening on %s", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
}
