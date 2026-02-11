# POS Project — Task Board

> Generated from PLAN.md. All tasks start as `TODO`.
> Statuses: `TODO` | `IN PROGRESS` | `DONE`

---

## Dependency Graph

```
Phase 1: Infrastructure
  #1  Root files (.env, docker-compose, Makefile)     ← START HERE
   ├─► #2  Backend init (Go)         ┐ PARALLEL
   └─► #3  Frontend init (SvelteKit) ┘ PARALLEL

Phase 2: Database
  #2 ─► #4  Database migrations (13 tables)
  #4 ─► #5  sqlc config + query files

Phase 3: Backend Core
  #5 ─► #6  Config, DB pool, models, errors
  #6 ─► #7  Router + middleware setup

Phase 4: Authentication
  #7 ─► #8  Auth service layer
  #8 ─┬► #9   Auth handlers + routes  ┐ PARALLEL
     └► #10  Background jobs (Asynq)  ┘ PARALLEL

Phase 5: RBAC + Store Access
  #9 + #10 ─► #11  Feature seeding + RBAC middleware
  #11 ─┬► #12  Store CRUD handlers         ┐ PARALLEL
       └► #13  Role + Permission handlers   ┘ PARALLEL
  #12 + #13 ─► #14  User mgmt + Invitations

Phase 6: Frontend
  #3 + #9 ─► #15  API client + auth store
  #15 ─┬► #16  Auth pages               ┐ PARALLEL
       └► #17  App layout + sidebar      ┘ PARALLEL
  #16 + #17 ─► #18  Settings pages
  #17 ─► #19  Placeholder feature pages  (PARALLEL with #18)

Phase 7: Testing
  #14 ─► #20  Backend tests             ┐ PARALLEL
  #18 + #19 ─► #21  Frontend tests      ┘ PARALLEL
  #20 + #21 ─► #22  E2E tests (Playwright)  ← FINAL
```

---

## Phase 1: Infrastructure Setup

### Task #1 — Create root infrastructure files
- **Status:** `DONE`
- **Blocked by:** —
- **Unlocks:** #2, #3

Create the following root-level project files:

- `.env` / `.env.example` — DB, Redis, JWT, SMTP, Argon2, app config
- `.gitignore` — .env, node_modules, .svelte-kit, dist, vendor, tmp
- `docker-compose.yml` — 6 services:
  - `postgres` (16-alpine, healthcheck, named volume)
  - `redis` (7-alpine, healthcheck, named volume)
  - `mailhog` (ports 1025/8025)
  - `backend` (Go API, port 8080, hot-reload via air, mounts `./backend`)
  - `worker` (same image as backend, runs `cmd/worker/main.go`)
  - `frontend` (SvelteKit dev, port 5173, mounts `./frontend`, separate node_modules volume)
- `Makefile` — targets: up, down, build, logs, restart, migrate-up, migrate-down, migrate-create, test-backend, test-frontend, test-e2e, test, sqlc, lint, seed

---

### Task #2 — Initialize backend (Go)
- **Status:** `DONE`
- **Blocked by:** #1
- **Unlocks:** #4
- **Parallel with:** #3

- `backend/go.mod` (module `pos`)
- `backend/Dockerfile` (multi-stage: development with air, builder, production)
- `backend/.air.toml`
- Dependencies: chi/v5, pgx/v5, golang-migrate/v4, golang-jwt/v5, alexedwards/argon2id, validator/v10, hibiken/asynq, go-mail/mail/v2, testify, google/uuid

---

### Task #3 — Initialize frontend (SvelteKit)
- **Status:** `DONE`
- **Blocked by:** #1
- **Unlocks:** #15
- **Parallel with:** #2

- `npx sv create frontend` with Svelte 5, TypeScript, TailwindCSS, adapter-node
- `npx shadcn-svelte@latest init` — initialize shadcn-svelte (adds bits-ui, clsx, tailwind-merge, tailwind-variants)
- Add shadcn-svelte components: `npx shadcn-svelte@latest add button card input label table dialog dropdown-menu select badge separator sheet tabs avatar toast`
- `frontend/Dockerfile` (multi-stage: development, builder, production with adapter-node)
- Add dev deps: vitest, @testing-library/svelte, @playwright/test
- `vite.config.ts` — proxy `/api` to `http://backend:8080`
- `playwright.config.ts`

---

## Phase 2: Database Schema + Migrations

