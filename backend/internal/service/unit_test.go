package service_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"pos/internal/model"
	"pos/internal/service"
	"pos/internal/testutil"
)

func TestUnitService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewUnitService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("list units returns empty initially", func(t *testing.T) {
		units, err := svc.List(ctx, tenantID)
		require.NoError(t, err)
		assert.Len(t, units, 0)
	})

	var newUnitID uuid.UUID

	t.Run("create unit", func(t *testing.T) {
		unit, err := svc.Create(ctx, tenantID, model.CreateUnitRequest{
			Name:        "Kilogram",
			Description: "Metric unit of mass",
		})
		require.NoError(t, err)
		require.NotNil(t, unit)
		assert.Equal(t, "Kilogram", unit.Name)
		assert.Equal(t, "Metric unit of mass", unit.Description)
		assert.True(t, unit.IsActive)
		assert.Equal(t, tenantID, unit.TenantID)
		newUnitID = unit.ID
	})

	t.Run("create duplicate unit name fails", func(t *testing.T) {
		unit, err := svc.Create(ctx, tenantID, model.CreateUnitRequest{
			Name: "Kilogram",
		})
		assert.Nil(t, unit)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		unit, err := svc.GetByID(ctx, newUnitID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, unit)
		assert.Equal(t, "Kilogram", unit.Name)
		assert.Equal(t, "Metric unit of mass", unit.Description)
		assert.True(t, unit.IsActive)
		assert.Equal(t, tenantID, unit.TenantID)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		unit, err := svc.GetByID(ctx, newUnitID, fakeTenant)
		assert.Nil(t, unit)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent unit returns not found", func(t *testing.T) {
		unit, err := svc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, unit)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update unit", func(t *testing.T) {
		unit, err := svc.Update(ctx, newUnitID, tenantID, model.UpdateUnitRequest{
			Name:        "Gram",
			Description: "Smaller metric unit of mass",
			IsActive:    true,
		})
		require.NoError(t, err)
		require.NotNil(t, unit)
		assert.Equal(t, "Gram", unit.Name)
		assert.Equal(t, "Smaller metric unit of mass", unit.Description)
	})

	t.Run("update unit with wrong tenant returns not found", func(t *testing.T) {
		unit, err := svc.Update(ctx, newUnitID, uuid.New(), model.UpdateUnitRequest{
			Name:     "Hack",
			IsActive: true,
		})
		assert.Nil(t, unit)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate unit", func(t *testing.T) {
		err := svc.Deactivate(ctx, newUnitID, tenantID)
		require.NoError(t, err)

		unit, err := svc.GetByID(ctx, newUnitID, tenantID)
		require.NoError(t, err)
		assert.False(t, unit.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := svc.Deactivate(ctx, newUnitID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
