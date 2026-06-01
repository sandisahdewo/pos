import { ALL_PERMISSIONS_WILDCARD } from '$lib/auth/permissions';
import { employees, type Employee } from './employees.svelte';
import { roles, type Role } from './roles.svelte';
import { setToken, ApiError } from '$lib/api/client';
import { login as apiLogin, me as apiMe, type ApiUser } from '$lib/api/auth';

const TOKEN_KEY = 'pos.auth.token';

function storedToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

class UserState {
  apiUser = $state<ApiUser | null>(null);
  token = $state<string | null>(null);

  isAuthenticated = $derived(this.apiUser !== null);

  /** Active employee row, matched on email against the employees cache. */
  current = $derived.by<Employee | null>(() => {
    if (!this.apiUser) return null;
    return employees.getByEmail(this.apiUser.email) ?? null;
  });

  /** Roles for the active session — looked up by ID in the roles cache. */
  roles = $derived.by<Role[]>(() => {
    if (!this.apiUser) return [];
    return roles.getMany(this.apiUser.roleIds);
  });

  permissions = $derived.by<Set<string>>(() => {
    const set = new Set<string>();
    for (const role of this.roles) {
      if (role.permissions.includes(ALL_PERMISSIONS_WILDCARD)) {
        set.clear();
        set.add(ALL_PERMISSIONS_WILDCARD);
        return set;
      }
      for (const p of role.permissions) set.add(p);
    }
    return set;
  });

  roleLabel = $derived(this.roles.map((r) => r.name).join(' · ') || 'Tanpa peran');
  displayName = $derived(this.apiUser?.name ?? this.current?.name ?? 'Tamu');
  displayEmail = $derived(this.apiUser?.email ?? this.current?.email ?? '');

  can(permission: string): boolean {
    if (!this.isAuthenticated) return false;
    if (this.permissions.has(ALL_PERMISSIONS_WILDCARD)) return true;
    return this.permissions.has(permission);
  }

  async login(
    email: string,
    password: string
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const res = await apiLogin(email, password);
      this.token = res.token;
      this.apiUser = res.user;
      setToken(res.token);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_KEY, res.token);
      }
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, reason: err.message };
      }
      return {
        ok: false,
        reason: 'Tidak bisa terhubung ke server. Pastikan backend berjalan.'
      };
    }
  }

  logout(): void {
    this.token = null;
    this.apiUser = null;
    setToken(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }

  async hydrate(): Promise<void> {
    const token = storedToken();
    if (!token) return;
    setToken(token);
    this.token = token;
    try {
      this.apiUser = await apiMe();
    } catch {
      this.logout();
    }
  }
}

export const user = new UserState();
