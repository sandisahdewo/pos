import { apiFetch } from './client';

// Pass-through types — the PO store is the source of truth for the nested
// shape (lines + payments). Backend serializes/deserializes the same JSON
// keys; we don't need a separate typed schema here.

export type PurchaseOrderPayload = Record<string, unknown>;
export type PurchaseOrderRecord = Record<string, unknown>;

export function listPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
  return apiFetch<PurchaseOrderRecord[]>('/api/purchase-orders');
}

export function createPurchaseOrder(input: PurchaseOrderPayload): Promise<PurchaseOrderRecord> {
  return apiFetch<PurchaseOrderRecord>('/api/purchase-orders', {
    method: 'POST',
    body: input
  });
}

export function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderPayload
): Promise<PurchaseOrderRecord> {
  return apiFetch<PurchaseOrderRecord>(`/api/purchase-orders/${id}`, {
    method: 'PATCH',
    body: input
  });
}

export function deletePurchaseOrder(id: string): Promise<void> {
  return apiFetch<void>(`/api/purchase-orders/${id}`, { method: 'DELETE' });
}
