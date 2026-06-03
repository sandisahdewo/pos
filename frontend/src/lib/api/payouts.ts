import { apiFetch } from './client';

export type PayoutPayload = Record<string, unknown>;
export type PayoutRecord = Record<string, unknown>;

export function listPayouts(): Promise<PayoutRecord[]> {
  return apiFetch<PayoutRecord[]>('/api/payouts');
}
export function createPayout(input: PayoutPayload): Promise<PayoutRecord> {
  return apiFetch<PayoutRecord>('/api/payouts', { method: 'POST', body: input });
}
export function deletePayout(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/payouts/${id}`, { method: 'DELETE' });
}
