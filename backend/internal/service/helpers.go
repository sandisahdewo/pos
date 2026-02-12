package service

import (
	"fmt"

	"pos/internal/database/sqlc"
	"pos/internal/model"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func numericToFloat64(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	f, _ := n.Float64Value()
	return f.Float64
}

func float64ToNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	n.Scan(fmt.Sprintf("%g", f))
	return n
}

func toUserResponse(u sqlc.User) model.UserResponse {
	return model.UserResponse{
		ID:              u.ID,
		TenantID:        u.TenantID,
		Email:           u.Email,
		FirstName:       u.FirstName,
		LastName:        u.LastName,
		IsEmailVerified: u.IsEmailVerified,
		IsActive:        u.IsActive,
		CreatedAt:       u.CreatedAt.Time,
		UpdatedAt:       u.UpdatedAt.Time,
	}
}

func toStoreResponse(s sqlc.Store) model.StoreResponse {
	return model.StoreResponse{
		ID:        s.ID,
		TenantID:  s.TenantID,
		Name:      s.Name,
		Address:   s.Address.String,
		Phone:     s.Phone.String,
		IsActive:  s.IsActive,
		CreatedAt: s.CreatedAt.Time,
		UpdatedAt: s.UpdatedAt.Time,
	}
}

func toStoreResponses(stores []sqlc.Store) []model.StoreResponse {
	result := make([]model.StoreResponse, len(stores))
	for i, s := range stores {
		result[i] = toStoreResponse(s)
	}
	return result
}

func toRoleResponse(r sqlc.Role) model.RoleResponse {
	return model.RoleResponse{
		ID:              r.ID,
		TenantID:        r.TenantID,
		Name:            r.Name,
		Description:     r.Description.String,
		IsSystemDefault: r.IsSystemDefault,
		CreatedAt:       r.CreatedAt.Time,
		UpdatedAt:       r.UpdatedAt.Time,
	}
}

func toRoleResponses(roles []sqlc.Role) []model.RoleResponse {
	result := make([]model.RoleResponse, len(roles))
	for i, r := range roles {
		result[i] = toRoleResponse(r)
	}
	return result
}

func toFeatureResponse(f sqlc.Feature) model.FeatureResponse {
	var parentID *uuid.UUID
	if f.ParentID.Valid {
		id := uuid.UUID(f.ParentID.Bytes)
		parentID = &id
	}
	return model.FeatureResponse{
		ID:        f.ID,
		ParentID:  parentID,
		Name:      f.Name,
		Slug:      f.Slug,
		Module:    f.Module,
		Actions:   f.Actions,
		SortOrder: f.SortOrder,
	}
}

func toInvitationResponse(inv sqlc.Invitation) model.InvitationResponse {
	return model.InvitationResponse{
		ID:        inv.ID,
		TenantID:  inv.TenantID,
		InvitedBy: inv.InvitedBy,
		Email:     inv.Email,
		RoleID:    inv.RoleID,
		StoreIDs:  inv.StoreIds,
		Status:    inv.Status,
		ExpiresAt: inv.ExpiresAt.Time,
		CreatedAt: inv.CreatedAt.Time,
		UpdatedAt: inv.UpdatedAt.Time,
	}
}

func toPermissionResponse(p sqlc.GetRolePermissionsRow) model.PermissionResponse {
	return model.PermissionResponse{
		ID:            p.ID,
		FeatureID:     p.FeatureID,
		FeatureSlug:   p.FeatureSlug,
		FeatureName:   p.FeatureName,
		FeatureModule: p.FeatureModule,
		Actions:       p.Actions,
	}
}

func toCategoryResponse(c sqlc.Category) model.CategoryResponse {
	return model.CategoryResponse{
		ID:          c.ID,
		TenantID:    c.TenantID,
		Name:        c.Name,
		Description: c.Description.String,
		PricingMode: c.PricingMode.String,
		MarkupValue: numericToFloat64(c.MarkupValue),
		IsActive:    c.IsActive,
		CreatedAt:   c.CreatedAt.Time,
		UpdatedAt:   c.UpdatedAt.Time,
	}
}

func toCategoryResponses(categories []sqlc.Category) []model.CategoryResponse {
	result := make([]model.CategoryResponse, len(categories))
	for i, c := range categories {
		result[i] = toCategoryResponse(c)
	}
	return result
}

