package handlers

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/sandisahdewo/pos/backend/internal/models"
	"github.com/uptrace/bun"
)

// loadProducts fetches all products and assembles their child entities. One
// query per child table for the entire batch, then in-memory grouping by
// product_id. Avoids per-product N+1 across the list page.
func loadProducts(ctx context.Context, db *bun.DB) ([]models.Product, error) {
	var products []models.Product
	if err := db.NewSelect().Model(&products).Order("name ASC").Scan(ctx); err != nil {
		return nil, err
	}
	if len(products) == 0 {
		return products, nil
	}
	ids := make([]uuid.UUID, len(products))
	idx := make(map[uuid.UUID]int, len(products))
	for i := range products {
		ids[i] = products[i].ID
		idx[products[i].ID] = i
		products[i].EnsureSlices()
	}

	if err := attachAttributes(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachPackagings(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachSuppliers(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachVariants(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachExtras(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachPricesAndComponents(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	return products, nil
}

func loadProduct(ctx context.Context, db *bun.DB, id uuid.UUID) (*models.Product, error) {
	var p models.Product
	if err := db.NewSelect().Model(&p).Where("id = ?", id).Scan(ctx); err != nil {
		return nil, err
	}
	p.EnsureSlices()
	products := []models.Product{p}
	ids := []uuid.UUID{id}
	idx := map[uuid.UUID]int{id: 0}
	if err := attachAttributes(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachPackagings(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachSuppliers(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachVariants(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachExtras(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	if err := attachPricesAndComponents(ctx, db, ids, products, idx); err != nil {
		return nil, err
	}
	return &products[0], nil
}

func attachAttributes(
	ctx context.Context, db *bun.DB,
	ids []uuid.UUID, products []models.Product, idx map[uuid.UUID]int,
) error {
	var rows []models.ProductAttributeRow
	if err := db.NewSelect().Model(&rows).
		Where("product_id IN (?)", bun.In(ids)).
		Order("position ASC, name ASC").Scan(ctx); err != nil {
		return err
	}
	for _, r := range rows {
		i := idx[r.ProductID]
		products[i].Attributes = append(products[i].Attributes, models.ProductAttribute{
			ID:     r.ID,
			Name:   r.Name,
			Values: append([]string{}, r.Values...),
		})
	}
	return nil
}

func attachPackagings(
	ctx context.Context, db *bun.DB,
	ids []uuid.UUID, products []models.Product, idx map[uuid.UUID]int,
) error {
	var rows []models.ProductPackagingRow
	if err := db.NewSelect().Model(&rows).
		Where("product_id IN (?)", bun.In(ids)).
		Order("position ASC").Scan(ctx); err != nil {
		return err
	}
	for _, r := range rows {
		i := idx[r.ProductID]
		products[i].Packagings = append(products[i].Packagings, models.ProductPackaging{
			ID:      r.ID,
			UnitID:  r.UnitID.String(),
			Factor:  r.Factor,
			Prices:  []models.PricelistEntry{},
			Barcode: r.Barcode,
		})
	}
	return nil
}

func attachSuppliers(
	ctx context.Context, db *bun.DB,
	ids []uuid.UUID, products []models.Product, idx map[uuid.UUID]int,
) error {
	var rows []models.ProductSupplierRow
	if err := db.NewSelect().Model(&rows).
		Where("product_id IN (?)", bun.In(ids)).
		Order("is_primary DESC").Scan(ctx); err != nil {
		return err
	}
	for _, r := range rows {
		i := idx[r.ProductID]
		products[i].Suppliers = append(products[i].Suppliers, models.ProductSupplier{
			ID:           r.ID,
			SupplierID:   r.SupplierID,
			IsPrimary:    r.IsPrimary,
			UnitCost:     r.UnitCost,
			LeadTimeDays: r.LeadTimeDays,
			SupplierSKU:  r.SupplierSKU,
			MinOrderQty:  r.MinOrderQty,
			Notes:        r.Notes,
		})
	}
	return nil
}

func attachVariants(
	ctx context.Context, db *bun.DB,
	ids []uuid.UUID, products []models.Product, idx map[uuid.UUID]int,
) error {
	var rows []models.ProductVariantRow
	if err := db.NewSelect().Model(&rows).
		Where("product_id IN (?)", bun.In(ids)).
		Order("position ASC").Scan(ctx); err != nil {
		return err
	}
	for _, r := range rows {
		i := idx[r.ProductID]
		values := r.Values
		if values == nil {
			values = map[string]string{}
		}
		products[i].Variants = append(products[i].Variants, models.ProductVariant{
			ID:             r.ID,
			Name:           r.Name,
			PrintName:      r.PrintName,
			SKU:            r.SKU,
			Cost:           r.Cost,
			Prices:         []models.PricelistEntry{},
			Barcode:        r.Barcode,
			Values:         values,
			ImageURL:       r.ImageURL,
			Components:     []models.CompositeComponent{},
			ProductionMode: r.ProductionMode,
		})
	}
	return nil
}

func attachExtras(
	ctx context.Context, db *bun.DB,
	ids []uuid.UUID, products []models.Product, idx map[uuid.UUID]int,
) error {
	var rows []models.ProductExtraRow
	if err := db.NewSelect().Model(&rows).
		Where("product_id IN (?)", bun.In(ids)).
		Order("position ASC").Scan(ctx); err != nil {
		return err
	}
	for _, r := range rows {
		i := idx[r.ProductID]
		products[i].Extras = append(products[i].Extras, models.ProductExtra{
			ID:         r.ID,
			Name:       r.Name,
			PriceDelta: r.PriceDelta,
			Components: []models.CompositeComponent{},
		})
	}
	return nil
}

// attachPricesAndComponents pulls price+tier+component rows, then routes each
// to the right slot (product-level, variant-level, packaging-level, extra-level).
func attachPricesAndComponents(
	ctx context.Context, db *bun.DB,
	ids []uuid.UUID, products []models.Product, idx map[uuid.UUID]int,
) error {
	var priceRows []models.ProductPriceRow
	if err := db.NewSelect().Model(&priceRows).
		Where("product_id IN (?)", bun.In(ids)).Scan(ctx); err != nil {
		return err
	}
	priceByID := make(map[uuid.UUID]*models.PricelistEntry, len(priceRows))
	// Bucket prices by their parent. For each price, accumulate tiers later.
	pricesByVariant := map[uuid.UUID][]*models.PricelistEntry{}
	pricesByPackaging := map[uuid.UUID][]*models.PricelistEntry{}
	pricesByProduct := map[uuid.UUID][]*models.PricelistEntry{}
	for i := range priceRows {
		r := &priceRows[i]
		entry := &models.PricelistEntry{
			PricelistID: r.PricelistID,
			Pricing:     models.PricingStrategy{Kind: r.PricingKind, Value: r.PricingValue},
			Tiers:       []models.PricingTier{},
		}
		priceByID[r.ID] = entry
		switch {
		case r.VariantID != nil:
			pricesByVariant[*r.VariantID] = append(pricesByVariant[*r.VariantID], entry)
		case r.PackagingID != nil:
			pricesByPackaging[*r.PackagingID] = append(pricesByPackaging[*r.PackagingID], entry)
		default:
			pricesByProduct[r.ProductID] = append(pricesByProduct[r.ProductID], entry)
		}
	}

	var tierRows []models.ProductPriceTierRow
	if err := db.NewSelect().Model(&tierRows).
		Join("JOIN product_prices ON product_prices.id = ppt.price_id").
		Where("product_prices.product_id IN (?)", bun.In(ids)).
		OrderExpr("min_qty ASC").Scan(ctx); err != nil {
		return err
	}
	for _, t := range tierRows {
		if entry := priceByID[t.PriceID]; entry != nil {
			entry.Tiers = append(entry.Tiers, models.PricingTier{
				MinQty:  t.MinQty,
				Pricing: models.PricingStrategy{Kind: t.PricingKind, Value: t.PricingValue},
			})
		}
	}

	// Route prices into the product / variant / packaging slots.
	for productID, entries := range pricesByProduct {
		i := idx[productID]
		products[i].Prices = derefEntries(entries)
	}
	for i := range products {
		for vi := range products[i].Variants {
			v := &products[i].Variants[vi]
			if list := pricesByVariant[v.ID]; len(list) > 0 {
				v.Prices = derefEntries(list)
			}
		}
		for pi := range products[i].Packagings {
			pk := &products[i].Packagings[pi]
			if list := pricesByPackaging[pk.ID]; len(list) > 0 {
				pk.Prices = derefEntries(list)
			}
		}
	}

	// Components: bucket by parent (variant-level, extra-level, product-level).
	var compRows []models.ProductComponentRow
	if err := db.NewSelect().Model(&compRows).
		Where("product_id IN (?)", bun.In(ids)).
		Order("position ASC").Scan(ctx); err != nil {
		return err
	}
	for _, r := range compRows {
		comp := models.CompositeComponent{
			ID:         r.ID,
			ProductID:  r.ComponentProductID,
			VariantID:  r.ComponentVariantID,
			Quantity:   r.Quantity,
			UnitID:     r.UnitID,
			UnitFactor: r.UnitFactor,
		}
		i := idx[r.ProductID]
		switch {
		case r.ParentVariantID != nil:
			pv := *r.ParentVariantID
			for vi := range products[i].Variants {
				if products[i].Variants[vi].ID == pv {
					products[i].Variants[vi].Components =
						append(products[i].Variants[vi].Components, comp)
					break
				}
			}
		case r.ExtraID != nil:
			ex := *r.ExtraID
			for ei := range products[i].Extras {
				if products[i].Extras[ei].ID == ex {
					products[i].Extras[ei].Components =
						append(products[i].Extras[ei].Components, comp)
					break
				}
			}
		default:
			products[i].Components = append(products[i].Components, comp)
		}
	}
	return nil
}

func derefEntries(in []*models.PricelistEntry) []models.PricelistEntry {
	out := make([]models.PricelistEntry, len(in))
	for i, p := range in {
		out[i] = *p
	}
	return out
}

// ─── Save (cascade upsert) ─────────────────────────────────────────────────

// saveProductChildren replaces all child rows for the product (delete + insert).
// Variants follow a diff strategy so their IDs stay stable — recipes elsewhere
// reference them. Prices and components are derived (parsed from the nested
// payload) and re-inserted with the right discriminators.
func saveProductChildren(
	ctx context.Context, tx bun.Tx, p *models.Product,
) error {
	// 1. Variants — diff so existing IDs survive (referenced by recipes).
	variantIDMap, err := syncVariants(ctx, tx, p.ID, p.Variants)
	if err != nil {
		return err
	}

	// 2. Packagings — replace. Re-insert with deterministic position and
	// return a mapping from incoming id (if any) to new DB id so nested
	// prices can target the right packaging.
	if _, err := tx.NewDelete().Model((*models.ProductPackagingRow)(nil)).
		Where("product_id = ?", p.ID).Exec(ctx); err != nil {
		return err
	}
	packagingIDMap := map[uuid.UUID]uuid.UUID{}
	for i := range p.Packagings {
		pk := &p.Packagings[i]
		unitUUID, err := uuid.Parse(pk.UnitID)
		if err != nil {
			return errBadInput("packaging unitId tidak valid")
		}
		row := models.ProductPackagingRow{
			ProductID: p.ID,
			UnitID:    unitUUID,
			Factor:    pk.Factor,
			Barcode:   strings.TrimSpace(pk.Barcode),
			Position:  i,
		}
		if _, err := tx.NewInsert().Model(&row).Exec(ctx); err != nil {
			return err
		}
		// Track old → new id mapping for prices nested under this packaging.
		old := pk.ID
		pk.ID = row.ID
		if old != uuid.Nil {
			packagingIDMap[old] = row.ID
		}
	}

	// 3. Suppliers — replace.
	if _, err := tx.NewDelete().Model((*models.ProductSupplierRow)(nil)).
		Where("product_id = ?", p.ID).Exec(ctx); err != nil {
		return err
	}
	for i := range p.Suppliers {
		s := &p.Suppliers[i]
		row := models.ProductSupplierRow{
			ProductID:    p.ID,
			SupplierID:   s.SupplierID,
			IsPrimary:    s.IsPrimary,
			UnitCost:     s.UnitCost,
			LeadTimeDays: s.LeadTimeDays,
			SupplierSKU:  strings.TrimSpace(s.SupplierSKU),
			MinOrderQty:  s.MinOrderQty,
			Notes:        strings.TrimSpace(s.Notes),
		}
		if _, err := tx.NewInsert().Model(&row).Exec(ctx); err != nil {
			return err
		}
		s.ID = row.ID
	}

	// 4. Attributes — replace.
	if _, err := tx.NewDelete().Model((*models.ProductAttributeRow)(nil)).
		Where("product_id = ?", p.ID).Exec(ctx); err != nil {
		return err
	}
	for i := range p.Attributes {
		a := &p.Attributes[i]
		row := models.ProductAttributeRow{
			ProductID: p.ID,
			Name:      strings.TrimSpace(a.Name),
			Values:    append([]string{}, a.Values...),
			Position:  i,
		}
		if _, err := tx.NewInsert().Model(&row).Exec(ctx); err != nil {
			return err
		}
		a.ID = row.ID
	}

	// 5. Extras — replace. Track old → new id for components nested below.
	if _, err := tx.NewDelete().Model((*models.ProductExtraRow)(nil)).
		Where("product_id = ?", p.ID).Exec(ctx); err != nil {
		return err
	}
	extraIDMap := map[uuid.UUID]uuid.UUID{}
	for i := range p.Extras {
		e := &p.Extras[i]
		row := models.ProductExtraRow{
			ProductID:  p.ID,
			Name:       strings.TrimSpace(e.Name),
			PriceDelta: e.PriceDelta,
			Position:   i,
		}
		if _, err := tx.NewInsert().Model(&row).Exec(ctx); err != nil {
			return err
		}
		old := e.ID
		e.ID = row.ID
		if old != uuid.Nil {
			extraIDMap[old] = row.ID
		}
	}

	// 6. Prices — replace. Walk nested structure to determine each price's
	// discriminator (product / variant / packaging level).
	if _, err := tx.NewDelete().Model((*models.ProductPriceRow)(nil)).
		Where("product_id = ?", p.ID).Exec(ctx); err != nil {
		return err
	}
	// Product-level prices.
	for _, entry := range p.Prices {
		if err := insertPriceWithTiers(ctx, tx, p.ID, nil, nil, entry); err != nil {
			return err
		}
	}
	// Variant-level (new DB IDs, since variants got upserted above).
	for _, v := range p.Variants {
		vid := v.ID
		for _, entry := range v.Prices {
			if err := insertPriceWithTiers(ctx, tx, p.ID, &vid, nil, entry); err != nil {
				return err
			}
		}
	}
	// Packaging-level.
	for _, pk := range p.Packagings {
		pkID := pk.ID
		for _, entry := range pk.Prices {
			if err := insertPriceWithTiers(ctx, tx, p.ID, nil, &pkID, entry); err != nil {
				return err
			}
		}
	}

	// 7. Components — replace, similar pattern.
	if _, err := tx.NewDelete().Model((*models.ProductComponentRow)(nil)).
		Where("product_id = ?", p.ID).Exec(ctx); err != nil {
		return err
	}
	// Product-level recipe.
	for i, c := range p.Components {
		if err := insertComponent(ctx, tx, p.ID, nil, nil, c, i); err != nil {
			return err
		}
	}
	// Variant-level recipes.
	for _, v := range p.Variants {
		vid := v.ID
		for i, c := range v.Components {
			if err := insertComponent(ctx, tx, p.ID, &vid, nil, c, i); err != nil {
				return err
			}
		}
	}
	// Extra components.
	for _, e := range p.Extras {
		eid := e.ID
		for i, c := range e.Components {
			if err := insertComponent(ctx, tx, p.ID, nil, &eid, c, i); err != nil {
				return err
			}
		}
	}

	// IDs may have been remapped — make sure the response uses the new ones.
	_ = variantIDMap
	_ = packagingIDMap
	_ = extraIDMap
	return nil
}

// syncVariants applies a DIFF — variants keep their IDs across saves so other
// products' recipes (component_variant_id) keep working. Returns a map from
// incoming variant id (the payload's id field) to its persisted DB id.
func syncVariants(
	ctx context.Context, tx bun.Tx, productID uuid.UUID, incoming []models.ProductVariant,
) (map[uuid.UUID]uuid.UUID, error) {
	idMap := map[uuid.UUID]uuid.UUID{}

	var existing []models.ProductVariantRow
	if err := tx.NewSelect().Model(&existing).
		Where("product_id = ?", productID).Scan(ctx); err != nil {
		return nil, err
	}
	existingByID := map[uuid.UUID]bool{}
	for _, r := range existing {
		existingByID[r.ID] = true
	}
	incomingByID := map[uuid.UUID]bool{}

	for i := range incoming {
		v := &incoming[i]
		row := models.ProductVariantRow{
			ID:             v.ID,
			ProductID:      productID,
			Name:           strings.TrimSpace(v.Name),
			PrintName:      strings.TrimSpace(v.PrintName),
			SKU:            strings.TrimSpace(v.SKU),
			Cost:           v.Cost,
			Barcode:        strings.TrimSpace(v.Barcode),
			ImageURL:       strings.TrimSpace(v.ImageURL),
			Values:         v.Values,
			ProductionMode: v.ProductionMode,
			Position:       i,
		}
		if row.Values == nil {
			row.Values = map[string]string{}
		}
		if v.ID != uuid.Nil && existingByID[v.ID] {
			incomingByID[v.ID] = true
			if _, err := tx.NewUpdate().Model(&row).WherePK().Exec(ctx); err != nil {
				return nil, err
			}
			idMap[v.ID] = v.ID
		} else {
			row.ID = uuid.Nil // let DB generate
			if _, err := tx.NewInsert().Model(&row).Exec(ctx); err != nil {
				return nil, err
			}
			if v.ID != uuid.Nil {
				idMap[v.ID] = row.ID
			}
			v.ID = row.ID
		}
	}

	// Delete variants that were dropped from the payload.
	for _, r := range existing {
		if incomingByID[r.ID] {
			continue
		}
		if _, err := tx.NewDelete().Model((*models.ProductVariantRow)(nil)).
			Where("id = ?", r.ID).Exec(ctx); err != nil {
			if strings.Contains(err.Error(), "violates foreign key constraint") {
				return nil, errBadInput("varian masih dipakai di resep produk lain")
			}
			return nil, err
		}
	}
	return idMap, nil
}

func insertPriceWithTiers(
	ctx context.Context, tx bun.Tx,
	productID uuid.UUID, variantID, packagingID *uuid.UUID,
	entry models.PricelistEntry,
) error {
	row := models.ProductPriceRow{
		ProductID:    productID,
		VariantID:    variantID,
		PackagingID:  packagingID,
		PricelistID:  strings.TrimSpace(entry.PricelistID),
		PricingKind:  strings.TrimSpace(entry.Pricing.Kind),
		PricingValue: entry.Pricing.Value,
	}
	if _, err := tx.NewInsert().Model(&row).Exec(ctx); err != nil {
		return err
	}
	for _, t := range entry.Tiers {
		tier := models.ProductPriceTierRow{
			PriceID:      row.ID,
			MinQty:       t.MinQty,
			PricingKind:  strings.TrimSpace(t.Pricing.Kind),
			PricingValue: t.Pricing.Value,
		}
		if _, err := tx.NewInsert().Model(&tier).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func insertComponent(
	ctx context.Context, tx bun.Tx,
	productID uuid.UUID, parentVariantID, extraID *uuid.UUID,
	c models.CompositeComponent, position int,
) error {
	row := models.ProductComponentRow{
		ProductID:          productID,
		ParentVariantID:    parentVariantID,
		ExtraID:            extraID,
		ComponentProductID: c.ProductID,
		ComponentVariantID: c.VariantID,
		Quantity:           c.Quantity,
		UnitID:             c.UnitID,
		UnitFactor:         c.UnitFactor,
		Position:           position,
	}
	_, err := tx.NewInsert().Model(&row).Exec(ctx)
	return err
}

// errBadInput tags a sentinel error so the handler can map to a 400. The
// handler layer matches via errors.As / type assertion.
type badInputError struct{ msg string }

func (e *badInputError) Error() string { return e.msg }

func errBadInput(msg string) error { return &badInputError{msg: msg} }
