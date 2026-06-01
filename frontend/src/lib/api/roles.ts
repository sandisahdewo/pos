import { apiFetch } from './client';

export type ApiRole = {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

export type RoleInput = {
  name: string;
  description: string;
  permissions: string[];
};

export function listRoles(): Promise<ApiRole[]> {
  return apiFetch<ApiRole[]>('/api/roles');
}

export function createRole(input: RoleInput): Promise<ApiRole> {
  return apiFetch<ApiRole>('/api/roles', { method: 'POST', body: input });
}

export function updateRole(id: string, input: RoleInput): Promise<ApiRole> {
  return apiFetch<ApiRole>(`/api/roles/${id}`, { method: 'PATCH', body: input });
}

export function deleteRole(id: string): Promise<void> {
  return apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE' });
}
