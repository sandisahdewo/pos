import { apiFetch } from './client';

export type StockOpnamePayload = Record<string, unknown>;
export type StockOpnameRecord = Record<string, unknown>;

export function listStockOpnames(): Promise<StockOpnameRecord[]> {
  return apiFetch<StockOpnameRecord[]>('/api/stock-opnames');
}
export function getStockOpname(id: string): Promise<StockOpnameRecord> {
  return apiFetch<StockOpnameRecord>(`/api/stock-opnames/${id}`);
}
export function createStockOpname(input: StockOpnamePayload): Promise<StockOpnameRecord> {
  return apiFetch<StockOpnameRecord>('/api/stock-opnames', { method: 'POST', body: input });
}
export function updateStockOpname(
  id: string,
  patch: StockOpnamePayload
): Promise<StockOpnameRecord> {
  return apiFetch<StockOpnameRecord>(`/api/stock-opnames/${id}`, { method: 'PATCH', body: patch });
}