### Task #4 — Create database migrations
- **Status:** `DONE`
- **Blocked by:** #2
- **Unlocks:** #5

Create 13 migration pairs in `backend/migrations/`:

| # | Table | Key columns |
|---|-------|-------------|
| 1 | extensions | uuid-ossp, pgcrypto |
| 2 | tenants | id (UUID PK), name, slug (UNIQUE), is_active |
| 3 | users | id, tenant_id FK, email (UNIQUE), password_hash, is_email_verified, is_active, first_name, last_name |
| 4 | stores | id, tenant_id FK, name, address, phone, is_active, UNIQUE(tenant_id, name) |
| 5 | features | id, parent_id FK (self-ref), name, slug (UNIQUE), module, actions (TEXT[]), sort_order |
| 6 | roles | id, tenant_id FK, name, description, is_system_default, UNIQUE(tenant_id, name) |
| 7 | role_permissions | id, role_id FK, feature_id FK, actions (TEXT[]), UNIQUE(role_id, feature_id) |
| 8 | user_roles | id, user_id FK, role_id FK, assigned_by FK, UNIQUE(user_id, role_id) |
| 9 | user_stores | id, user_id FK, store_id FK, assigned_by FK, UNIQUE(user_id, store_id) |
| 10 | email_verifications | id, user_id FK, token_hash, expires_at, is_used |
| 11 | password_resets | id, user_id FK, token_hash, expires_at, is_used |
| 12 | invitations | id, tenant_id FK, invited_by FK, email, role_id FK, store_ids UUID[] (optional), token_hash, status, expires_at |
| 13 | refresh_tokens | id, user_id FK, token_hash, expires_at, revoked |

All tables use UUID PKs. Proper indexes on tenant_id, email, token_hash, store_id columns. All tables should have created_at and updated_at timestamps.

---

### Task #5 — Setup sqlc config and query files
- **Status:** `DONE`
- **Blocked by:** #4
- **Unlocks:** #6

- `backend/sqlc.yaml` — engine postgresql, pgx/v5, output to `internal/database/sqlc`
- Query files in `backend/sqlc/queries/`:
  - `tenants.sql` — CRUD for tenants
  - `users.sql` — CRUD for users, find by email, find by tenant
  - `stores.sql` — CRUD for stores, find by tenant, user store assignments
  - `roles.sql` — CRUD for roles, find by tenant, system default checks
  - `permissions.sql` — role permission CRUD, load user permissions
  - `features.sql` — list features, find by slug, seed operations
  - `tokens.sql` — refresh tokens, email verifications, password resets (create, find, revoke)
  - `invitations.sql` — CRUD for invitations, find by token/email
- Run `sqlc generate` to produce Go code in `internal/database/sqlc/`

---

## Phase 3: Backend Core

### Task #6 — Backend core (config, DB, models, errors)
- **Status:** `DONE`
- **Blocked by:** #5
- **Unlocks:** #7

- `internal/config/config.go` — Struct-based config from env vars (DB, Redis, JWT, SMTP, Argon2, app settings)
- `internal/database/database.go` — pgxpool.Pool setup with connection string from config
- `internal/model/` — Request/response structs, AppError types (with HTTP status codes), pagination structs
- Error handling: Domain `AppError` type with HTTP status codes; `respondError()` switches on error type
- Logging: `slog` structured logger (JSON in prod, text in dev)
- Validation: `go-playground/validator` v10 on all request structs
- Dependency injection: Manual constructor injection, no DI framework

---

### Task #7 — Router and middleware setup
- **Status:** `DONE`
- **Blocked by:** #6
- **Unlocks:** #8

- `internal/router/router.go` — chi route definitions with middleware layering
- `internal/middleware/`:
  - `auth.go` — JWT authentication middleware (validates JWT, extracts user_id + tenant_id)
  - `logger.go` — Request logging middleware using slog
  - `cors.go` — CORS configuration
  - `ratelimit.go` — Rate limiting on auth endpoints
- `internal/handler/response.go` — JSON response helpers (respondJSON, respondError)
- `cmd/api/main.go` — API server entry point (DI: config → pool → queries → services → handlers → router)

---

## Phase 4: Authentication

### Task #8 — Auth service layer
- **Status:** `DONE`
- **Blocked by:** #7
- **Unlocks:** #9, #10

Implement `internal/service/auth.go` and `internal/service/token.go`:

