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
	suppliersH := handlers.NewSuppliersHandler(opts.Deps)
	taxRatesH := handlers.NewTaxRatesHandler(opts.Deps)
	categoriesH := handlers.NewCategoriesHandler(opts.Deps)
	brandsH := handlers.NewBrandsHandler(opts.Deps)
	tagsH := handlers.NewTagsHandler(opts.Deps)
	locationsH := handlers.NewLocationsHandler(opts.Deps)
	productsH := handlers.NewProductsHandler(opts.Deps)
	purchaseOrdersH := handlers.NewPurchaseOrdersHandler(opts.Deps)
	shiftTemplatesH := handlers.NewShiftTemplatesHandler(opts.Deps)
	shiftAssignmentsH := handlers.NewShiftAssignmentsHandler(opts.Deps)
	shiftsH := handlers.NewShiftsHandler(opts.Deps)
	pricelistsH := handlers.NewPricelistsHandler(opts.Deps)
	customersH := handlers.NewCustomersHandler(opts.Deps)
	ordersH := handlers.NewOrdersHandler(opts.Deps)
	batchesH := handlers.NewBatchesHandler(opts.Deps)
	stockMovementsH := handlers.NewStockMovementsHandler(opts.Deps)

	r.Get("/healthz", healthz)

	r.Route("/api", func(api chi.Router) {
		// Public
		api.Post("/auth/login", authH.Login)

		// Authenticated
		api.Group(func(p chi.Router) {
			p.Use(middleware.RequireAuth(opts.Issuer))

			p.Get("/auth/me", authH.Me)

			// Reads available to any authed user (POS/products need them);
			// writes gated to Admin below.
			p.Get("/units", unitsH.List)
			p.Get("/units/{id}", unitsH.Get)
			p.Get("/suppliers", suppliersH.List)
			p.Get("/suppliers/{id}", suppliersH.Get)
			p.Get("/tax-rates", taxRatesH.List)
			p.Get("/categories", categoriesH.List)
			p.Get("/categories/{id}", categoriesH.Get)
			p.Get("/brands", brandsH.List)
			p.Get("/brands/{id}", brandsH.Get)
			p.Get("/tags", tagsH.List)
			p.Get("/locations", locationsH.List)
			p.Get("/locations/{id}", locationsH.Get)
			p.Get("/products", productsH.List)
			p.Get("/products/{id}", productsH.Get)
			p.Get("/purchase-orders", purchaseOrdersH.List)
			p.Get("/purchase-orders/{id}", purchaseOrdersH.Get)

			// Shifts (operational): kasir needs to open/close + add cash entries.
			p.Get("/shift-templates", shiftTemplatesH.List)
			p.Get("/shift-assignments", shiftAssignmentsH.List)
			p.Get("/shifts", shiftsH.List)
			p.Get("/shifts/{id}", shiftsH.Get)
			p.Post("/shifts", shiftsH.Create)
			p.Patch("/shifts/{id}", shiftsH.Update)

			// Kasir: pricelists, customers, orders.
			p.Get("/pricelists", pricelistsH.List)
			p.Get("/customers", customersH.List)
			p.Get("/customers/{id}", customersH.Get)
			p.Get("/orders", ordersH.List)
			p.Get("/orders/{id}", ordersH.Get)
			p.Post("/orders", ordersH.Create)
			p.Patch("/orders/{id}", ordersH.Update)
			p.Post("/customers", customersH.Create)
			p.Patch("/customers/{id}", customersH.Update)
			p.Delete("/customers/{id}", customersH.Delete)

			// Stock: batches + movements. Reads + writes authed (kasir,
			// PO receive, opname, production all need to mutate).
			p.Get("/batches", batchesH.List)
			p.Get("/batches/{id}", batchesH.Get)
			p.Post("/batches", batchesH.Create)
			p.Patch("/batches/{id}", batchesH.Update)
			p.Get("/stock-movements", stockMovementsH.List)
			p.Post("/stock-movements", stockMovementsH.Create)

			// Admin-only: user (employee) + role management + master data writes.
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

				adm.Post("/suppliers", suppliersH.Create)
				adm.Patch("/suppliers/{id}", suppliersH.Update)
				adm.Delete("/suppliers/{id}", suppliersH.Delete)

				adm.Post("/tax-rates", taxRatesH.Create)
				adm.Patch("/tax-rates/{id}", taxRatesH.Update)
				adm.Delete("/tax-rates/{id}", taxRatesH.Delete)

				adm.Post("/categories", categoriesH.Create)
				adm.Patch("/categories/{id}", categoriesH.Update)
				adm.Delete("/categories/{id}", categoriesH.Delete)

				adm.Post("/units", unitsH.Create)
				adm.Patch("/units/{id}", unitsH.Update)
				adm.Delete("/units/{id}", unitsH.Delete)

				adm.Post("/brands", brandsH.Create)
				adm.Patch("/brands/{id}", brandsH.Update)
				adm.Delete("/brands/{id}", brandsH.Delete)

				adm.Post("/tags", tagsH.Create)
				adm.Patch("/tags/{id}", tagsH.Update)
				adm.Delete("/tags/{id}", tagsH.Delete)

				adm.Post("/locations", locationsH.Create)
				adm.Patch("/locations/{id}", locationsH.Update)
				adm.Delete("/locations/{id}", locationsH.Delete)

				adm.Post("/products", productsH.Create)
				adm.Patch("/products/{id}", productsH.Update)
				adm.Delete("/products/{id}", productsH.Delete)

				adm.Post("/purchase-orders", purchaseOrdersH.Create)
				adm.Patch("/purchase-orders/{id}", purchaseOrdersH.Update)
				adm.Delete("/purchase-orders/{id}", purchaseOrdersH.Delete)

				// Templates + assignments are admin-managed master data.
				adm.Post("/shift-templates", shiftTemplatesH.Create)
				adm.Patch("/shift-templates/{id}", shiftTemplatesH.Update)
				adm.Delete("/shift-templates/{id}", shiftTemplatesH.Delete)

				adm.Post("/shift-assignments", shiftAssignmentsH.Create)
				adm.Patch("/shift-assignments/{id}", shiftAssignmentsH.Update)
				adm.Delete("/shift-assignments/{id}", shiftAssignmentsH.Delete)
				adm.Post("/shift-assignments/bulk", shiftAssignmentsH.Bulk)

				adm.Post("/pricelists", pricelistsH.Create)
				adm.Patch("/pricelists/{id}", pricelistsH.Update)
				adm.Delete("/pricelists/{id}", pricelistsH.Delete)
			})
		})
	})

	return r
}

func healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