func toUnitResponse(u sqlc.Unit) model.UnitResponse {
	return model.UnitResponse{
		ID:          u.ID,
		TenantID:    u.TenantID,
		Name:        u.Name,
		Description: u.Description.String,
		IsActive:    u.IsActive,
		CreatedAt:   u.CreatedAt.Time,
		UpdatedAt:   u.UpdatedAt.Time,
	}
}

func toUnitResponses(units []sqlc.Unit) []model.UnitResponse {
	result := make([]model.UnitResponse, len(units))
	for i, u := range units {
		result[i] = toUnitResponse(u)
	}
	return result
}

func toVariantResponse(v sqlc.Variant) model.VariantResponse {
	return model.VariantResponse{
		ID:          v.ID,
		TenantID:    v.TenantID,
		Name:        v.Name,
		Description: v.Description.String,
		IsActive:    v.IsActive,
		CreatedAt:   v.CreatedAt.Time,
		UpdatedAt:   v.UpdatedAt.Time,
	}
}

func toVariantResponses(variants []sqlc.Variant) []model.VariantResponse {
	result := make([]model.VariantResponse, len(variants))
	for i, v := range variants {
		result[i] = toVariantResponse(v)
	}
	return result
}

func toVariantValueResponse(vv sqlc.VariantValue) model.VariantValueResponse {
	return model.VariantValueResponse{
		ID:        vv.ID,
		VariantID: vv.VariantID,
		Value:     vv.Value,
		SortOrder: vv.SortOrder,
		IsActive:  vv.IsActive,
		CreatedAt: vv.CreatedAt.Time,
		UpdatedAt: vv.UpdatedAt.Time,
	}
}

func toVariantValueResponses(values []sqlc.VariantValue) []model.VariantValueResponse {
	result := make([]model.VariantValueResponse, len(values))
	for i, vv := range values {
		result[i] = toVariantValueResponse(vv)
	}
	return result
}

func toUnitConversionResponse(uc sqlc.GetUnitConversionsByTenantRow) model.UnitConversionResponse {
	return model.UnitConversionResponse{
		ID:               uc.ID,
		TenantID:         uc.TenantID,
		FromUnitID:       uc.FromUnitID,
		ToUnitID:         uc.ToUnitID,
		FromUnitName:     uc.FromUnitName,
		ToUnitName:       uc.ToUnitName,
		ConversionFactor: numericToFloat64(uc.ConversionFactor),
		CreatedAt:        uc.CreatedAt.Time,
		UpdatedAt:        uc.UpdatedAt.Time,
	}
}

func toUnitConversionResponses(conversions []sqlc.GetUnitConversionsByTenantRow) []model.UnitConversionResponse {
	result := make([]model.UnitConversionResponse, len(conversions))
	for i, uc := range conversions {
		result[i] = toUnitConversionResponse(uc)
	}
	return result
}

func toWarehouseResponse(w sqlc.Warehouse) model.WarehouseResponse {
	return model.WarehouseResponse{
		ID:        w.ID,
		TenantID:  w.TenantID,
		Name:      w.Name,
		Address:   w.Address.String,
		Phone:     w.Phone.String,
		IsActive:  w.IsActive,
		CreatedAt: w.CreatedAt.Time,
		UpdatedAt: w.UpdatedAt.Time,
	}
}

func toWarehouseResponses(warehouses []sqlc.Warehouse) []model.WarehouseResponse {
	result := make([]model.WarehouseResponse, len(warehouses))
	for i, w := range warehouses {
		result[i] = toWarehouseResponse(w)
	}
	return result
}

func toSupplierResponse(s sqlc.Supplier) model.SupplierResponse {
	return model.SupplierResponse{
		ID:          s.ID,
		TenantID:    s.TenantID,
		Name:        s.Name,
		ContactName: s.ContactName.String,
		Email:       s.Email.String,
		Phone:       s.Phone.String,
		Address:     s.Address.String,
		IsActive:    s.IsActive,
		CreatedAt:   s.CreatedAt.Time,
		UpdatedAt:   s.UpdatedAt.Time,
	}
}

func toSupplierResponses(suppliers []sqlc.Supplier) []model.SupplierResponse {
	result := make([]model.SupplierResponse, len(suppliers))
	for i, s := range suppliers {
		result[i] = toSupplierResponse(s)
	}
	return result
}

// Product converters