- `Register()` — Creates tenant + super admin + default admin role + first store (in transaction)
- `Login()` — Validates credentials, returns JWT access (15m) + refresh (7d) tokens
- `VerifyEmail()` — Consumes SHA-256 hashed token
- `ForgotPassword()` — Always returns success (prevents email enumeration)
- `ResetPassword()` — Validates token, updates password, revokes all refresh tokens
- `RefreshToken()` — Refresh token rotation (single-use, old token revoked)
- `AcceptInvitation()` — Creates user from invitation, auto-verifies email, assigns role + stores
- `Logout()` — Revokes refresh token
- `ChangePassword()` — Requires current password

Security:
- Password hashing: argon2id (64MB memory, 3 iterations, 2 parallelism)
- Tokens: 32-byte crypto/rand → hex encoded (64 chars) → SHA-256 hash stored in DB
- JWT claims: user_id, tenant_id, email (NO permissions in JWT — loaded per-request)
- Refresh token rotation: reuse of revoked token = revoke all user tokens

---

### Task #9 — Auth handlers and routes
- **Status:** `DONE`
- **Blocked by:** #8
- **Unlocks:** #11, #15
- **Parallel with:** #10

Implement `internal/handler/auth.go` and register routes:

Public endpoints:
- `POST /api/v1/auth/register` — Creates tenant + super admin + default admin role + first store
- `POST /api/v1/auth/login` — Returns JWT access + refresh tokens
- `POST /api/v1/auth/verify-email` — Consumes hashed token
- `POST /api/v1/auth/forgot-password` — Always returns success
- `POST /api/v1/auth/reset-password` — Validates token, updates password
- `POST /api/v1/auth/refresh` — Refresh token rotation
- `POST /api/v1/auth/accept-invitation` — Creates user from invitation

Authenticated endpoints:
- `POST /api/v1/auth/logout` — Revokes refresh token
- `PUT  /api/v1/auth/change-password` — Requires current password
- `GET  /api/v1/me` — Returns user profile + roles + permissions + accessible stores

Registration request includes: tenant_name, email, password, first_name, last_name, store_name, store_address. Request validation with validator/v10 on all request structs.

---

### Task #10 — Background jobs (Asynq worker)
- **Status:** `DONE`
- **Blocked by:** #8
- **Unlocks:** #11
- **Parallel with:** #9

Implement `internal/worker/` and `cmd/worker/main.go`:

Task definitions:
- `email:verification` — Sends verification email with link
- `email:password_reset` — Sends password reset email
- `email:invitation` — Sends invitation email

Files:
- `cmd/worker/main.go` — Asynq worker entry point, connects to Redis, registers handlers
- `internal/worker/tasks.go` — Task type constants and payload structs
- `internal/worker/handlers.go` — Task handler implementations
- `internal/service/email.go` — Email sending service using gomail (MailHog in dev)

All jobs: max 3 retries, 30s timeout, critical queue.

---

## Phase 5: RBAC + Store Access System

### Task #11 — Feature seeding + RBAC middleware
- **Status:** `DONE`
- **Blocked by:** #9, #10
- **Unlocks:** #12, #13

Seed data (`cmd/seed/main.go`):
```
Master Data (parent) → Product (read, create, edit, delete)
Reporting (parent)   → Sales (read)
Purchase (parent)    → Product (read, create, edit, delete)
```

RBAC Middleware (`internal/middleware/rbac.go`):
- `LoadPermissions` — queries user's role permissions → builds `map[featureSlug]map[action]bool` → attaches to context
- `LoadStoreAccess` — queries user's assigned stores → builds `[]storeID` → attaches to context. If user has `is_system_default` role, set flag `allStoresAccess=true`

Helpers:
- `RequirePermission(featureSlug, action)` — middleware factory for route-level enforcement
- `HasPermission(ctx, featureSlug, action)` — inline checks in handlers
- `GetAccessibleStoreIDs(ctx)` — returns user's store IDs (or nil if all-access)
- `CanAccessStore(ctx, storeID)` — checks if user can access a specific store

---

### Task #12 — Store CRUD handlers
- **Status:** `DONE`
- **Blocked by:** #11
- **Unlocks:** #14
- **Parallel with:** #13

Implement `internal/service/store.go` and `internal/handler/store.go`:

