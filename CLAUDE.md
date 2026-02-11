# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant, multi-store SaaS Point of Sale (POS) system. Go backend (chi router, PostgreSQL, Redis) + SvelteKit 5 frontend (Svelte 5, TailwindCSS 4, shadcn-svelte/bits-ui).

## Development Commands

All commands run inside Docker containers via Makefile:

```bash
make up                # Start all services (postgres, redis, mailhog, backend, worker, frontend)
make down              # Stop all services
make build             # Rebuild Docker images
make logs              # Tail all container logs
make migrate-up        # Run all pending migrations
make migrate-down      # Roll back one migration
make sqlc              # Regenerate sqlc code from SQL queries
make seed              # Seed features and default data
make lint              # Run golangci-lint (backend) + eslint (frontend)
```

### Testing

```bash
make test-backend      # go test ./... -v -count=1 (inside backend container)
make test-frontend     # npx vitest run (inside frontend container)
make test-e2e          # npx playwright test (inside frontend container)
make test              # backend + frontend unit tests
```

Run a single Go test:
```bash
docker compose exec backend go test ./internal/service/ -run TestAuthService -v
```

Run a single frontend test:
```bash
docker compose exec frontend npx vitest run src/lib/components/Sidebar.test.ts
```

### Frontend dependency changes

The frontend uses a named Docker volume for `node_modules`. After changing `package.json`:
```bash
docker compose exec frontend npm install
```

## Architecture

### Backend (`backend/`)

**Go module:** `pos` — **Entry points:** `cmd/api/main.go` (HTTP server :8080), `cmd/worker/main.go` (Asynq job processor), `cmd/seed/main.go` (DB seeder)

**Request flow:** chi router → global middleware (RequestID, RealIP, Logger, CORS, Recoverer) → route group middleware (rate limiter for public auth, JWT auth + RBAC + store access for protected routes) → handler → service → sqlc queries → PostgreSQL

**Internal packages:**
- `config/` — Loads all settings from environment variables
- `database/` — pgx connection pool; `database/sqlc/` — generated query code (DO NOT edit manually)
- `handler/` — HTTP handlers (auth, store, role, user, feature, invitation). Parse requests, call services, write JSON responses
- `service/` — Business logic layer. All tenant-scoped get-by-ID methods must verify `entity.TenantID == requestingUser.TenantID`
- `middleware/` — Auth (JWT extraction), CORS, Logger, RateLimiter, RBAC (permission checking), StoreAccess (multi-store filtering)
- `model/` — Request/response structs, `AppError` type, pagination, validators
- `worker/` — Asynq task definitions and handlers (email verification, password reset, invitations)
- `router/` — Route definitions with middleware layering

**SQL workflow:** Write queries in `backend/sqlc/queries/*.sql` → run `make sqlc` → generated Go code appears in `internal/database/sqlc/`

**Migrations:** Sequential SQL files in `backend/migrations/`. The `migrate` binary is pre-installed in the dev Docker image (don't use `go run`).

### Frontend (`frontend/`)

**Framework:** SvelteKit 2 with Svelte 5 (runes: `$state`, `$derived`, `$effect`), adapter-node, Vite with TailwindCSS plugin.

**API proxy:** Vite proxies `/api` requests to `http://backend:8080` in development.

**Key modules:**
- `src/lib/stores/auth.svelte.ts` — Auth state (tokens, user, roles, permissions, stores). Uses module-level `$state` object. Cross-tab sync via localStorage events. Token refresh auto-scheduled from JWT expiry.
- `src/lib/api/client.ts` — Singleton API client with token refresh, timeout handling (30s default), enhanced error class
- `src/lib/api/types.ts` — TypeScript interfaces for all API request/response types
- `src/lib/components/ui/` — shadcn-svelte component library (DO NOT edit generated components without good reason)
- `src/lib/components/PermissionGate.svelte` — RBAC guard component

**Route groups:**
- `(auth)/` — Public routes: login, register, verify-email, forgot-password, reset-password
- `(app)/` — Protected routes: dashboard, master-data (stores/roles/users), settings, purchase, reporting
- `invitation/` — Standalone invitation acceptance flow

**Auth initialization** happens in `(app)/+layout.ts` load function (not in component lifecycle). Route guards redirect to `/login` if not authenticated.

### Docker Services

Six services in `docker-compose.yml`: PostgreSQL 16, Redis 7, MailHog (dev email at :8025), Backend (:8080 with air hot-reload), Worker (Asynq processor), Frontend (:5173 Vite dev server).

## Critical Patterns

### Multi-Tenancy Security

All get-by-ID service methods MUST verify `entity.TenantID` matches the requesting user's tenant ID. The sqlc queries (e.g., `GetStoreByID`, `GetUserByID`) do NOT filter by `tenant_id` — the service layer enforces this. On mismatch, return `ErrNotFound` (not `ErrForbidden`) to avoid leaking resource existence.

### Svelte 5 Lifecycle Issues

- **Page data loading:** Use `$effect` with a one-time guard + `untrack()` instead of `onMount` (which may not fire when parent layout conditionally renders children with `{#if}`).
- **bits-ui Dialog/Select:** Wrap in `{#if mounted}` guard (set `mounted = true` in `onMount`). Never set `mounted` inside `$effect` — it causes `lifecycle_outside_component` errors that crash SvelteKit's client-side router.
- **bits-ui Tabs:** Replaced with plain HTML buttons + `$state` tab switching to avoid lifecycle crashes.
- **svelte-sonner:** Removed due to crashes. Use inline `{#if error}` / `{#if success}` messages instead.

### API Endpoints

All under `/api/v1`. Public auth routes are rate-limited (10 req/s, burst 20). Protected routes require JWT in Authorization header + RBAC permission checks.

## Environment

Copy `.env.example` to `.env` for local development. Hostnames use Docker service names (postgres, redis, mailhog, backend). MailHog UI at `http://localhost:8025` for email testing.
