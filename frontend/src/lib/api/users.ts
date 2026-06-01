import { apiFetch } from './client';

export type ApiUserStatus = 'active' | 'inactive';

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: ApiUserStatus;
  joinedAt: string;
  pin: string;
  roleIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserInput = {
  email: string;
  name: string;
  phone: string;
  password: string;
  pin: string;
  status: ApiUserStatus;
  joinedAt: string;
  roleIds: string[];
};

export function listUsers(): Promise<ApiUser[]> {
  return apiFetch<ApiUser[]>('/api/users');
}

export function createUser(input: UserInput): Promise<ApiUser> {
  return apiFetch<ApiUser>('/api/users', { method: 'POST', body: input });
}

export function updateUser(id: string, input: UserInput): Promise<ApiUser> {
  return apiFetch<ApiUser>(`/api/users/${id}`, { method: 'PATCH', body: input });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' });
}
