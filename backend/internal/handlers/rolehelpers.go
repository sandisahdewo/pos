package handlers

import (
	"context"

	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

// loadRoleIDsFor returns the set of role UUIDs assigned to a user.
func loadRoleIDsFor(ctx context.Context, db *bun.DB, userID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := db.NewSelect().
		Table("user_roles").
		Column("role_id").
		Where("user_id = ?", userID).
		Scan(ctx, &ids)
	if err != nil {
		return nil, err
	}
	if ids == nil {
		return []uuid.UUID{}, nil
	}
	return ids, nil
}

// loadRoleNamesFor returns the role names assigned to a user. Used by Login to
// embed in JWT claims (so middleware can RequireRole("Admin")).
func loadRoleNamesFor(ctx context.Context, db *bun.DB, userID uuid.UUID) ([]string, error) {
	var names []string
	err := db.NewSelect().
		Table("roles").
		Column("roles.name").
		Join("JOIN user_roles AS ur ON ur.role_id = roles.id").
		Where("ur.user_id = ?", userID).
		Order("roles.name ASC").
		Scan(ctx, &names)
	if err != nil {
		return nil, err
	}
	if names == nil {
		return []string{}, nil
	}
	return names, nil
}

// loadPermissionsForRoles returns the unioned permission set for the given
// role IDs. Wildcard short-circuits: if any role grants '*', the result is
// just ['*'].
func loadPermissionsForRoles(
	ctx context.Context,
	db *bun.DB,
	roleIDs []uuid.UUID,
) ([]string, error) {
	if len(roleIDs) == 0 {
		return []string{}, nil
	}
	var perms []string
	err := db.NewSelect().
		Distinct().
		Table("role_permissions").
		Column("permission").
		Where("role_id IN (?)", bun.In(roleIDs)).
		Scan(ctx, &perms)
	if err != nil {
		return nil, err
	}
	for _, p := range perms {
		if p == models.WildcardPermission {
			return []string{models.WildcardPermission}, nil
		}
	}
	return perms, nil
}

// loadPermissionsForRole — single-role variant used by the roles list handler.
func loadPermissionsForRole(
	ctx context.Context,
	db *bun.DB,
	roleID uuid.UUID,
) ([]string, error) {
	var perms []string
	err := db.NewSelect().
		Table("role_permissions").
		Column("permission").
		Where("role_id = ?", roleID).
		Order("permission ASC").
		Scan(ctx, &perms)
	if err != nil {
		return nil, err
	}
	if perms == nil {
		return []string{}, nil
	}
	return perms, nil
}

// replaceUserRoles wipes existing user_roles for a user and inserts the new
// set in a single transaction. Used by users.Create and users.Update.
func replaceUserRoles(
	ctx context.Context,
	db *bun.DB,
	userID uuid.UUID,
	roleIDs []uuid.UUID,
) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().
			Model((*models.UserRole)(nil)).
			Where("user_id = ?", userID).
			Exec(ctx); err != nil {
			return err
		}
		if len(roleIDs) == 0 {
			return nil
		}
		rows := make([]models.UserRole, len(roleIDs))
		for i, rid := range roleIDs {
			rows[i] = models.UserRole{UserID: userID, RoleID: rid}
		}
		_, err := tx.NewInsert().Model(&rows).Exec(ctx)
		return err
	})
}

// replaceRolePermissions wipes a role's permission rows and inserts the new
// set. Wildcard short-circuit: if the input contains '*', only that row is
// kept (storing both '*' and specific keys would be a confusing data shape).
func replaceRolePermissions(
	ctx context.Context,
	db *bun.DB,
	roleID uuid.UUID,
	perms []string,
) error {
	clean := make([]string, 0, len(perms))
	seen := map[string]struct{}{}
	hasWildcard := false
	for _, p := range perms {
		if p == "" {
			continue
		}
		if p == models.WildcardPermission {
			hasWildcard = true
		}
		if _, dup := seen[p]; dup {
			continue
		}
		seen[p] = struct{}{}
		clean = append(clean, p)
	}
	if hasWildcard {
		clean = []string{models.WildcardPermission}
	}
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().
			Model((*models.RolePermission)(nil)).
			Where("role_id = ?", roleID).
			Exec(ctx); err != nil {
			return err
		}
		if len(clean) == 0 {
			return nil
		}
		rows := make([]models.RolePermission, len(clean))
		for i, p := range clean {
			rows[i] = models.RolePermission{RoleID: roleID, Permission: p}
		}
		_, err := tx.NewInsert().Model(&rows).Exec(ctx)
		return err
	})
}
