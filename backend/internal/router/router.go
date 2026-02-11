package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"pos/internal/config"
	"pos/internal/database/sqlc"
	"pos/internal/handler"
	"pos/internal/middleware"
)

type Handlers struct {
	Auth       *handler.AuthHandler
	Store      *handler.StoreHandler
	Role       *handler.RoleHandler
	Feature    *handler.FeatureHandler
	User       *handler.UserHandler
	Invitation *handler.InvitationHandler
}

func New(cfg *config.Config, queries *sqlc.Queries, h Handlers) chi.Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.CORS(cfg.App.URL))
	r.Use(chimw.Recoverer)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Rate limiter for auth endpoints (10 requests/second, burst of 20)
	authLimiter := middleware.NewRateLimiter(10, 20)

	r.Route("/api/v1", func(r chi.Router) {
		// Public auth routes (rate-limited)
		r.Group(func(r chi.Router) {
			r.Use(authLimiter.Handler)

			r.Post("/auth/register", h.Auth.Register)
			r.Post("/auth/login", h.Auth.Login)
			r.Post("/auth/verify-email", h.Auth.VerifyEmail)
			r.Post("/auth/forgot-password", h.Auth.ForgotPassword)
			r.Post("/auth/reset-password", h.Auth.ResetPassword)
			r.Post("/auth/refresh", h.Auth.RefreshToken)
			r.Post("/auth/accept-invitation", h.Auth.AcceptInvitation)
		})

		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Authenticate(cfg.JWT.Secret))
			r.Use(middleware.LoadPermissions(queries))
			r.Use(middleware.LoadStoreAccess(queries))

			// Auth (authenticated)
			r.Post("/auth/logout", h.Auth.Logout)
			r.Put("/auth/change-password", h.Auth.ChangePassword)

			// Me
			r.Get("/me", h.Auth.GetMe)

			// Features
			r.Get("/features", h.Feature.List)

			// Stores
			r.Get("/stores", h.Store.List)
			r.Post("/stores", h.Store.Create)
			r.Get("/stores/{id}", h.Store.GetByID)
			r.Put("/stores/{id}", h.Store.Update)
			r.Delete("/stores/{id}", h.Store.Delete)

			// Roles
			r.Get("/roles", h.Role.List)
			r.Post("/roles", h.Role.Create)
			r.Get("/roles/{id}", h.Role.GetByID)
			r.Put("/roles/{id}", h.Role.Update)
			r.Delete("/roles/{id}", h.Role.Delete)
			r.Put("/roles/{id}/permissions", h.Role.UpdatePermissions)

			// Users
			r.Get("/users", h.User.List)
			r.Get("/users/{id}", h.User.GetByID)
			r.Put("/users/{id}", h.User.Update)
			r.Delete("/users/{id}", h.User.Delete)
			r.Put("/users/{id}/stores", h.User.UpdateStores)

			// Invitations
			r.Post("/invitations", h.Invitation.Create)
			r.Get("/invitations", h.Invitation.List)
			r.Delete("/invitations/{id}", h.Invitation.Cancel)
		})
	})

	return r
}