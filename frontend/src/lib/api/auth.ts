import { apiFetch } from './client';

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  token: string;
  user: ApiUser;
};

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

export function me(): Promise<ApiUser> {
  return apiFetch<ApiUser>('/api/auth/me');
}
