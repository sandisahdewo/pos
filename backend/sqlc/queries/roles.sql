-- name: CreateRole :one
INSERT INTO roles (tenant_id, name, description, is_system_default)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('name'), sqlc.arg('description'), sqlc.arg('is_system_default'))
RETURNING *;

-- name: GetRoleByID :one
SELECT * FROM roles
WHERE id = sqlc.arg('id');

-- name: GetRolesByTenant :many
SELECT * FROM roles
WHERE tenant_id = sqlc.arg('tenant_id')
ORDER BY is_system_default DESC, name ASC;

-- name: UpdateRole :one
UPDATE roles
SET name = sqlc.arg('name'),
    description = sqlc.arg('description'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteRole :exec
DELETE FROM roles
WHERE id = sqlc.arg('id');

-- name: GetSystemDefaultRole :one
SELECT * FROM roles
WHERE tenant_id = sqlc.arg('tenant_id') AND is_system_default = TRUE
LIMIT 1;

-- name: AssignUserRole :one
INSERT INTO user_roles (user_id, role_id, assigned_by)
VALUES (sqlc.arg('user_id'), sqlc.arg('role_id'), sqlc.arg('assigned_by'))
ON CONFLICT (user_id, role_id) DO NOTHING
RETURNING *;

-- name: UnassignUserRole :exec
DELETE FROM user_roles
WHERE user_id = sqlc.arg('user_id') AND role_id = sqlc.arg('role_id');

-- name: GetUserRoles :many
SELECT r.* FROM roles r
INNER JOIN user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = sqlc.arg('user_id');

-- name: HasSystemDefaultRole :one
SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = sqlc.arg('user_id') AND r.is_system_default = TRUE
) AS has_default_role;
