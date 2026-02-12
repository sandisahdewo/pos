# Phase 3: Purchase Orders & Deliveries

> **Depends on**: Phase 1 (warehouses, suppliers, units) + Phase 2 (products, variants, stock ledger) fully complete
> **Blocks**: Nothing (final phase)

---

## Stage 1: Database & Code Generation (SEQUENTIAL)

### 1.1 Create purchase order migration files
- **Assignee**: Backend
- **Parallel**: NO (must complete before 1.2)
- **Files to create**:
  - `backend/migrations/000026_create_purchase_orders.up.sql` + `.down.sql`
    - ENUM: po_status (draft, sent, partial, delivered, cancelled)
    - purchase_orders: id, tenant_id FK, warehouse_id FK→warehouses, supplier_id FK→suppliers, order_number VARCHAR(50), status po_status DEFAULT 'draft', notes TEXT, ordered_at TIMESTAMPTZ nullable, timestamps
    - UNIQUE (tenant_id, order_number)
    - Indexes: tenant_id, (tenant_id, status), supplier_id, warehouse_id
    - purchase_order_items: id, purchase_order_id FK CASCADE, product_variant_id FK→product_variants, quantity NUMERIC(12,4), unit_id FK→units, unit_price NUMERIC(12,4), timestamps
    - Index: purchase_order_id
    - purchase_order_sequences: tenant_id PK FK→tenants, last_number INT DEFAULT 0
  - `backend/migrations/000027_create_purchase_deliveries.up.sql` + `.down.sql`
    - purchase_deliveries: id, purchase_order_id FK CASCADE, delivery_number VARCHAR(50), received_at TIMESTAMPTZ DEFAULT NOW(), notes TEXT, timestamps
    - Index: purchase_order_id
    - purchase_delivery_items: id, purchase_delivery_id FK CASCADE, purchase_order_item_id FK→purchase_order_items, delivered_quantity NUMERIC(12,4), delivered_unit_id FK→units, delivered_unit_price NUMERIC(12,4), is_accepted BOOLEAN DEFAULT TRUE, notes TEXT, timestamps
    - Indexes: purchase_delivery_id, purchase_order_item_id
- **Run**: `make migrate-up`
- **Verify**: Migrations apply cleanly

### 1.2 Create SQLC query files + generate code
- **Assignee**: Backend
- **Parallel**: NO (depends on 1.1)
- **Files to create**:
  - `backend/sqlc/queries/purchase_orders.sql`:
    - GetNextPONumber — upsert sequence: INSERT INTO purchase_order_sequences ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING last_number
    - CreatePurchaseOrder, GetPurchaseOrderByID
    - GetPurchaseOrdersByTenant (paginated, optional status filter)
    - CountPurchaseOrdersByTenant (with optional status filter)
    - UpdatePurchaseOrder (only fields editable in draft: warehouse_id, supplier_id, notes)
    - UpdatePurchaseOrderStatus (status + ordered_at timestamp for 'sent' transition)
    - CreatePurchaseOrderItem, GetPurchaseOrderItems (JOIN product_variants for SKU/name)
    - UpdatePurchaseOrderItem, DeletePurchaseOrderItem
    - DeletePurchaseOrderItems (delete all items for a PO — used when updating draft)
  - `backend/sqlc/queries/purchase_deliveries.sql`:
    - CreatePurchaseDelivery, GetPurchaseDeliveryByID
    - GetPurchaseDeliveriesByOrder
    - CreatePurchaseDeliveryItem
    - GetPurchaseDeliveryItems (JOIN purchase_order_items for original order details)
    - GetDeliveredQuantityByOrderItem — SUM(delivered_quantity) WHERE purchase_order_item_id = ? AND is_accepted = TRUE
    - CountDeliveriesByOrder
- **Run**: `make sqlc`
- **Verify**: Generated code compiles

---

## Stage 2: Backend Implementation (PARTIAL PARALLEL)

