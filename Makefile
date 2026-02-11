.PHONY: up down build logs restart migrate-up migrate-down migrate-create test-backend test-frontend test-e2e test sqlc lint seed

# =============================================================================
# Docker
# =============================================================================

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

# =============================================================================
# Database Migrations
# =============================================================================

migrate-up:
	docker compose exec backend migrate \
		-path /app/migrations \
		-database "postgres://$${DB_USER}:$${DB_PASSWORD}@$${DB_HOST}:$${DB_PORT}/$${DB_NAME}?sslmode=$${DB_SSLMODE}" \
		up

migrate-down:
	docker compose exec backend migrate \
		-path /app/migrations \
		-database "postgres://$${DB_USER}:$${DB_PASSWORD}@$${DB_HOST}:$${DB_PORT}/$${DB_NAME}?sslmode=$${DB_SSLMODE}" \
		down 1

migrate-create:
	@read -p "Migration name: " name; \
	docker compose exec backend migrate \
		-path /app/migrations \
		create -ext sql -dir /app/migrations -seq $$name

# =============================================================================
# Code Generation
# =============================================================================

sqlc:
	docker compose exec backend sqlc generate

# =============================================================================
# Seeding
# =============================================================================

seed:
	docker compose exec backend go run cmd/seed/main.go

# =============================================================================
# Testing
# =============================================================================

test-backend:
	docker compose exec backend go test ./... -v -count=1

test-frontend:
	docker compose exec frontend npx vitest run

test-e2e:
	docker compose exec frontend npx playwright test

test: test-backend test-frontend

# =============================================================================
# Linting
# =============================================================================

lint:
	docker compose exec backend golangci-lint run ./...
	docker compose exec frontend npx eslint .
