# POS (Point of Sale) - Full Project Initialization Plan

## Context

Initialize a greenfield **SaaS multi-tenant, multi-store POS** application from an empty directory. This is a product sold to many customers on a single hosting platform. Each customer (super admin) registers, creates their first store, and manages their POS. Super admins can create multiple stores/branches and invite partners with customizable roles. Partners are granted access to specific stores (can be multiple), and their RBAC permissions apply uniformly across all their assigned stores. Super admins and the Administrator role automatically have access to all stores in their tenant.

## Tech Stack

- **Backend**: Go (chi router, pgx/sqlc, golang-migrate, golang-jwt, argon2id, asynq, validator/v10)
- **Frontend**: SvelteKit 2.x + Svelte 5 + TailwindCSS + shadcn-svelte (copy-paste component system)
- **Database**: PostgreSQL 16
- **Queue**: Redis 7 (for Asynq background jobs)
- **Email**: MailHog (dev), gomail (sending)
- **Testing**: Go testify (backend), Vitest (frontend), Playwright (E2E)
- **Infrastructure**: Docker + Docker Compose + Makefile
- **Go module**: `pos`

---

## Phase 1: Infrastructure Setup

### 1.1 Root files
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

### 1.2 Backend initialization
- `backend/go.mod` (module `pos`)
- `backend/Dockerfile` (multi-stage: development with air, builder, production)
- `backend/.air.toml`
- Dependencies: chi/v5, pgx/v5, golang-migrate/v4, golang-jwt/v5, alexedwards/argon2id, validator/v10, hibiken/asynq, go-mail/mail/v2, testify, google/uuid

### 1.3 Frontend initialization
- `npx sv create frontend` with Svelte 5, TypeScript, TailwindCSS, adapter-node
- `npx shadcn-svelte@latest init` — initialize shadcn-svelte (adds bits-ui, clsx, tailwind-merge, tailwind-variants)
- Add shadcn-svelte components: `npx shadcn-svelte@latest add button card input label table dialog dropdown-menu select badge separator sheet tabs avatar toast`
- `frontend/Dockerfile` (multi-stage: development, builder, production with adapter-node)
- Add dev deps: vitest, @testing-library/svelte, @playwright/test
- `vite.config.ts` — proxy `/api` to `http://backend:8080`
- `playwright.config.ts`

---

## Phase 2: Database Schema + Migrations

13 migration pairs in `backend/migrations/`:

| # | Table | Key columns |
|---|-------|-------------|
| 1 | extensions | uuid-ossp, pgcrypto |
| 2 | tenants | id (UUID PK), name, slug (UNIQUE), is_active |
| 3 | users | id, tenant_id FK, email (UNIQUE), password_hash, is_email_verified, is_active, first_name, last_name |
| 4 | **stores** | **id, tenant_id FK, name, address, phone, is_active, UNIQUE(tenant_id, name)** |
| 5 | features | id, parent_id FK (self-ref), name, slug (UNIQUE), module, actions (TEXT[]), sort_order |
| 6 | roles | id, tenant_id FK, name, description, is_system_default, UNIQUE(tenant_id, name) |
| 7 | role_permissions | id, role_id FK, feature_id FK, actions (TEXT[]), UNIQUE(role_id, feature_id) |
| 8 | user_roles | id, user_id FK, role_id FK, assigned_by FK, UNIQUE(user_id, role_id) |
| 9 | **user_stores** | **id, user_id FK, store_id FK, assigned_by FK, UNIQUE(user_id, store_id)** |
| 10 | email_verifications | id, user_id FK, token_hash, expires_at, is_used |
| 11 | password_resets | id, user_id FK, token_hash, expires_at, is_used |
| 12 | invitations | id, tenant_id FK, invited_by FK, email, role_id FK, **store_ids UUID[]** (optional), token_hash, status, expires_at |
| 13 | refresh_tokens | id, user_id FK, token_hash, expires_at, revoked |

All tables use UUID PKs. Proper indexes on tenant_id, email, token_hash, store_id columns.

