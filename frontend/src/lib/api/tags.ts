import { apiFetch } from './client';

export type ApiTagColor =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export type ApiTag = {
  id: string;
  name: string;
  color: ApiTagColor;
  publicVisible: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TagInput = {
  name: string;
  color: ApiTagColor;
  publicVisible: boolean;
  description: string;
};

export function listTags(): Promise<ApiTag[]> {
  return apiFetch<ApiTag[]>('/api/tags');
}

export function createTag(input: TagInput): Promise<ApiTag> {
  return apiFetch<ApiTag>('/api/tags', { method: 'POST', body: input });
}

export function updateTag(id: string, input: TagInput): Promise<ApiTag> {
  return apiFetch<ApiTag>(`/api/tags/${id}`, { method: 'PATCH', body: input });
}

export function deleteTag(id: string): Promise<void> {
  return apiFetch<void>(`/api/tags/${id}`, { method: 'DELETE' });
}
