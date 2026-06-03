import { apiFetch } from './client';

export type BatchPayload = Record<string, unknown>;
export type BatchRecord = Record<string, unknown>;

export function listBatches(params?: {
  productId?: string;
  locationId?: string;
  supplierId?: string;
  sourcePurchaseOrderId?: string;
}): Promise<BatchRecord[]> {
  const q = new URLSearchParams();
  if (params?.productId) q.set('productId', params.productId);
  if (params?.locationId) q.set('locationId', params.locationId);
  if (params?.supplierId) q.set('supplierId', params.supplierId);
  if (params?.sourcePurchaseOrderId) q.set('sourcePurchaseOrderId', params.sourcePurchaseOrderId);
  const qs = q.toString();
  return apiFetch<BatchRecord[]>(`/api/batches${qs ? `?${qs}` : ''}`);
}
export function createBatch(input: BatchPayload): Promise<BatchRecord> {
  return apiFetch<BatchRecord>('/api/batches', { method: 'POST', body: input });
}
// Partial update — only sends the fields the caller wants to change.
export function updateBatch(
  id: string,
  patch: { qtyRemaining?: number; locationId?: string; expiresAt?: string; notes?: string }
): Promise<BatchRecord> {
  return apiFetch<BatchRecord>(`/api/batches/${id}`, { method: 'PATCH', body: patch });
}