### 2.1 Model structs for purchase orders & deliveries
- **Assignee**: Backend-A or Backend-B
- **Parallel**: YES — should run first or alongside 2.2-2.3
- **Files to modify**:
  - `backend/internal/model/requests.go` — add:
    - CreatePurchaseOrderRequest{WarehouseID, SupplierID, Notes, Items[]}
    - PurchaseOrderItemEntry{ProductVariantID, Quantity, UnitID, UnitPrice}
    - UpdatePurchaseOrderRequest{WarehouseID, SupplierID, Notes, Items[]}
    - CreatePurchaseDeliveryRequest{Notes, Items[]}
    - PurchaseDeliveryItemEntry{PurchaseOrderItemID, DeliveredQuantity, DeliveredUnitID, DeliveredUnitPrice, IsAccepted, Notes}
  - `backend/internal/model/responses.go` — add:
    - PurchaseOrderResponse{ID, TenantID, WarehouseID, WarehouseName, SupplierID, SupplierName, OrderNumber, Status, Notes, OrderedAt, timestamps}
    - PurchaseOrderDetailResponse{+Items[], +Deliveries[]}
    - PurchaseOrderItemResponse{ID, ProductVariantID, VariantSKU, ProductName, Quantity, UnitID, UnitName, UnitPrice, DeliveredQuantity}
    - PurchaseDeliveryResponse{ID, PurchaseOrderID, DeliveryNumber, ReceivedAt, Notes, timestamps}
    - PurchaseDeliveryDetailResponse{+Items[]}
    - PurchaseDeliveryItemResponse{ID, PurchaseOrderItemID, VariantSKU, ProductName, OrderedQuantity, DeliveredQuantity, DeliveredUnitID, DeliveredUnitName, DeliveredUnitPrice, IsAccepted, Notes}
  - `backend/internal/service/helpers.go` — add converter functions:
    - toPurchaseOrderResponse, toPurchaseOrderItemResponse, toPurchaseDeliveryResponse, toPurchaseDeliveryItemResponse

### 2.2 Purchase order service + handler
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 2.3 (after 2.1)
- **Create**: `backend/internal/service/purchase_order.go`
  - PurchaseOrderService{pool, queries}
  - List(ctx, tenantID, status, pagination) → PaginatedResponse
  - GetByID(ctx, id, tenantID) → PurchaseOrderDetailResponse
    - Includes items + delivery summary (count, total delivered per item)
  - Create(ctx, tenantID, req) → PurchaseOrderDetailResponse
    - TRANSACTION: generate order_number via GetNextPONumber (format: PO-{number}), create PO, create items
  - Update(ctx, id, tenantID, req) → PurchaseOrderDetailResponse
    - Only if status == 'draft'. TRANSACTION: update PO, delete old items, create new items
  - Send(ctx, id, tenantID) → PurchaseOrderResponse
    - Transition: draft → sent. Set ordered_at = NOW()
    - Validate: status must be 'draft'
  - Cancel(ctx, id, tenantID) → PurchaseOrderResponse
    - Transition: draft|sent → cancelled
    - Validate: status must be 'draft' or 'sent' (cannot cancel if any deliveries exist)
- **Create**: `backend/internal/handler/purchase_order.go`
  - PurchaseOrderHandler{po}
  - List, GetByID, Create, Update, Send, Cancel

### 2.3 Purchase delivery service + handler (COMPLEX)
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 2.2 (after 2.1)
- **Create**: `backend/internal/service/purchase_delivery.go`
  - PurchaseDeliveryService{pool, queries, stock *StockService}
  - Create(ctx, tenantID, poID, req) → PurchaseDeliveryDetailResponse
    - COMPLEX TRANSACTION:
      1. Verify PO belongs to tenant
      2. Verify PO status is 'sent' or 'partial'
      3. Generate delivery_number (format: PO-{number}-D{seq})
      4. Create delivery record
      5. For each delivery item:
         a. Verify purchase_order_item belongs to this PO
         b. Create delivery item record
         c. If is_accepted: create stock_ledger entry (reason: purchase_delivery, reference: delivery_id)
            - Handle unit conversion if delivered_unit != ordered_unit
      6. Check if ALL PO items are fully delivered:
         - For each PO item, SUM delivered_quantity (accepted) vs ordered quantity
         - If all fully delivered → update PO status to 'delivered'
         - If some delivered → update PO status to 'partial'
  - GetByID(ctx, deliveryID, tenantID) → PurchaseDeliveryDetailResponse
    - Verify via PO tenant ownership
  - ListByOrder(ctx, poID, tenantID) → []PurchaseDeliveryResponse
