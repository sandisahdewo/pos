import { apiFetch } from './client';

export type ApiTaxRate = {
  id: string;
  name: string;
  rate: number;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaxRateInput = {
  id?: string; // required on create (slug-style), ignored on update
  name: string;
  rate: number;
  description: string;
  isDefault: boolean;
};

export function listTaxRates(): Promise<ApiTaxRate[]> {
  return apiFetch<ApiTaxRate[]>('/api/tax-rates');
}

export function createTaxRate(input: TaxRateInput): Promise<ApiTaxRate> {
  return apiFetch<ApiTaxRate>('/api/tax-rates', { method: 'POST', body: input });
}

export function updateTaxRate(id: string, input: TaxRateInput): Promise<ApiTaxRate> {
  return apiFetch<ApiTaxRate>(`/api/tax-rates/${id}`, { method: 'PATCH', body: input });
}

export function deleteTaxRate(id: string): Promise<void> {
  return apiFetch<void>(`/api/tax-rates/${id}`, { method: 'DELETE' });
}
