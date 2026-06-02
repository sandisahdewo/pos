import { apiFetch } from './client';

export type ApiLocationKind = 'shelf' | 'rack' | 'warehouse';
export type ApiLocationStatus = 'active' | 'archived';

export type ApiLocation = {
  id: string;
  name: string;
  slug: string;
  kind: ApiLocationKind;
  customerVisible: boolean;
  isDefaultReceipt: boolean;
  displayOrder: number;
  description: string;
  status: ApiLocationStatus;
  createdAt: string;
  updatedAt: string;
};

export type LocationInput = {
  name: string;
  slug?: string;
  kind: ApiLocationKind;
  customerVisible: boolean;
  isDefaultReceipt: boolean;
  displayOrder: number;
  description: string;
  status: ApiLocationStatus;
};

export function listLocations(): Promise<ApiLocation[]> {
  return apiFetch<ApiLocation[]>('/api/locations');
}

export function createLocation(input: LocationInput): Promise<ApiLocation> {
  return apiFetch<ApiLocation>('/api/locations', { method: 'POST', body: input });
}

export function updateLocation(id: string, input: LocationInput): Promise<ApiLocation> {
  return apiFetch<ApiLocation>(`/api/locations/${id}`, { method: 'PATCH', body: input });
}

export function deleteLocation(id: string): Promise<void> {
  return apiFetch<void>(`/api/locations/${id}`, { method: 'DELETE' });
}