### Multi-store design
- **stores** table: each tenant can have many stores/branches
- **user_stores** table: maps which stores a user can access (many-to-many)
- **Super admin / Administrator role** (`is_system_default=true`): bypasses store access checks — automatically sees all stores in their tenant
- **Invitations** include optional `store_ids` — pre-assign store access when inviting
- **Data queries** for store-scoped resources (products, sales, etc.) filter by user's assigned store IDs

### sqlc setup
- `backend/sqlc.yaml` — engine postgresql, pgx/v5, output to `internal/database/sqlc`
- Query files in `backend/sqlc/queries/`: tenants.sql, users.sql, stores.sql, roles.sql, permissions.sql, features.sql, tokens.sql, invitations.sql

---

## Phase 3: Backend Core

### Project structure
```
backend/
├── cmd/api/main.go          # API server (DI: config→pool→queries→services→handlers→router)
├── cmd/worker/main.go       # Asynq worker
├── cmd/seed/main.go         # Feature + default data seeder
├── internal/
│   ├── config/config.go     # Struct-based config from env vars
│   ├── database/database.go # pgxpool.Pool setup
│   ├── database/sqlc/       # Generated by sqlc
│   ├── handler/             # HTTP handlers (auth, user, role, store, invitation, feature, response helpers)
│   ├── middleware/           # auth (JWT), rbac (permission + store access), logger, cors, ratelimit
│   ├── model/               # Request/response structs, AppError types, pagination
│   ├── service/             # Business logic (auth, token, user, role, store, invitation, email)
│   ├── worker/              # Asynq task definitions + handlers (email_verification, password_reset, invitation)
│   ├── router/router.go     # chi route definitions with middleware layering
│   └── testutil/helpers.go  # Test DB setup, test user creation, JWT generation
├── migrations/
└── sqlc/queries/
```

### Key patterns
- **Error handling**: Domain `AppError` type with HTTP status codes; `respondError()` switches on error type
- **Logging**: `slog` structured logger (JSON in prod, text in dev)
- **Validation**: `go-playground/validator` v10 on all request structs
- **Dependency injection**: Manual constructor injection, no DI framework

---

## Phase 4: Authentication

### API endpoints (public)
```
POST /api/v1/auth/register          # Creates tenant + super admin + default admin role + first store
POST /api/v1/auth/login             # Returns JWT access (15m) + refresh (7d) tokens
POST /api/v1/auth/verify-email      # Consumes SHA-256 hashed token
POST /api/v1/auth/forgot-password   # Always returns success (prevents email enumeration)
POST /api/v1/auth/reset-password    # Validates token, updates password, revokes all refresh tokens
POST /api/v1/auth/refresh           # Refresh token rotation (single-use, old token revoked)
POST /api/v1/auth/accept-invitation # Creates user from invitation, auto-verifies email, assigns role + stores
```

### API endpoints (authenticated)
```
POST /api/v1/auth/logout            # Revokes refresh token
PUT  /api/v1/auth/change-password   # Requires current password
GET  /api/v1/me                     # Returns user profile + roles + permissions + accessible stores
```

### Registration request (updated)
```json
{
  "tenant_name": "My Business",
  "email": "admin@example.com",
  "password": "securepass123",
  "first_name": "John",
  "last_name": "Doe",
  "store_name": "Main Store",
  "store_address": "123 Main St"
}
```

### Security design
- **Password hashing**: argon2id (64MB memory, 3 iterations, 2 parallelism)
- **Tokens**: 32-byte crypto/rand → hex encoded (64 chars) → SHA-256 hash stored in DB
- **JWT claims**: user_id, tenant_id, email (NO permissions in JWT — loaded per-request)
- **Refresh token rotation**: each token single-use; reuse of revoked token = revoke all user tokens
- **Rate limiting**: on auth endpoints

### Registration flow (updated)
1. Begin transaction
2. Create tenant
3. Hash password with argon2id
4. Create user
5. **Create first store** (from store_name + store_address)
6. Create default "Administrator" role with `is_system_default=true`
7. Grant Administrator ALL permissions on ALL features
8. Assign user to Administrator role
9. Commit transaction
10. Enqueue email verification background job
11. Return JWT tokens

