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

func TestWarehouseService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewWarehouseService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("list warehouses returns empty initially", func(t *testing.T) {
		warehouses, err := svc.List(ctx, tenantID)
		require.NoError(t, err)
		assert.Len(t, warehouses, 0)
	})

	var newWarehouseID uuid.UUID

	t.Run("create warehouse", func(t *testing.T) {
		warehouse, err := svc.Create(ctx, tenantID, model.CreateWarehouseRequest{
			Name:    "Main Warehouse",
			Address: "100 Storage Blvd",
			Phone:   "555-0300",
		})
		require.NoError(t, err)
		require.NotNil(t, warehouse)
		assert.Equal(t, "Main Warehouse", warehouse.Name)
		assert.Equal(t, "100 Storage Blvd", warehouse.Address)
		assert.Equal(t, "555-0300", warehouse.Phone)
		assert.True(t, warehouse.IsActive)
		assert.Equal(t, tenantID, warehouse.TenantID)
		newWarehouseID = warehouse.ID
	})

	t.Run("create duplicate warehouse name fails", func(t *testing.T) {
		warehouse, err := svc.Create(ctx, tenantID, model.CreateWarehouseRequest{
			Name: "Main Warehouse",
		})
		assert.Nil(t, warehouse)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		warehouse, err := svc.GetByID(ctx, newWarehouseID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, warehouse)
		assert.Equal(t, "Main Warehouse", warehouse.Name)
		assert.Equal(t, "100 Storage Blvd", warehouse.Address)
		assert.Equal(t, "555-0300", warehouse.Phone)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		warehouse, err := svc.GetByID(ctx, newWarehouseID, fakeTenant)
		assert.Nil(t, warehouse)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent warehouse returns not found", func(t *testing.T) {
		warehouse, err := svc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, warehouse)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update warehouse", func(t *testing.T) {
		warehouse, err := svc.Update(ctx, newWarehouseID, tenantID, model.UpdateWarehouseRequest{
			Name:     "Updated Warehouse",
			Address:  "200 New Storage Ave",
			Phone:    "555-0400",
			IsActive: true,
		})
		require.NoError(t, err)
		require.NotNil(t, warehouse)
		assert.Equal(t, "Updated Warehouse", warehouse.Name)
		assert.Equal(t, "200 New Storage Ave", warehouse.Address)
		assert.Equal(t, "555-0400", warehouse.Phone)
	})

	t.Run("update warehouse with wrong tenant returns not found", func(t *testing.T) {
		warehouse, err := svc.Update(ctx, newWarehouseID, uuid.New(), model.UpdateWarehouseRequest{
			Name:     "Hack",
			IsActive: true,
		})
		assert.Nil(t, warehouse)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate warehouse", func(t *testing.T) {
		err := svc.Deactivate(ctx, newWarehouseID, tenantID)
		require.NoError(t, err)

		warehouse, err := svc.GetByID(ctx, newWarehouseID, tenantID)
		require.NoError(t, err)
		assert.False(t, warehouse.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := svc.Deactivate(ctx, newWarehouseID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
