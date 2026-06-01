import { apiFetch } from './client';
import type { ApiUser } from './users';

export type { ApiUser } from './users';

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
