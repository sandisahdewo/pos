import { apiFetch } from './client';

export type ProductionRunPayload = Record<string, unknown>;
export type ProductionRunRecord = Record<string, unknown>;

export function listProductionRuns(): Promise<ProductionRunRecord[]> {
  return apiFetch<ProductionRunRecord[]>('/api/production-runs');
}
export function createProductionRun(input: ProductionRunPayload): Promise<ProductionRunRecord> {
  return apiFetch<ProductionRunRecord>('/api/production-runs', { method: 'POST', body: input });
}