### Background jobs (Asynq)
- `email:verification` — sends verification email with link
- `email:password_reset` — sends password reset email
- `email:invitation` — sends invitation email
- All jobs: max 3 retries, 30s timeout, critical queue

---

## Phase 5: RBAC + Store Access System

### Seed data (features)
```
Master Data (parent) → Product (read, create, edit, delete)
Reporting (parent)   → Sales (read)
Purchase (parent)    → Product (read, create, edit, delete)
```

### API endpoints (authenticated)
```
# Features
GET    /api/v1/features              # List all system features (for permission matrix UI)

# Stores
GET    /api/v1/stores                # List tenant's stores (admin: all, partner: assigned only)
POST   /api/v1/stores                # Create store (admin only)
GET    /api/v1/stores/:id            # Get store details
PUT    /api/v1/stores/:id            # Update store
DELETE /api/v1/stores/:id            # Deactivate store

# Roles
GET    /api/v1/roles                 # List tenant's roles
POST   /api/v1/roles                 # Create role
GET    /api/v1/roles/:id             # Get role + permissions
PUT    /api/v1/roles/:id             # Update role (can't rename system defaults)
DELETE /api/v1/roles/:id             # Delete role (can't delete system defaults)
PUT    /api/v1/roles/:id/permissions # Replace all role permissions (validates actions subset)

# Users
GET    /api/v1/users                 # List tenant users (paginated)
GET    /api/v1/users/:id             # Get user + roles + assigned stores
PUT    /api/v1/users/:id             # Update user profile
DELETE /api/v1/users/:id             # Deactivate user (soft delete)
PUT    /api/v1/users/:id/stores      # Update user's store assignments

# Invitations
POST   /api/v1/invitations           # Invite user by email with role + optional store assignments
GET    /api/v1/invitations           # List tenant invitations
DELETE /api/v1/invitations/:id       # Cancel invitation
```

### Permission + store access checking

**Two-layer access control**:
1. **RBAC layer** (feature permissions): What can this user do? (read products, create sales reports, etc.)
2. **Store access layer**: Which stores' data can this user see?

**Middleware chain** (on authenticated routes):
1. `Authenticate` — validates JWT, extracts user_id + tenant_id
2. `LoadPermissions` — queries user's role permissions → builds `map[featureSlug]map[action]bool` → attaches to context
3. `LoadStoreAccess` — queries user's assigned stores → builds `[]storeID` → attaches to context. If user has `is_system_default` role, set flag `allStoresAccess=true`

**Helpers**:
- `RequirePermission(featureSlug, action)` — middleware factory for route-level enforcement
- `HasPermission(ctx, featureSlug, action)` — inline checks in handlers
- `GetAccessibleStoreIDs(ctx)` — returns user's store IDs (or nil if all-access)
- `CanAccessStore(ctx, storeID)` — checks if user can access a specific store

**Store-scoped data queries**: When fetching products, sales, etc., queries include `WHERE store_id = ANY($accessible_store_ids)` or skip the filter if `allStoresAccess=true`.

### Invitation flow (updated)
1. Super admin enters email, selects role, optionally selects stores
2. Generate invitation token, store hash in DB with `store_ids` array
3. Enqueue invitation email background job
4. On acceptance: create user → assign role → assign stores from invitation → auto-verify email

---

## Phase 6: Frontend

### Route structure
```
frontend/src/routes/
├── (auth)/                         # Centered card layout, no sidebar
│   ├── login/
│   ├── register/                   # Includes store_name + store_address fields
│   ├── forgot-password/
│   ├── reset-password/             # ?token=xxx
│   └── verify-email/               # ?token=xxx
├── (app)/                          # Sidebar + main content layout
│   ├── dashboard/
│   ├── settings/
│   │   ├── profile/
│   │   ├── stores/                 # Store CRUD (admin only)
│   │   ├── roles/                  # List + permission matrix editor
│   │   ├── roles/[id]/            # Role detail + permission editing
│   │   └── users/                  # User list + invite modal + store assignment + pending invitations
│   ├── master-data/products/       # Placeholder (filtered by accessible stores)
│   ├── reporting/sales/            # Placeholder (filtered by accessible stores)
│   └── purchase/products/          # Placeholder (filtered by accessible stores)
└── invitation/[token]/             # Invitation acceptance page
```

