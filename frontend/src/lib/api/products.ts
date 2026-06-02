import { apiFetch } from './client';

// The product payload is forwarded as-is to the backend, which preserves the
// nested JSON shape (variants, packagings, prices, suppliers, components,
// extras, attributes, metadata). Frontend types are imported by callers from
// $lib/stores/products.svelte — this module is intentionally untyped on the
// nested fields so the store stays the source of truth.

export type ProductPayload = Record<string, unknown>;
export type ProductRecord = Record<string, unknown>;

export function listProducts(): Promise<ProductRecord[]> {
  return apiFetch<ProductRecord[]>('/api/products');
}

export function createProduct(input: ProductPayload): Promise<ProductRecord> {
  return apiFetch<ProductRecord>('/api/products', { method: 'POST', body: input });
}

export function updateProduct(id: string, input: ProductPayload): Promise<ProductRecord> {
  return apiFetch<ProductRecord>(`/api/products/${id}`, { method: 'PATCH', body: input });
}

export function deleteProduct(id: string): Promise<void> {
  return apiFetch<void>(`/api/products/${id}`, { method: 'DELETE' });
}
