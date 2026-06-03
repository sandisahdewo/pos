import { apiFetch } from './client';

export type PromotionPayload = Record<string, unknown>;
export type PromotionRecord = Record<string, unknown>;

export function listPromotions(): Promise<PromotionRecord[]> {
  return apiFetch<PromotionRecord[]>('/api/promotions');
}
export function createPromotion(input: PromotionPayload): Promise<PromotionRecord> {
  return apiFetch<PromotionRecord>('/api/promotions', { method: 'POST', body: input });
}
export function updatePromotion(id: string, input: PromotionPayload): Promise<PromotionRecord> {
  return apiFetch<PromotionRecord>(`/api/promotions/${id}`, { method: 'PATCH', body: input });
}
export function deletePromotion(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/promotions/${id}`, { method: 'DELETE' });
}
export function incrementPromotionUsage(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/promotions/${id}/usage`, { method: 'POST' });
}