- **Create**: `backend/internal/handler/purchase_delivery.go`
  - PurchaseDeliveryHandler{delivery}
  - Create, GetByID, ListByOrder

### 2.4 Router + DI wiring for Phase 3
- **Assignee**: Backend
- **Parallel**: NO (must run after 2.2-2.3 complete)
- **Files to modify**:
  - `backend/internal/router/router.go`
    - Add to Handlers: PurchaseOrder, PurchaseDelivery
    - Routes:
      - /purchase-orders — CRUD with RequirePermission("purchase.order", *)
        - GET / — list (with optional ?status= query param)
        - POST / — create
        - GET /{id} — detail
        - PUT /{id} — update (draft only)
        - POST /{id}/send — transition to sent
        - POST /{id}/cancel — transition to cancelled
      - /purchase-orders/{id}/deliveries — nested under PO
        - GET / — list deliveries for PO (RequirePermission "purchase.delivery" "read")
        - POST / — create delivery (RequirePermission "purchase.delivery" "create")
        - GET /{deliveryId} — delivery detail
  - `backend/cmd/api/main.go`
    - Instantiate PurchaseOrderService, PurchaseDeliveryService (inject StockService)
    - Instantiate handlers, add to router.Handlers
- **Verify**: `make test-backend`, all routes registered

---

## Stage 3: Frontend (PARALLEL OK — per page)

### 3.1 Frontend types for purchase orders
- **Assignee**: Frontend
- **Parallel**: YES — should run first
- **File to modify**: `frontend/src/lib/api/types.ts`
- **Add**: PurchaseOrderResponse, PurchaseOrderDetailResponse, PurchaseOrderItemResponse, PurchaseDeliveryResponse, PurchaseDeliveryDetailResponse, PurchaseDeliveryItemResponse, CreatePurchaseOrderRequest, PurchaseOrderItemEntry, UpdatePurchaseOrderRequest, CreatePurchaseDeliveryRequest, PurchaseDeliveryItemEntry

### 3.2 Purchase order list page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 3.3-3.5
- **Create**: `frontend/src/routes/(app)/purchase/orders/+page.svelte`
- **Remove**: existing `frontend/src/routes/(app)/purchase/products/` placeholder
- **Features**:
  - Status filter tabs (plain HTML buttons): All, Draft, Sent, Partial, Delivered, Cancelled
  - Table: Order Number, Supplier, Warehouse, Status (badge), Ordered At, Created
  - "Create PO" button → /purchase/orders/create
  - Row click → /purchase/orders/[id]

