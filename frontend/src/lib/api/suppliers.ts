import { apiFetch } from './client';

export type ApiSupplierStatus = 'active' | 'archived';

export type ApiSupplier = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  status: ApiSupplierStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SupplierInput = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  status: ApiSupplierStatus;
  notes: string;
};

export function listSuppliers(): Promise<ApiSupplier[]> {
  return apiFetch<ApiSupplier[]>('/api/suppliers');
}

export function createSupplier(input: SupplierInput): Promise<ApiSupplier> {
  return apiFetch<ApiSupplier>('/api/suppliers', { method: 'POST', body: input });
}

export function updateSupplier(id: string, input: SupplierInput): Promise<ApiSupplier> {
  return apiFetch<ApiSupplier>(`/api/suppliers/${id}`, { method: 'PATCH', body: input });
}

export function deleteSupplier(id: string): Promise<void> {
  return apiFetch<void>(`/api/suppliers/${id}`, { method: 'DELETE' });
}
