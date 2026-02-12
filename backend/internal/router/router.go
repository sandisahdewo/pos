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
	Auth           *handler.AuthHandler
	Store          *handler.StoreHandler
	Role           *handler.RoleHandler
	Feature        *handler.FeatureHandler
	User           *handler.UserHandler
	Invitation     *handler.InvitationHandler
	Category       *handler.CategoryHandler
	Unit           *handler.UnitHandler
	Variant        *handler.VariantHandler
	UnitConversion *handler.UnitConversionHandler
	Warehouse      *handler.WarehouseHandler
	Supplier       *handler.SupplierHandler
	Product        *handler.ProductHandler
	Stock          *handler.StockHandler
	Upload         *handler.UploadHandler
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

			// Categories
			r.Route("/categories", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.category", "read")).Get("/", h.Category.List)
				r.With(middleware.RequirePermission("master-data.category", "create")).Post("/", h.Category.Create)
				r.With(middleware.RequirePermission("master-data.category", "read")).Get("/{id}", h.Category.GetByID)
				r.With(middleware.RequirePermission("master-data.category", "edit")).Put("/{id}", h.Category.Update)
				r.With(middleware.RequirePermission("master-data.category", "delete")).Delete("/{id}", h.Category.Delete)
				r.With(middleware.RequirePermission("master-data.category", "edit")).Put("/{id}/units", h.Category.UpdateUnits)
				r.With(middleware.RequirePermission("master-data.category", "edit")).Put("/{id}/variants", h.Category.UpdateVariants)
			})

			// Units
			r.Route("/units", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.unit", "read")).Get("/", h.Unit.List)
				r.With(middleware.RequirePermission("master-data.unit", "create")).Post("/", h.Unit.Create)
				r.With(middleware.RequirePermission("master-data.unit", "read")).Get("/{id}", h.Unit.GetByID)
				r.With(middleware.RequirePermission("master-data.unit", "edit")).Put("/{id}", h.Unit.Update)
				r.With(middleware.RequirePermission("master-data.unit", "delete")).Delete("/{id}", h.Unit.Delete)
			})

			// Variants
			r.Route("/variants", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.variant", "read")).Get("/", h.Variant.List)
				r.With(middleware.RequirePermission("master-data.variant", "create")).Post("/", h.Variant.Create)
				r.With(middleware.RequirePermission("master-data.variant", "read")).Get("/{id}", h.Variant.GetByID)
				r.With(middleware.RequirePermission("master-data.variant", "edit")).Put("/{id}", h.Variant.Update)
				r.With(middleware.RequirePermission("master-data.variant", "delete")).Delete("/{id}", h.Variant.Delete)
				r.With(middleware.RequirePermission("master-data.variant", "edit")).Post("/{id}/values", h.Variant.AddValue)
				r.With(middleware.RequirePermission("master-data.variant", "edit")).Put("/{id}/values/{valueId}", h.Variant.UpdateValue)
				r.With(middleware.RequirePermission("master-data.variant", "edit")).Delete("/{id}/values/{valueId}", h.Variant.DeleteValue)
			})

			// Unit conversions
			r.Route("/unit-conversions", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.unit", "read")).Get("/", h.UnitConversion.List)
				r.With(middleware.RequirePermission("master-data.unit", "create")).Post("/", h.UnitConversion.Create)
				r.With(middleware.RequirePermission("master-data.unit", "read")).Get("/{id}", h.UnitConversion.GetByID)
				r.With(middleware.RequirePermission("master-data.unit", "edit")).Put("/{id}", h.UnitConversion.Update)
				r.With(middleware.RequirePermission("master-data.unit", "delete")).Delete("/{id}", h.UnitConversion.Delete)
			})

			// Warehouses
			r.Route("/warehouses", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.warehouse", "read")).Get("/", h.Warehouse.List)
				r.With(middleware.RequirePermission("master-data.warehouse", "create")).Post("/", h.Warehouse.Create)
				r.With(middleware.RequirePermission("master-data.warehouse", "read")).Get("/{id}", h.Warehouse.GetByID)
				r.With(middleware.RequirePermission("master-data.warehouse", "edit")).Put("/{id}", h.Warehouse.Update)
				r.With(middleware.RequirePermission("master-data.warehouse", "delete")).Delete("/{id}", h.Warehouse.Delete)
			})

			// Suppliers
			r.Route("/suppliers", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.supplier", "read")).Get("/", h.Supplier.List)
				r.With(middleware.RequirePermission("master-data.supplier", "create")).Post("/", h.Supplier.Create)
				r.With(middleware.RequirePermission("master-data.supplier", "read")).Get("/{id}", h.Supplier.GetByID)
				r.With(middleware.RequirePermission("master-data.supplier", "edit")).Put("/{id}", h.Supplier.Update)
				r.With(middleware.RequirePermission("master-data.supplier", "delete")).Delete("/{id}", h.Supplier.Delete)
			})

			// Products
			r.Route("/products", func(r chi.Router) {
				r.With(middleware.RequirePermission("master-data.product", "read")).Get("/", h.Product.List)
				r.With(middleware.RequirePermission("master-data.product", "create")).Post("/", h.Product.Create)
				r.With(middleware.RequirePermission("master-data.product", "read")).Get("/{id}", h.Product.GetByID)
				r.With(middleware.RequirePermission("master-data.product", "edit")).Put("/{id}", h.Product.Update)
				r.With(middleware.RequirePermission("master-data.product", "delete")).Delete("/{id}", h.Product.Deactivate)
				r.With(middleware.RequirePermission("master-data.product", "read")).Get("/{id}/stock", h.Stock.GetByProduct)
			})

			// Uploads
			r.Post("/uploads/images", h.Upload.UploadImage)
		})
	})

	return r
}