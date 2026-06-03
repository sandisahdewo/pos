import { apiFetch } from './client';

export type PriceChangePayload = Record<string, unknown>;
export type PriceChangeRecord = Record<string, unknown>;

export function listPriceChanges(params?: { limit?: number }): Promise<PriceChangeRecord[]> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<PriceChangeRecord[]>(`/api/price-changes${qs ? `?${qs}` : ''}`);
}
export function createPriceChanges(items: PriceChangePayload[]): Promise<PriceChangeRecord[]> {
  return apiFetch<PriceChangeRecord[]>('/api/price-changes', {
    method: 'POST',
    body: { items }
  });
}
