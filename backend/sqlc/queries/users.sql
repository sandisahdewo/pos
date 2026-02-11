-- name: CreateUser :one
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('email'), sqlc.arg('password_hash'), sqlc.arg('first_name'), sqlc.arg('last_name'))
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = sqlc.arg('id');

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = sqlc.arg('email');

-- name: GetUsersByTenant :many
SELECT * FROM users
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY created_at DESC
LIMIT sqlc.arg('limit_val') OFFSET sqlc.arg('offset_val');

-- name: CountUsersByTenant :one
SELECT COUNT(*) FROM users
WHERE tenant_id = sqlc.arg('tenant_id');

-- name: UpdateUser :one
UPDATE users
SET first_name = sqlc.arg('first_name'),
    last_name = sqlc.arg('last_name'),
    is_active = sqlc.arg('is_active'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = sqlc.arg('password_hash'),
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: UpdateUserEmailVerified :exec
UPDATE users
SET is_email_verified = sqlc.arg('is_email_verified'),
    updated_at = NOW()
WHERE id = sqlc.arg('id');

-- name: DeactivateUser :exec
UPDATE users
SET is_active = FALSE,
    updated_at = NOW()
WHERE id = sqlc.arg('id');