### 3.3 Purchase order create page
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 3.2, 3.4-3.5
- **Create**: `frontend/src/routes/(app)/purchase/orders/create/+page.svelte`
- **Features**:
  - Select warehouse (dropdown from /warehouses API)
  - Select supplier (dropdown from /suppliers API)
  - Notes textarea
  - Line items section:
    - Product variant search/select (search by name/SKU, show product name + variant details)
    - Quantity input (number)
    - Unit select (from variant's available units via category)
    - Unit price input (number)
    - Add/remove item rows
    - Total calculation display
  - "Save as Draft" button → POST /purchase-orders
  - After save, redirect to /purchase/orders/[id]

### 3.4 Purchase order detail page
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 3.2-3.3, 3.5
- **Create**: `frontend/src/routes/(app)/purchase/orders/[id]/+page.svelte`
- **Features**:
  - Header: order number, supplier name, warehouse name, status badge, ordered_at
  - Action buttons (conditional on status):
    - Draft: "Edit" (inline or navigate), "Send to Supplier", "Cancel Order"
    - Sent: "Create Delivery", "Cancel Order"
    - Partial: "Create Delivery"
    - Delivered/Cancelled: no actions
  - Items table: Product/Variant, Ordered Qty, Unit, Unit Price, Delivered Qty, Remaining Qty
    - Highlight rows where delivered < ordered
  - Deliveries section: list of deliveries with delivery_number, received_at, item count
    - Click → expand or navigate to delivery detail

### 3.5 Purchase delivery create page
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 3.2-3.4
- **Create**: `frontend/src/routes/(app)/purchase/orders/[id]/delivery/+page.svelte`
- **Features**:
  - Header: PO order number, supplier, warehouse info
  - Notes textarea
  - Items table (pre-populated from PO items):
    - Product/Variant name + SKU
    - Ordered Quantity + Unit
    - Previously Delivered (SUM from past deliveries)
    - Remaining Quantity
    - Input: Delivered Quantity (defaults to remaining)
    - Input: Delivered Unit (select, defaults to ordered unit)
    - Input: Delivered Unit Price (defaults to ordered price)
    - Toggle: Accepted (default true)
    - Input: Notes per item
  - Highlight differences: if delivered qty/unit/price differs from ordered
  - "Submit Delivery" button → POST /purchase-orders/{id}/deliveries
  - After save, redirect back to PO detail

### 3.6 Sidebar update for purchase
- **Assignee**: Frontend
- **Parallel**: NO (small change, do with any other frontend task)
- **File to modify**: `frontend/src/lib/components/Sidebar.svelte`
- **Change**: Update Purchase nav item href from `/purchase/products` to `/purchase/orders`, update feature to `purchase.order`

---

## Stage 4: Backend Tests (PARALLEL OK — per service)

Depends on Stage 2 (services wired).

### 4.0 Update test utilities for Phase 3 tables
- **Assignee**: Backend
- **Parallel**: NO (must complete before 4.1-4.2)
- **File to modify**: `backend/internal/testutil/helpers.go`
- **Changes**:
  - Add new table DDLs to `runMigrations()`: purchase_orders (with ENUM po_status), purchase_order_items, purchase_order_sequences, purchase_deliveries, purchase_delivery_items
  - Add helper: `CreateTestWarehouse(t, queries, tenantID) WarehouseResponse`
  - Add helper: `CreateTestSupplier(t, queries, tenantID) SupplierResponse`
  - Add helper: `CreateTestProductWithVariant(t, pool, queries, tenantID) (ProductResponse, ProductVariantResponse)` — creates category, unit, product with one variant (full setup chain)
- **Verify**: All Phase 1 + Phase 2 tests still pass

### 4.1 Purchase order service tests
- **Assignee**: Backend-A
- **Parallel**: YES — can run alongside 4.2
- **Create**: `backend/internal/service/purchase_order_test.go`
- **Setup per test**: Create tenant user, warehouse, supplier, product with variant
- **Test cases**:
  - `TestPurchaseOrderService_CRUD`:
    - `list returns empty initially`
    - `create draft PO` — select warehouse, supplier, add 2 items. Verify status=draft, order_number generated (PO-1), ordered_at=nil
    - `create second PO gets incremented number` — PO-2
    - `get by ID returns full detail` — PO + items + delivery summary
    - `get by ID with wrong tenant returns not found`
    - `update draft PO` — change warehouse, update items. Verify old items replaced
    - `update non-draft PO fails` — send PO first, then try update → ForbiddenError
  - `TestPurchaseOrderService_StatusTransitions`:
    - `send draft PO` — draft → sent, verify ordered_at set to ~NOW()
    - `send non-draft fails` — already sent → error
    - `cancel draft PO` — draft → cancelled
    - `cancel sent PO` — sent → cancelled (only if no deliveries)
    - `cancel delivered PO fails` — error
    - `cancel partial PO fails` — error (has deliveries)
  - `TestPurchaseOrderService_ListWithFilter`:
    - Create 3 POs (1 draft, 1 sent, 1 cancelled)
    - `list all` — returns 3
    - `list with status=draft` — returns 1
    - `list with status=sent` — returns 1
  - `TestPurchaseOrderService_Pagination`:
    - Create 5 POs, paginate (limit=2), verify metadata

### 4.2 Purchase delivery service tests (COMPLEX)
- **Assignee**: Backend-B
- **Parallel**: YES — can run alongside 4.1
- **Create**: `backend/internal/service/purchase_delivery_test.go`
- **Setup**: Create tenant, warehouse, supplier, product with variant, create + send PO with 3 items
- **Test cases**:
  - `TestPurchaseDeliveryService_Create`:
    - `create delivery for sent PO` — deliver all 3 items fully. Verify:
      - Delivery record created with delivery_number
      - Stock ledger entries created (one per accepted item, reason=purchase_delivery)
      - PO status → delivered
    - `create delivery with wrong PO tenant returns not found`
    - `create delivery for draft PO fails` — only sent/partial allowed
    - `create delivery for cancelled PO fails`
  - `TestPurchaseDeliveryService_PartialDelivery`:
    - Send PO with 3 items (qty 100 each)
    - `first partial delivery` — deliver item 1 fully (100), item 2 partially (50), skip item 3. Verify:
      - PO status → partial
      - Stock: item1=100, item2=50, item3=0
    - `second partial delivery` — deliver item 2 remaining (50), item 3 partially (30). Verify:
      - PO status → partial (item 3 not fully delivered)
      - Stock: item1=100, item2=100, item3=30
    - `final delivery` — deliver item 3 remaining (70). Verify:
      - PO status → delivered (all items fully delivered)
      - Stock: item1=100, item2=100, item3=100
  - `TestPurchaseDeliveryService_DifferentQuantitiesAndPrices`:
    - PO item: qty=100, price=$10
    - Delivery: delivered_qty=95, delivered_price=$10.50
    - Verify stock ledger uses delivered quantity (95), not ordered (100)
    - Verify delivery item records actual delivered price
  - `TestPurchaseDeliveryService_RejectedItems`:
    - Deliver 3 items, mark 1 as is_accepted=false
    - Verify: stock ledger entry NOT created for rejected item
    - Verify: PO status considers only accepted quantities for completion check
  - `TestPurchaseDeliveryService_StockLedgerIntegrity`:
    - Create delivery, verify stock ledger entry fields:
      - reason = 'purchase_delivery'
      - reference_type = 'purchase_delivery'
      - reference_id = delivery ID
      - tenant_id matches
      - quantity and unit match delivered values

---

## Stage 5: Frontend Unit Tests (PARALLEL OK)

Depends on Stage 3 (pages exist).

### 5.1 Purchase order list page test
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 5.2-5.4
- **Create**: `frontend/src/routes/(app)/purchase/orders/orders.test.ts`
- **Mock**: `vi.mock('$lib/api/client.js')`, `vi.mock('$lib/stores/auth.svelte.js')`
- **Test cases**:
  - `renders purchase orders page title`
  - `shows status filter tabs` — All, Draft, Sent, Partial, Delivered, Cancelled
  - `renders POs in table` — mock API returns PO list, verify order_number, supplier, status columns
  - `shows empty state when no POs`
  - `create PO button navigates to /purchase/orders/create`

### 5.2 Purchase order create page test
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 5.1, 5.3-5.4
- **Create**: `frontend/src/routes/(app)/purchase/orders/create/create.test.ts`
- **Test cases**:
  - `renders create PO form`
  - `warehouse select loads warehouses from API`
  - `supplier select loads suppliers from API`
  - `can add line items` — verify item row inputs (product search, qty, unit, price)
  - `can remove line items`
  - `submit creates draft PO`

### 5.3 Purchase order detail page test
- **Assignee**: Frontend-B
- **Parallel**: YES — can run alongside 5.1-5.2, 5.4
- **Create**: `frontend/src/routes/(app)/purchase/orders/[id]/detail.test.ts`
- **Test cases**:
  - `renders PO header info` — order_number, supplier, warehouse, status badge
  - `shows Send button for draft PO`
  - `shows Create Delivery button for sent PO`
  - `hides action buttons for delivered PO`
  - `renders items table with correct columns`
  - `renders deliveries section`

### 5.4 Purchase delivery page test
- **Assignee**: Frontend-A
- **Parallel**: YES — can run alongside 5.1-5.3
- **Create**: `frontend/src/routes/(app)/purchase/orders/[id]/delivery/delivery.test.ts`
- **Test cases**:
  - `renders delivery form`
  - `pre-populates items from PO` — shows ordered qty, remaining qty
  - `delivered qty defaults to remaining`
  - `accept toggle defaults to true`
  - `can change delivered qty and price per item`
  - `submit creates delivery`

---

## Stage 6: E2E Tests (SEQUENTIAL)

Depends on Stages 2 + 3 complete (full stack running). Most important phase for E2E since it tests the full procurement workflow.

### 6.1 Purchase order E2E tests
- **Assignee**: Any
- **Parallel**: NO (E2E tests run serially)
- **Create**: `frontend/tests/e2e/purchase-orders.spec.ts`
- **Setup helper**: `setupPurchaseTestData(page)` — registers admin, creates warehouse, supplier, category with units, product with variant. Returns all created data.
- **Test suites**:

  **PO Creation & List**:
  - `admin can create a draft purchase order` — navigate to /purchase/orders/create, select warehouse, supplier, add item (search product, fill qty/unit/price), save. Verify redirected to PO detail, status=Draft.
  - `PO appears in order list` — navigate to /purchase/orders, verify new PO visible with correct order_number
  - `PO list filters by status` — click "Draft" tab, verify only draft POs shown

  **PO Status Flow**:
  - `admin can send a PO` — create draft, click "Send to Supplier", verify status changes to Sent, ordered_at visible
  - `admin can cancel a draft PO` — create draft, click Cancel, verify status=Cancelled
  - `admin can cancel a sent PO` — create + send, click Cancel, verify status=Cancelled

  **Delivery Flow (CRITICAL)**:
  - `admin can create a full delivery` — create + send PO with 2 items, click "Create Delivery", fill all delivered quantities (equal to ordered), submit. Verify:
    - Delivery record visible on PO detail page
    - PO status changes to Delivered
  - `admin can create partial deliveries` — create + send PO with 2 items (qty 100 each):
    - First delivery: deliver item 1 fully (100), item 2 partially (50). Verify PO status=Partial
    - Second delivery: deliver item 2 remaining (50). Verify PO status=Delivered
  - `delivery handles different quantities and prices` — ordered qty=100 price=$10, deliver qty=95 price=$10.50. Verify delivery item shows actual delivered values, differences highlighted

  **Product Stock After Delivery**:
  - `stock page reflects delivered quantities` — after delivery, navigate to product stock page, verify stock matches delivered amounts per warehouse

---

## Stage 7: Final Verification

### 7.1 Full test suite — all phases
- **Assignee**: Any
- **Parallel**: NO
- **Steps**:
  1. `make test-backend` — all backend tests pass (Phase 1 + 2 + 3)
  2. `make test-frontend` — all frontend unit tests pass
  3. `make test-e2e` — all E2E tests pass (auth, stores, master-data, products, purchase-orders)
  4. `make test` — combined pass
  5. `make build` — Docker builds succeed
  6. Full manual workflow: register → create master data → create product → create PO → send → deliver → verify stock

---

## Parallelism Summary

```
Stage 1 (SEQUENTIAL):  1.1 → 1.2
                            ↓
Stage 2 (PARALLEL):    [2.1] then [2.2] [2.3] then [2.4]
                            ↓
Stage 3 (PARALLEL):    [3.1] then [3.2] [3.3] [3.4] [3.5] + [3.6]
                            ↓
Stage 4 (PARALLEL):    [4.0] then [4.1] [4.2]
                            ↓
Stage 5 (PARALLEL):    [5.1] [5.2] [5.3] [5.4]
                            ↓
Stage 6 (SEQUENTIAL):  6.1
                            ↓
Stage 7 (SEQUENTIAL):  7.1

Three-team split:
  Backend team:  Stages 1 → 2 → 4 (backend tests)
  Frontend team: Stage 3 → 5 (frontend tests)
  E2E:           Stage 6 (after both teams done)

Within backend:
  Backend-A: 2.2 (PO service) + 4.1 (PO tests)
  Backend-B: 2.3 (Delivery service) + 4.2 (Delivery tests — complex, most critical)

Within frontend:
  Frontend-A: 3.2 (list) + 3.5 (delivery page) + 5.1 + 5.4
  Frontend-B: 3.3 (create) + 3.4 (detail) + 5.2 + 5.3
```
