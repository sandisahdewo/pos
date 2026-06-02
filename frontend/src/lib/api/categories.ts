import { apiFetch } from './client';

export type ApiCategoryColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: ApiCategoryColor;
  taxRateId?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CategoryInput = {
  name: string;
  slug?: string;
  description: string;
  color: ApiCategoryColor;
  taxRateId?: string | null;
  parentId?: string | null;
};

export function listCategories(): Promise<ApiCategory[]> {
  return apiFetch<ApiCategory[]>('/api/categories');
}

export function createCategory(input: CategoryInput): Promise<ApiCategory> {
  return apiFetch<ApiCategory>('/api/categories', { method: 'POST', body: input });
}

export function updateCategory(id: string, input: CategoryInput): Promise<ApiCategory> {
  return apiFetch<ApiCategory>(`/api/categories/${id}`, { method: 'PATCH', body: input });
}

export function deleteCategory(id: string): Promise<void> {
  return apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' });
}