- `GET    /api/v1/stores` — List tenant's stores (admin: all, partner: assigned only)
- `POST   /api/v1/stores` — Create store (admin only)
- `GET    /api/v1/stores/:id` — Get store details
- `PUT    /api/v1/stores/:id` — Update store
- `DELETE /api/v1/stores/:id` — Deactivate store (soft delete)

Store-scoped data queries filter by user's assigned store IDs via `WHERE store_id = ANY($accessible_store_ids)` or skip the filter if `allStoresAccess=true`.

---

### Task #13 — Role + Permission handlers
- **Status:** `DONE`
- **Blocked by:** #11
- **Unlocks:** #14
- **Parallel with:** #12

Implement `internal/service/role.go` and `internal/handler/role.go`:

- `GET    /api/v1/roles` — List tenant's roles
- `POST   /api/v1/roles` — Create role
- `GET    /api/v1/roles/:id` — Get role + permissions
- `PUT    /api/v1/roles/:id` — Update role (can't rename system defaults)
- `DELETE /api/v1/roles/:id` — Delete role (can't delete system defaults)
- `PUT    /api/v1/roles/:id/permissions` — Replace all role permissions (validates actions subset)

Feature endpoint:
- `GET    /api/v1/features` — List all system features (for permission matrix UI)

Implement `internal/handler/feature.go` for the features listing.

---

### Task #14 — User management + Invitation handlers
- **Status:** `DONE`
- **Blocked by:** #12, #13
- **Unlocks:** #20

Implement `internal/service/user.go`, `internal/service/invitation.go`, `internal/handler/user.go`, `internal/handler/invitation.go`:

User endpoints:
- `GET    /api/v1/users` — List tenant users (paginated)
- `GET    /api/v1/users/:id` — Get user + roles + assigned stores
- `PUT    /api/v1/users/:id` — Update user profile
- `DELETE /api/v1/users/:id` — Deactivate user (soft delete)
- `PUT    /api/v1/users/:id/stores` — Update user's store assignments

Invitation endpoints:
- `POST   /api/v1/invitations` — Invite user by email with role + optional store assignments
- `GET    /api/v1/invitations` — List tenant invitations
- `DELETE /api/v1/invitations/:id` — Cancel invitation

Invitation flow:
1. Super admin enters email, selects role, optionally selects stores
2. Generate invitation token, store hash in DB with `store_ids` array
3. Enqueue invitation email background job
4. On acceptance: create user → assign role → assign stores from invitation → auto-verify email

---

## Phase 6: Frontend

### Task #15 — Frontend API client + auth store
- **Status:** `DONE`
- **Blocked by:** #3, #9
- **Unlocks:** #16, #17

- `src/lib/api/client.ts` — Fetch wrapper with auto Bearer token, 401 → refresh token retry
- `src/lib/stores/auth.svelte.ts` — Svelte 5 `$state` rune store:
  - tokens, user, permissions, accessibleStores
  - `hasPermission()` method
  - `canAccessStore()` method
- Auth flow:
  1. Register/Login → store tokens in state + localStorage
  2. On app load → check localStorage → attempt refresh → load user via `/me` (includes permissions + stores)
  3. API client intercepts 401 → refreshes token → retries request
  4. Logout → clear store + localStorage → redirect to login

---

### Task #16 — Auth pages (login, register, etc.)
- **Status:** `DONE`
- **Blocked by:** #15
- **Unlocks:** #18
- **Parallel with:** #17

Create pages under `(auth)/` layout group (centered card layout, no sidebar):

- `(auth)/login/` — Login form with email + password
- `(auth)/register/` — Registration form including store_name + store_address fields
- `(auth)/forgot-password/` — Email input for password reset
- `(auth)/reset-password/` — New password form (?token=xxx)
- `(auth)/verify-email/` — Email verification page (?token=xxx)
- `invitation/[token]/` — Invitation acceptance page

All forms use shadcn Input/Label/Button. Toast notifications for success/error feedback.

---

### Task #17 — App layout (sidebar, store selector)
- **Status:** `DONE`
- **Blocked by:** #15
- **Unlocks:** #18, #19
- **Parallel with:** #16

Create the `(app)/` layout group with sidebar + main content layout:

- `src/lib/components/Sidebar.svelte` — Permission-based menu rendering (uses shadcn Sheet for mobile)
- `src/lib/components/StoreSelector.svelte` — Store switcher/selector using shadcn Select/DropdownMenu in app header
- `src/lib/components/PermissionGate.svelte` — Conditional rendering based on permissions

Store selector UX:
- App header shows a store selector dropdown (for users with multiple stores)
- Users can select which store(s) to view data for
- Selected store(s) stored in a Svelte store, sent as query param or header to API
- Admin users see "All Stores" option by default

Feature pages have `+page.ts` load guards checking permissions.

---

### Task #18 — Settings pages (profile, stores, roles, users)
- **Status:** `DONE`
- **Blocked by:** #16, #17
- **Unlocks:** #21

Create settings pages under `(app)/settings/`:

- `settings/profile/` — User profile editing
- `settings/stores/` — Store CRUD (admin only), list stores, create/edit/deactivate
- `settings/roles/` — Role list + permission matrix editor
- `settings/roles/[id]/` — Role detail + permission editing
- `settings/users/` — User list + invite modal + store assignment + pending invitations tab

All data tables use shadcn Table. Modals use shadcn Dialog. Toast notifications for feedback.

---

### Task #19 — Placeholder feature pages
- **Status:** `DONE`
- **Blocked by:** #17
- **Unlocks:** #21
- **Parallel with:** #18

Create placeholder pages under `(app)/`:

- `master-data/products/` — Placeholder (filtered by accessible stores)
- `reporting/sales/` — Placeholder (filtered by accessible stores)
- `purchase/products/` — Placeholder (filtered by accessible stores)

Each page should:
- Show the store selector filtering in action
- Have `+page.ts` load guards checking permissions
- Display a basic table or placeholder message indicating the feature area
- Respect store-scoped data filtering

---

## Phase 7: Testing

### Task #20 — Backend tests
- **Status:** `DONE`
- **Blocked by:** #14
- **Unlocks:** #22
- **Parallel with:** #21

- `service/auth_test.go` — register (with store creation), login, verify email, refresh rotation, password reset, change password
- `service/role_test.go` — CRUD, system default protection, permission validation
- `service/store_test.go` — CRUD, store access assignment, admin auto-access
- `handler/auth_test.go` — integration tests with httptest.Server + real test DB
- `middleware/rbac_test.go` — permission pass/deny, store access checks, admin bypass
- `testutil/helpers.go` — SetupTestDB (creates test schema, runs migrations), CreateTestUser, GenerateTestJWT

Use testify for assertions. Tests should use a real PostgreSQL test database.

---

### Task #21 — Frontend component tests
- **Status:** `DONE`
- **Blocked by:** #18, #19
- **Unlocks:** #22
- **Parallel with:** #20

Vitest tests:
- `src/lib/components/Sidebar.test.ts` — permission-based visibility
- `src/lib/components/StoreSelector.test.ts` — store switching, multi-store display
- `src/routes/(auth)/login/login.test.ts` — form submission, error handling

Use Vitest + @testing-library/svelte.

---

### Task #22 — E2E tests (Playwright)
- **Status:** `DONE`
- **Blocked by:** #20, #21
- **Unlocks:** — (FINAL TASK)

Playwright E2E tests in `frontend/tests/e2e/`:

- `auth.spec.ts` — register (with first store), login, invalid credentials, email verification flow
- `rbac.spec.ts` — admin sees all menus, limited user restricted, role creation + permission assignment
- `invitation.spec.ts` — invite user with role + stores, accept invitation, verify restricted access
- `stores.spec.ts` — create store, assign user to stores, verify store-scoped data filtering

Requires full stack running (`docker-compose up`).

---

## Parallelization Summary

| Wave | Tasks | Notes |
|------|-------|-------|
| 1 | #1 | Root infra — no blockers |
| 2 | #2, #3 | Backend + frontend init — PARALLEL |
| 3 | #4 | Database migrations |
| 4 | #5 | sqlc setup |
| 5 | #6 | Backend core packages |
| 6 | #7 | Router + middleware |
| 7 | #8 | Auth service |
| 8 | #9, #10 | Auth handlers + background jobs — PARALLEL |
| 9 | #11 | RBAC middleware + seeding |
| 10 | #12, #13 | Store + role handlers — PARALLEL |
| 11 | #14, #15 | User/invitation handlers + frontend API client — PARALLEL |
| 12 | #16, #17 | Auth pages + app layout — PARALLEL |
| 13 | #18, #19 | Settings + placeholder pages — PARALLEL |
| 14 | #20, #21 | Backend + frontend tests — PARALLEL |
| 15 | #22 | E2E tests — FINAL |
