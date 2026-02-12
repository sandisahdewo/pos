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

func TestSupplierService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	svc := service.NewSupplierService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("list suppliers returns empty initially", func(t *testing.T) {
		suppliers, err := svc.List(ctx, tenantID)
		require.NoError(t, err)
		assert.Len(t, suppliers, 0)
	})

	var newSupplierID uuid.UUID

	t.Run("create supplier", func(t *testing.T) {
		supplier, err := svc.Create(ctx, tenantID, model.CreateSupplierRequest{
			Name:        "Acme Supplies",
			ContactName: "John Doe",
			Email:       "john@acme.com",
			Phone:       "555-0500",
			Address:     "500 Supplier St",
		})
		require.NoError(t, err)
		require.NotNil(t, supplier)
		assert.Equal(t, "Acme Supplies", supplier.Name)
		assert.Equal(t, "John Doe", supplier.ContactName)
		assert.Equal(t, "john@acme.com", supplier.Email)
		assert.Equal(t, "555-0500", supplier.Phone)
		assert.Equal(t, "500 Supplier St", supplier.Address)
		assert.True(t, supplier.IsActive)
		assert.Equal(t, tenantID, supplier.TenantID)
		newSupplierID = supplier.ID
	})

	t.Run("create duplicate supplier name fails", func(t *testing.T) {
		supplier, err := svc.Create(ctx, tenantID, model.CreateSupplierRequest{
			Name: "Acme Supplies",
		})
		assert.Nil(t, supplier)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		supplier, err := svc.GetByID(ctx, newSupplierID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, supplier)
		assert.Equal(t, "Acme Supplies", supplier.Name)
		assert.Equal(t, "John Doe", supplier.ContactName)
		assert.Equal(t, "john@acme.com", supplier.Email)
		assert.Equal(t, "555-0500", supplier.Phone)
		assert.Equal(t, "500 Supplier St", supplier.Address)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		supplier, err := svc.GetByID(ctx, newSupplierID, fakeTenant)
		assert.Nil(t, supplier)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent supplier returns not found", func(t *testing.T) {
		supplier, err := svc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, supplier)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update supplier", func(t *testing.T) {
		supplier, err := svc.Update(ctx, newSupplierID, tenantID, model.UpdateSupplierRequest{
			Name:        "Acme Corp",
			ContactName: "Jane Smith",
			Email:       "jane@acme.com",
			Phone:       "555-0600",
			Address:     "600 New Supplier Ave",
			IsActive:    true,
		})
		require.NoError(t, err)
		require.NotNil(t, supplier)
		assert.Equal(t, "Acme Corp", supplier.Name)
		assert.Equal(t, "Jane Smith", supplier.ContactName)
		assert.Equal(t, "jane@acme.com", supplier.Email)
		assert.Equal(t, "555-0600", supplier.Phone)
		assert.Equal(t, "600 New Supplier Ave", supplier.Address)
	})

	t.Run("update supplier with wrong tenant returns not found", func(t *testing.T) {
		supplier, err := svc.Update(ctx, newSupplierID, uuid.New(), model.UpdateSupplierRequest{
			Name:     "Hack",
			IsActive: true,
		})
		assert.Nil(t, supplier)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate supplier", func(t *testing.T) {
		err := svc.Deactivate(ctx, newSupplierID, tenantID)
		require.NoError(t, err)

		supplier, err := svc.GetByID(ctx, newSupplierID, tenantID)
		require.NoError(t, err)
		assert.False(t, supplier.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := svc.Deactivate(ctx, newSupplierID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}
