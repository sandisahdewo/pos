import { apiFetch } from './client';

export type ApiPricelist = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PricelistInput = {
  id?: string;
  name: string;
  description: string;
  isDefault: boolean;
};

export function listPricelists(): Promise<ApiPricelist[]> {
  return apiFetch<ApiPricelist[]>('/api/pricelists');
}
export function createPricelist(input: PricelistInput): Promise<ApiPricelist> {
  return apiFetch<ApiPricelist>('/api/pricelists', { method: 'POST', body: input });
}
export function updatePricelist(id: string, input: PricelistInput): Promise<ApiPricelist> {
  return apiFetch<ApiPricelist>(`/api/pricelists/${id}`, { method: 'PATCH', body: input });
}
export function deletePricelist(id: string): Promise<void> {
  return apiFetch<void>(`/api/pricelists/${id}`, { method: 'DELETE' });
}
