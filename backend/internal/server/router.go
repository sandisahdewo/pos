package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/sandisahdewo/pos/backend/internal/auth"
	"github.com/sandisahdewo/pos/backend/internal/handlers"
	"github.com/sandisahdewo/pos/backend/internal/middleware"
)

type Options struct {
	Deps            handlers.Deps
	Issuer          *auth.Issuer
	CORSAllowOrigin string
}

func NewRouter(opts Options) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{opts.CORSAllowOrigin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authH := handlers.NewAuthHandler(opts.Deps)
	unitsH := handlers.NewUnitsHandler(opts.Deps)
	usersH := handlers.NewUsersHandler(opts.Deps)
	rolesH := handlers.NewRolesHandler(opts.Deps)

	r.Get("/healthz", healthz)

	r.Route("/api", func(api chi.Router) {
		// Public
		api.Post("/auth/login", authH.Login)

		// Authenticated
		api.Group(func(p chi.Router) {
			p.Use(middleware.RequireAuth(opts.Issuer))

			p.Get("/auth/me", authH.Me)

			p.Route("/units", func(u chi.Router) {
				u.Get("/", unitsH.List)
				u.Post("/", unitsH.Create)
				u.Get("/{id}", unitsH.Get)
				u.Patch("/{id}", unitsH.Update)
				u.Delete("/{id}", unitsH.Delete)
			})

			// Admin-only: user (employee) + role management.
			p.Group(func(adm chi.Router) {
				adm.Use(middleware.RequireRole("Admin"))

				adm.Route("/users", func(u chi.Router) {
					u.Get("/", usersH.List)
					u.Post("/", usersH.Create)
					u.Get("/{id}", usersH.Get)
					u.Patch("/{id}", usersH.Update)
					u.Delete("/{id}", usersH.Delete)
				})

				adm.Route("/roles", func(ro chi.Router) {
					ro.Get("/", rolesH.List)
					ro.Post("/", rolesH.Create)
					ro.Get("/{id}", rolesH.Get)
					ro.Patch("/{id}", rolesH.Update)
					ro.Delete("/{id}", rolesH.Delete)
				})
			})
		})
	})

	return r
}

func healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
