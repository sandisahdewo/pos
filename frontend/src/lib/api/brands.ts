import { apiFetch } from './client';

export type ApiBrandStatus = 'active' | 'archived';

export type ApiBrand = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  status: ApiBrandStatus;
  createdAt: string;
  updatedAt: string;
};

export type BrandInput = {
  name: string;
  slug?: string;
  description: string;
  imageUrl: string;
  status: ApiBrandStatus;
};

export function listBrands(): Promise<ApiBrand[]> {
  return apiFetch<ApiBrand[]>('/api/brands');
}

export function createBrand(input: BrandInput): Promise<ApiBrand> {
  return apiFetch<ApiBrand>('/api/brands', { method: 'POST', body: input });
}

export function updateBrand(id: string, input: BrandInput): Promise<ApiBrand> {
  return apiFetch<ApiBrand>(`/api/brands/${id}`, { method: 'PATCH', body: input });
}

export function deleteBrand(id: string): Promise<void> {
  return apiFetch<void>(`/api/brands/${id}`, { method: 'DELETE' });
}
