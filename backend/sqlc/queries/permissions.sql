-- name: SetRolePermission :one
INSERT INTO role_permissions (role_id, feature_id, actions)
VALUES (sqlc.arg('role_id'), sqlc.arg('feature_id'), sqlc.arg('actions'))
ON CONFLICT (role_id, feature_id)
DO UPDATE SET actions = EXCLUDED.actions, updated_at = NOW()
RETURNING *;

-- name: DeleteRolePermissions :exec
DELETE FROM role_permissions
WHERE role_id = sqlc.arg('role_id');

-- name: GetRolePermissions :many
SELECT rp.*, f.slug AS feature_slug, f.name AS feature_name, f.module AS feature_module
FROM role_permissions rp
INNER JOIN features f ON f.id = rp.feature_id
WHERE rp.role_id = sqlc.arg('role_id')
ORDER BY f.sort_order ASC;

-- name: LoadUserPermissions :many
SELECT f.slug AS feature_slug, rp.actions
FROM role_permissions rp
INNER JOIN user_roles ur ON ur.role_id = rp.role_id
INNER JOIN features f ON f.id = rp.feature_id
WHERE ur.user_id = sqlc.arg('user_id');