func toProductResponseFromRow(p sqlc.GetProductByIDRow) model.ProductResponse {
	return model.ProductResponse{
		ID:           p.ID,
		TenantID:     p.TenantID,
		CategoryID:   p.CategoryID,
		CategoryName: p.CategoryName,
		Name:         p.Name,
		Description:  p.Description.String,
		HasVariants:  p.HasVariants,
		SellMethod:   string(p.SellMethod),
		Status:       string(p.Status),
		TaxRate:      numericToFloat64(p.TaxRate),
		DiscountRate: numericToFloat64(p.DiscountRate),
		MinQuantity:  numericToFloat64(p.MinQuantity),
		MaxQuantity:  numericToFloat64(p.MaxQuantity),
		PricingMode:  p.PricingMode.String,
		MarkupValue:  numericToFloat64(p.MarkupValue),
		FixedPrice:   numericToFloat64(p.FixedPrice),
		IsActive:     p.IsActive,
		CreatedAt:    p.CreatedAt.Time,
		UpdatedAt:    p.UpdatedAt.Time,
	}
}

func toProductResponseFromListRow(p sqlc.GetProductsByTenantRow) model.ProductResponse {
	return model.ProductResponse{
		ID:           p.ID,
		TenantID:     p.TenantID,
		CategoryID:   p.CategoryID,
		CategoryName: p.CategoryName,
		Name:         p.Name,
		Description:  p.Description.String,
		HasVariants:  p.HasVariants,
		SellMethod:   string(p.SellMethod),
		Status:       string(p.Status),
		TaxRate:      numericToFloat64(p.TaxRate),
		DiscountRate: numericToFloat64(p.DiscountRate),
		MinQuantity:  numericToFloat64(p.MinQuantity),
		MaxQuantity:  numericToFloat64(p.MaxQuantity),
		PricingMode:  p.PricingMode.String,
		MarkupValue:  numericToFloat64(p.MarkupValue),
		FixedPrice:   numericToFloat64(p.FixedPrice),
		IsActive:     p.IsActive,
		CreatedAt:    p.CreatedAt.Time,
		UpdatedAt:    p.UpdatedAt.Time,
	}
}

func toProductResponses(products []sqlc.GetProductsByTenantRow) []model.ProductResponse {
	result := make([]model.ProductResponse, len(products))
	for i, p := range products {
		result[i] = toProductResponseFromListRow(p)
	}
	return result
}

func toProductResponseFromCategoryRow(p sqlc.GetProductsByTenantAndCategoryRow) model.ProductResponse {
	return model.ProductResponse{
		ID:           p.ID,
		TenantID:     p.TenantID,
		CategoryID:   p.CategoryID,
		CategoryName: p.CategoryName,
		Name:         p.Name,
		Description:  p.Description.String,
		HasVariants:  p.HasVariants,
		SellMethod:   string(p.SellMethod),
		Status:       string(p.Status),
		TaxRate:      numericToFloat64(p.TaxRate),
		DiscountRate: numericToFloat64(p.DiscountRate),
		MinQuantity:  numericToFloat64(p.MinQuantity),
		MaxQuantity:  numericToFloat64(p.MaxQuantity),
		PricingMode:  p.PricingMode.String,
		MarkupValue:  numericToFloat64(p.MarkupValue),
		FixedPrice:   numericToFloat64(p.FixedPrice),
		IsActive:     p.IsActive,
		CreatedAt:    p.CreatedAt.Time,
		UpdatedAt:    p.UpdatedAt.Time,
	}
}

func toProductResponsesFromCategoryRows(products []sqlc.GetProductsByTenantAndCategoryRow) []model.ProductResponse {
	result := make([]model.ProductResponse, len(products))
	for i, p := range products {
		result[i] = toProductResponseFromCategoryRow(p)
	}
	return result
}

func toProductVariantResponse(v sqlc.GetProductVariantsRow) model.ProductVariantResponse {
	return model.ProductVariantResponse{
		ID:          v.ID,
		ProductID:   v.ProductID,
		SKU:         v.Sku,
		Barcode:     v.Barcode.String,
		UnitID:      v.UnitID,
		UnitName:    v.UnitName,
		RetailPrice: numericToFloat64(v.RetailPrice),
		IsActive:    v.IsActive,
		CreatedAt:   v.CreatedAt.Time,
		UpdatedAt:   v.UpdatedAt.Time,
		Values:      []model.ProductVariantValueResponse{},
		Images:      []model.ProductVariantImageResponse{},
		PriceTiers:  []model.PriceTierResponse{},
	}
}

func toProductVariantValueResponse(v sqlc.GetProductVariantValuesRow) model.ProductVariantValueResponse {
	return model.ProductVariantValueResponse{
		ID:             v.ID,
		VariantValueID: v.VariantValueID,
		VariantID:      v.VariantID,
		VariantName:    v.VariantName,
		Value:          v.Value,
	}
}

