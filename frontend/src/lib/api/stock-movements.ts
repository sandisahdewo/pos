import { apiFetch } from './client';

export type StockMovementPayload = Record<string, unknown>;
export type StockMovementRecord = Record<string, unknown>;

export function listStockMovements(params?: {
  productId?: string;
  locationId?: string;
  batchId?: string;
  limit?: number;
}): Promise<StockMovementRecord[]> {
  const q = new URLSearchParams();
  if (params?.productId) q.set('productId', params.productId);
  if (params?.locationId) q.set('locationId', params.locationId);
  if (params?.batchId) q.set('batchId', params.batchId);
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<StockMovementRecord[]>(`/api/stock-movements${qs ? `?${qs}` : ''}`);
}
export function createStockMovement(input: StockMovementPayload): Promise<StockMovementRecord> {
  return apiFetch<StockMovementRecord>('/api/stock-movements', { method: 'POST', body: input });
}
