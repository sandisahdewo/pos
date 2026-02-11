-- name: ListFeatures :many
SELECT * FROM features
ORDER BY sort_order ASC;

-- name: GetFeatureBySlug :one
SELECT * FROM features
WHERE slug = sqlc.arg('slug');

-- name: GetFeatureByID :one
SELECT * FROM features
WHERE id = sqlc.arg('id');

-- name: UpsertFeature :one
INSERT INTO features (id, parent_id, name, slug, module, actions, sort_order)
VALUES (sqlc.arg('id'), sqlc.arg('parent_id'), sqlc.arg('name'), sqlc.arg('slug'), sqlc.arg('module'), sqlc.arg('actions'), sqlc.arg('sort_order'))
ON CONFLICT (slug)
DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    actions = EXCLUDED.actions,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW()
RETURNING *;

-- name: ListChildFeatures :many
SELECT * FROM features
WHERE parent_id = sqlc.arg('parent_id')
ORDER BY sort_order ASC;