func toProductVariantValueResponses(values []sqlc.GetProductVariantValuesRow) []model.ProductVariantValueResponse {
	result := make([]model.ProductVariantValueResponse, len(values))
	for i, v := range values {
		result[i] = toProductVariantValueResponse(v)
	}
	return result
}

func toProductImageResponse(img sqlc.ProductImage) model.ProductImageResponse {
	return model.ProductImageResponse{
		ID:        img.ID,
		ProductID: img.ProductID,
		ImageURL:  img.ImageUrl,
		SortOrder: img.SortOrder,
		CreatedAt: img.CreatedAt.Time,
	}
}

func toProductImageResponses(images []sqlc.ProductImage) []model.ProductImageResponse {
	result := make([]model.ProductImageResponse, len(images))
	for i, img := range images {
		result[i] = toProductImageResponse(img)
	}
	return result
}

func toProductVariantImageResponse(img sqlc.ProductVariantImage) model.ProductVariantImageResponse {
	return model.ProductVariantImageResponse{
		ID:               img.ID,
		ProductVariantID: img.ProductVariantID,
		ImageURL:         img.ImageUrl,
		SortOrder:        img.SortOrder,
		CreatedAt:        img.CreatedAt.Time,
	}
}

func toProductVariantImageResponses(images []sqlc.ProductVariantImage) []model.ProductVariantImageResponse {
	result := make([]model.ProductVariantImageResponse, len(images))
	for i, img := range images {
		result[i] = toProductVariantImageResponse(img)
	}
	return result
}

func toPriceTierResponse(pt sqlc.PriceTier) model.PriceTierResponse {
	var productID *uuid.UUID
	if pt.ProductID.Valid {
		id := uuid.UUID(pt.ProductID.Bytes)
		productID = &id
	}
	var variantID *uuid.UUID
	if pt.ProductVariantID.Valid {
		id := uuid.UUID(pt.ProductVariantID.Bytes)
		variantID = &id
	}
	return model.PriceTierResponse{
		ID:               pt.ID,
		ProductID:        productID,
		ProductVariantID: variantID,
		MinQuantity:      pt.MinQuantity,
		Price:            numericToFloat64(pt.Price),
		CreatedAt:        pt.CreatedAt.Time,
	}
}

func toPriceTierResponses(tiers []sqlc.PriceTier) []model.PriceTierResponse {
	result := make([]model.PriceTierResponse, len(tiers))
	for i, pt := range tiers {
		result[i] = toPriceTierResponse(pt)
	}
	return result
}

func toStockSummaryResponse(row sqlc.GetStockByProductRow) model.StockSummaryResponse {
	return model.StockSummaryResponse{
		WarehouseID:   row.WarehouseID,
		WarehouseName: row.WarehouseName,
		VariantID:     row.VariantID,
		VariantSKU:    row.VariantSku,
		CurrentStock:  numericToFloat64(row.CurrentStock),
	}
}

func toStockSummaryResponses(rows []sqlc.GetStockByProductRow) []model.StockSummaryResponse {
	result := make([]model.StockSummaryResponse, len(rows))
	for i, r := range rows {
		result[i] = toStockSummaryResponse(r)
	}
	return result
}

func toStockLedgerEntryResponse(entry sqlc.GetStockLedgerEntriesRow) model.StockLedgerEntryResponse {
	var refID *uuid.UUID
	if entry.ReferenceID.Valid {
		id := uuid.UUID(entry.ReferenceID.Bytes)
		refID = &id
	}
	return model.StockLedgerEntryResponse{
		ID:               entry.ID,
		TenantID:         entry.TenantID,
		ProductVariantID: entry.ProductVariantID,
		WarehouseID:      entry.WarehouseID,
		Quantity:         numericToFloat64(entry.Quantity),
		UnitID:           entry.UnitID,
		UnitName:         entry.UnitName,
		Reason:           string(entry.Reason),
		ReferenceType:    entry.ReferenceType.String,
		ReferenceID:      refID,
		Notes:            entry.Notes.String,
		CreatedAt:        entry.CreatedAt.Time,
	}
}

func toStockLedgerEntryResponses(entries []sqlc.GetStockLedgerEntriesRow) []model.StockLedgerEntryResponse {
	result := make([]model.StockLedgerEntryResponse, len(entries))
	for i, e := range entries {
		result[i] = toStockLedgerEntryResponse(e)
	}
	return result
}
