import { apiFetch } from './client';

// Pass-through types; the orders store owns the nested Order shape.
export type OrderPayload = Record<string, unknown>;
export type OrderRecord = Record<string, unknown>;

export function listOrders(params?: {
  status?: string;
  customerId?: string;
}): Promise<OrderRecord[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.customerId) q.set('customerId', params.customerId);
  const qs = q.toString();
  return apiFetch<OrderRecord[]>(`/api/orders${qs ? `?${qs}` : ''}`);
}
export function getOrder(id: string): Promise<OrderRecord> {
  return apiFetch<OrderRecord>(`/api/orders/${id}`);
}
export function createOrder(input: OrderPayload): Promise<OrderRecord> {
  return apiFetch<OrderRecord>('/api/orders', { method: 'POST', body: input });
}
export function updateOrder(id: string, input: OrderPayload): Promise<OrderRecord> {
  return apiFetch<OrderRecord>(`/api/orders/${id}`, { method: 'PATCH', body: input });
}
