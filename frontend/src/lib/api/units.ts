import { apiFetch } from './client';

export type ApiUnit = {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type UnitInput = {
  name: string;
  code: string;
  description: string;
};

export function listUnits(): Promise<ApiUnit[]> {
  return apiFetch<ApiUnit[]>('/api/units');
}

export function createUnit(input: UnitInput): Promise<ApiUnit> {
  return apiFetch<ApiUnit>('/api/units', { method: 'POST', body: input });
}

export function updateUnit(id: string, input: UnitInput): Promise<ApiUnit> {
  return apiFetch<ApiUnit>(`/api/units/${id}`, { method: 'PATCH', body: input });
}

export function deleteUnit(id: string): Promise<void> {
  return apiFetch<void>(`/api/units/${id}`, { method: 'DELETE' });
}
