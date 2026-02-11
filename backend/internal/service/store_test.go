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

func TestStoreService_CRUD(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	storeSvc := service.NewStoreService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	t.Run("list stores returns registration store", func(t *testing.T) {
		stores, err := storeSvc.List(ctx, tenantID, nil, true)
		require.NoError(t, err)
		require.Len(t, stores, 1)
		assert.True(t, stores[0].IsActive)
	})

	var newStoreID uuid.UUID

	t.Run("create store", func(t *testing.T) {
		store, err := storeSvc.Create(ctx, tenantID, model.CreateStoreRequest{
			Name:    "Branch Store",
			Address: "456 Branch Rd",
			Phone:   "555-0100",
		})
		require.NoError(t, err)
		require.NotNil(t, store)
		assert.Equal(t, "Branch Store", store.Name)
		assert.Equal(t, "456 Branch Rd", store.Address)
		assert.Equal(t, "555-0100", store.Phone)
		assert.True(t, store.IsActive)
		assert.Equal(t, tenantID, store.TenantID)
		newStoreID = store.ID
	})

	t.Run("create duplicate store name fails", func(t *testing.T) {
		store, err := storeSvc.Create(ctx, tenantID, model.CreateStoreRequest{
			Name: "Branch Store",
		})
		assert.Nil(t, store)
		require.Error(t, err)
		appErr, ok := model.IsAppError(err)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.Code)
	})

	t.Run("get by ID", func(t *testing.T) {
		store, err := storeSvc.GetByID(ctx, newStoreID, tenantID)
		require.NoError(t, err)
		require.NotNil(t, store)
		assert.Equal(t, "Branch Store", store.Name)
	})

	t.Run("get by ID with wrong tenant returns not found", func(t *testing.T) {
		fakeTenant := uuid.New()
		store, err := storeSvc.GetByID(ctx, newStoreID, fakeTenant)
		assert.Nil(t, store)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("get nonexistent store returns not found", func(t *testing.T) {
		store, err := storeSvc.GetByID(ctx, uuid.New(), tenantID)
		assert.Nil(t, store)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("update store", func(t *testing.T) {
		store, err := storeSvc.Update(ctx, newStoreID, tenantID, model.UpdateStoreRequest{
			Name:     "Updated Branch",
			Address:  "789 New Rd",
			Phone:    "555-0200",
			IsActive: true,
		})
		require.NoError(t, err)
		require.NotNil(t, store)
		assert.Equal(t, "Updated Branch", store.Name)
		assert.Equal(t, "789 New Rd", store.Address)
	})

	t.Run("update store with wrong tenant returns not found", func(t *testing.T) {
		store, err := storeSvc.Update(ctx, newStoreID, uuid.New(), model.UpdateStoreRequest{
			Name:     "Hack",
			IsActive: true,
		})
		assert.Nil(t, store)
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})

	t.Run("deactivate store", func(t *testing.T) {
		err := storeSvc.Deactivate(ctx, newStoreID, tenantID)
		require.NoError(t, err)

		store, err := storeSvc.GetByID(ctx, newStoreID, tenantID)
		require.NoError(t, err)
		assert.False(t, store.IsActive)
	})

	t.Run("deactivate with wrong tenant returns not found", func(t *testing.T) {
		err := storeSvc.Deactivate(ctx, newStoreID, uuid.New())
		require.Error(t, err)
		assert.ErrorIs(t, err, model.ErrNotFound)
	})
}

func TestStoreService_ListWithAccess(t *testing.T) {
	pool, queries := testutil.SetupTestDB(t)
	_, _, resp, _ := testutil.CreateTestUser(t, pool, queries)

	storeSvc := service.NewStoreService(queries)
	ctx := context.Background()
	tenantID := resp.User.TenantID

	// Create two additional stores
	s2, err := storeSvc.Create(ctx, tenantID, model.CreateStoreRequest{Name: "Store 2"})
	require.NoError(t, err)
	s3, err := storeSvc.Create(ctx, tenantID, model.CreateStoreRequest{Name: "Store 3"})
	require.NoError(t, err)

	t.Run("all access returns all stores", func(t *testing.T) {
		stores, err := storeSvc.List(ctx, tenantID, nil, true)
		require.NoError(t, err)
		assert.Len(t, stores, 3)
	})

	t.Run("filtered access returns only allowed stores", func(t *testing.T) {
		allowedIDs := []uuid.UUID{s2.ID}
		stores, err := storeSvc.List(ctx, tenantID, allowedIDs, false)
		require.NoError(t, err)
		assert.Len(t, stores, 1)
		assert.Equal(t, s2.ID, stores[0].ID)
	})

	t.Run("empty access returns nothing", func(t *testing.T) {
		stores, err := storeSvc.List(ctx, tenantID, []uuid.UUID{}, false)
		require.NoError(t, err)
		assert.Len(t, stores, 0)
	})

	_ = s3
}
