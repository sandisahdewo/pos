-- name: CreateUnitConversion :one
INSERT INTO unit_conversions (tenant_id, from_unit_id, to_unit_id, conversion_factor)
VALUES (sqlc.arg('tenant_id'), sqlc.arg('from_unit_id'), sqlc.arg('to_unit_id'), sqlc.arg('conversion_factor'))
RETURNING *;

-- name: GetUnitConversionByID :one
SELECT * FROM unit_conversions
WHERE id = sqlc.arg('id');

-- name: GetUnitConversionsByTenant :many
SELECT uc.*,
       fu.name AS from_unit_name,
       tu.name AS to_unit_name
FROM unit_conversions uc
INNER JOIN units fu ON fu.id = uc.from_unit_id
INNER JOIN units tu ON tu.id = uc.to_unit_id
WHERE uc.tenant_id = sqlc.arg('tenant_id')
ORDER BY fu.name ASC, tu.name ASC;

-- name: UpdateUnitConversion :one
UPDATE unit_conversions
SET from_unit_id = sqlc.arg('from_unit_id'),
    to_unit_id = sqlc.arg('to_unit_id'),
    conversion_factor = sqlc.arg('conversion_factor'),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteUnitConversion :exec
DELETE FROM unit_conversions
WHERE id = sqlc.arg('id');

-- name: GetConversionFactor :one
SELECT conversion_factor FROM unit_conversions
WHERE tenant_id = sqlc.arg('tenant_id')
  AND from_unit_id = sqlc.arg('from_unit_id')
  AND to_unit_id = sqlc.arg('to_unit_id');
