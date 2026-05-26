import { ALL_PERMISSIONS_WILDCARD } from '$lib/auth/permissions';
import { employees, type Employee } from './employees.svelte';
import { roles } from './roles.svelte';

class UserState {
  currentEmployeeId = $state<string | null>('emp_1');
  isAuthenticated = $state(true);

  current = $derived.by<Employee | null>(() => {
    if (!this.currentEmployeeId) return null;
    return employees.getById(this.currentEmployeeId) ?? null;
  });

  roles = $derived.by(() => {
    if (!this.current) return [];
    return roles.getMany(this.current.roleIds);
  });

  permissions = $derived.by(() => {
    if (!this.current) return new Set<string>();
    return roles.permissionsFor(this.current.roleIds);
  });

  /** Convenience: comma-joined role labels for the current user. */
  roleLabel = $derived(this.roles.map((r) => r.name).join(' · ') || 'Tanpa peran');

  /** Check whether the current user has a given permission. */
  can(permission: string): boolean {
    if (!this.isAuthenticated) return false;
    if (this.permissions.has(ALL_PERMISSIONS_WILDCARD)) return true;
    return this.permissions.has(permission);
  }

  login(username: string, password: string): { ok: true } | { ok: false; reason: string } {
    const match = employees.getByUsername(username);
    if (!match) {
      return { ok: false, reason: 'Username tidak ditemukan.' };
    }
    if (match.status !== 'active') {
      return { ok: false, reason: 'Akun pegawai ini tidak aktif.' };
    }
    if (match.password !== password) {
      return { ok: false, reason: 'Kata sandi salah.' };
    }
    if (match.roleIds.length === 0) {
      return {
        ok: false,
        reason: 'Pegawai ini belum memiliki peran. Hubungi admin untuk memberi akses.'
      };
    }
    this.currentEmployeeId = match.id;
    this.isAuthenticated = true;
    return { ok: true };
  }

  logout() {
    this.isAuthenticated = false;
  }
}

export const user = new UserState();