### Key frontend files
- `src/lib/api/client.ts` — fetch wrapper with auto Bearer token, 401 → refresh token retry
- `src/lib/stores/auth.svelte.ts` — Svelte 5 `$state` rune store (tokens, user, permissions, accessibleStores, hasPermission(), canAccessStore())
- `src/lib/components/Sidebar.svelte` — permission-based menu rendering (uses shadcn Sheet for mobile)
- `src/lib/components/PermissionGate.svelte` — conditional rendering based on permissions
- `src/lib/components/StoreSelector.svelte` — **store switcher/selector** using shadcn Select/DropdownMenu in app header
- `src/lib/components/ui/` — shadcn-svelte generated components (Button, Card, Input, Table, Dialog, etc.)
- Feature pages have `+page.ts` load guards checking permissions
- All forms use shadcn Input/Label/Button for consistent styling
- All data tables use shadcn Table
- Modals use shadcn Dialog
- Toast notifications use shadcn Toast

### Store selector UX
- App header shows a **store selector dropdown** (for users with multiple stores)
- Users can select which store(s) to view data for
- Selected store(s) stored in a Svelte store, sent as query param or header to API
- Admin users see "All Stores" option by default

### Auth flow (frontend)
1. Register/Login → store tokens in state + localStorage
2. On app load → check localStorage → attempt refresh → load user via `/me` (includes permissions + stores)
3. API client intercepts 401 → refreshes token → retries request
4. Logout → clear store + localStorage → redirect to login

---

## Phase 7: Testing

### Backend tests (`backend/internal/`)
- `service/auth_test.go` — register (with store creation), login, verify email, refresh rotation, password reset, change password
- `service/role_test.go` — CRUD, system default protection, permission validation
- `service/store_test.go` — CRUD, store access assignment, admin auto-access
- `handler/auth_test.go` — integration tests with httptest.Server + real test DB
- `middleware/rbac_test.go` — permission pass/deny, store access checks, admin bypass
- `testutil/helpers.go` — SetupTestDB (creates test schema, runs migrations), CreateTestUser, GenerateTestJWT

### Frontend tests (`frontend/`)
- `src/lib/components/Sidebar.test.ts` — permission-based visibility
- `src/lib/components/StoreSelector.test.ts` — store switching, multi-store display
- `src/routes/(auth)/login/login.test.ts` — form submission, error handling

### E2E tests (`frontend/tests/e2e/`)
- `auth.spec.ts` — register (with first store), login, invalid credentials, email verification flow
- `rbac.spec.ts` — admin sees all menus, limited user restricted, role creation + permission assignment
- `invitation.spec.ts` — invite user with role + stores, accept invitation, verify restricted access
- `stores.spec.ts` — create store, assign user to stores, verify store-scoped data filtering

---

## Verification

1. `make build` — all Docker images build successfully
2. `make up` — all 6 services start and are healthy
3. `make migrate-up` — all 13 migrations apply
4. `make seed` — features seeded
5. `make test-backend` — all Go tests pass
6. `make test-frontend` — all Vitest tests pass
7. Manual flow: register (with store) → check MailHog for verification email → verify → login → create second store → create role with limited permissions → invite user with role + store access → accept invitation → verify restricted access (only assigned stores visible, only permitted features accessible)
8. `make test-e2e` — all Playwright tests pass

---

## Implementation Order

Execute phases 1-7 sequentially. Within each phase, implement files in the order listed. The critical path is:

**Phase 1** (infra) → **Phase 2** (schema + sqlc) → **Phase 3** (backend core) → **Phase 4** (auth) → **Phase 5** (RBAC + stores) → **Phase 6** (frontend) → **Phase 7** (tests)
