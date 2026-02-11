# =============================================================================
# Stage 1: Development (hot-reload with air)
# =============================================================================
FROM golang:1.24-alpine AS development

RUN apk add --no-cache git curl

# Install air for hot-reloading and migrate CLI for faster migration commands
RUN go install github.com/air-verse/air@v1.61.5 && \
    go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

WORKDIR /app

# Copy go.mod and go.sum first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 8080

CMD ["air", "-c", ".air.toml"]

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/worker ./cmd/worker

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM alpine:3.20 AS production

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/api /bin/api
COPY --from=builder /bin/worker /bin/worker
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080

CMD ["/bin/api"]
