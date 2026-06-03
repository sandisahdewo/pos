import { apiFetch } from './client';

export type ApiCustomerType = 'individual' | 'business';
export type ApiCustomerStatus = 'active' | 'archived';

export type ApiCustomer = {
  id: string;
  name: string;
  type: ApiCustomerType;
  email: string;
  phone: string;
  address: string;
  pricelistId?: string;
  taxId: string;
  status: ApiCustomerStatus;
  creditAllowed: boolean;
  notes: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  name: string;
  type: ApiCustomerType;
  email: string;
  phone: string;
  address: string;
  pricelistId?: string | null;
  taxId: string;
  status: ApiCustomerStatus;
  creditAllowed: boolean;
  notes: string;
  joinedAt: string;
};

export function listCustomers(): Promise<ApiCustomer[]> {
  return apiFetch<ApiCustomer[]>('/api/customers');
}
export function createCustomer(input: CustomerInput): Promise<ApiCustomer> {
  return apiFetch<ApiCustomer>('/api/customers', { method: 'POST', body: input });
}
export function updateCustomer(id: string, input: CustomerInput): Promise<ApiCustomer> {
  return apiFetch<ApiCustomer>(`/api/customers/${id}`, { method: 'PATCH', body: input });
}
export function deleteCustomer(id: string): Promise<void> {
  return apiFetch<void>(`/api/customers/${id}`, { method: 'DELETE' });
}
