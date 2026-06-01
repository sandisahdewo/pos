import { ALL_PERMISSIONS_WILDCARD } from '$lib/auth/permissions';
import { employees, type Employee } from './employees.svelte';
import { roles, type Role } from './roles.svelte';
import { setToken, ApiError } from '$lib/api/client';
import { login as apiLogin, me as apiMe, type ApiUser } from '$lib/api/auth';

const TOKEN_KEY = 'pos.auth.token';

// Backend roles (lowercase identifiers) → frontend role name (matches the
// `name` field in roles store). The role lookup is by name because the seed
// uses display names like "Admin", "Kasir".
const BACKEND_TO_FRONTEND_ROLE: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manajer',
  cashier: 'Kasir',
  staff: 'Staf',
  accountant: 'Akuntan',
  warehouse: 'Gudang'
};

function storedToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

class UserState {
  // Legacy mock state. Kept so existing UI that reads `current` / `roles`
  // keeps working until each feature migrates to API-backed data.
  currentEmployeeId = $state<string | null>(null);

  // API-backed state. Set by login() / hydrate(); cleared by logout().
  apiUser = $state<ApiUser | null>(null);
  token = $state<string | null>(null);

  isAuthenticated = $derived(this.apiUser !== null);

  /** Resolve the frontend Role for the API user's role, if mapped. */
  private mappedRole = $derived.by<Role | null>(() => {
    if (!this.apiUser) return null;
    const name = BACKEND_TO_FRONTEND_ROLE[this.apiUser.role];
    if (!name) return null;
    return roles.items.find((r) => r.name === name) ?? null;
  });

  current = $derived.by<Employee | null>(() => {
    if (this.currentEmployeeId) {
      return employees.getById(this.currentEmployeeId) ?? null;
    }
    return null;
  });

  /** Roles for the active session. Prefers API → mapped role; falls back to legacy employee.roleIds. */
  roles = $derived.by<Role[]>(() => {
    if (this.mappedRole) return [this.mappedRole];
    if (this.current) return roles.getMany(this.current.roleIds);
    return [];
  });

  permissions = $derived.by<Set<string>>(() => {
    if (this.mappedRole) {
      const set = new Set<string>();
      if (this.mappedRole.permissions.includes(ALL_PERMISSIONS_WILDCARD)) {
        set.add(ALL_PERMISSIONS_WILDCARD);
        return set;
      }
      for (const p of this.mappedRole.permissions) set.add(p);
      return set;
    }
    if (this.current) return roles.permissionsFor(this.current.roleIds);
    return new Set<string>();
  });

  /** Comma-joined role labels for the active session. */
  roleLabel = $derived(this.roles.map((r) => r.name).join(' · ') || 'Tanpa peran');

  /** Display name. Prefers API user's name, falls back to legacy employee. */
  displayName = $derived(this.apiUser?.name ?? this.current?.name ?? 'Tamu');

  /** Display email. Prefers API user, falls back to legacy employee. */
  displayEmail = $derived(this.apiUser?.email ?? this.current?.email ?? '');

  can(permission: string): boolean {
    if (!this.isAuthenticated) return false;
    if (this.permissions.has(ALL_PERMISSIONS_WILDCARD)) return true;
    return this.permissions.has(permission);
  }

  async login(email: string, password: string): Promise<{ ok: true } | { ok: false; reason: string }> {
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
      return { ok: false, reason: 'Tidak bisa terhubung ke server. Pastikan backend berjalan.' };
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

  /**
   * Restore the session from localStorage on app boot. Validates the token by
   * calling /api/auth/me; clears it on failure (expired / revoked).
   */
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
