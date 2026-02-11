-- name: CreateTenant :one
INSERT INTO tenants (name, slug)
VALUES (sqlc.arg('name'), sqlc.arg('slug'))
RETURNING *;

-- name: GetTenantByID :one
SELECT * FROM tenants
WHERE id = sqlc.arg('id');

-- name: GetTenantBySlug :one
SELECT * FROM tenants
WHERE slug = sqlc.arg('slug');

-- name: UpdateTenant :one
UPDATE tenants
SET name = sqlc.arg('name'),
    slug = sqlc.arg('slug'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: ListTenants :many
SELECT * FROM tenants
ORDER BY created_at DESC;
