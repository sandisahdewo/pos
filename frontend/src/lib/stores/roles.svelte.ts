import { ALL_PERMISSIONS_WILDCARD } from '$lib/auth/permissions';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  type ApiRole,
  type RoleInput
} from '$lib/api/roles';

export type Role = {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
};

export type { RoleInput };

class RolesStore {
  items = $state<Role[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const roles = await listRoles();
      this.items = roles.map(toRole);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: RoleInput): Promise<Role> {
    const created = await createRole(input);
    const role = toRole(created);
    this.items = [...this.items, role];
    return role;
  }

  async update(id: string, patch: RoleInput): Promise<Role | undefined> {
    const updated = await updateRole(id, patch);
    const role = toRole(updated);
    this.items = this.items.map((r) => (r.id === id ? role : r));
    return role;
  }

  async remove(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      await deleteRole(id);
      this.items = this.items.filter((r) => r.id !== id);
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Gagal menghapus peran.';
      return { ok: false, reason };
    }
  }

  getById(id: string): Role | undefined {
    return this.items.find((r) => r.id === id);
  }

  getMany(ids: string[]): Role[] {
    return ids.map((id) => this.getById(id)).filter((r): r is Role => Boolean(r));
  }

  /** Aggregated permission set for the given role IDs. Wildcard short-circuits. */
  permissionsFor(roleIds: string[]): Set<string> {
    const result = new Set<string>();
    for (const id of roleIds) {
      const role = this.getById(id);
      if (!role) continue;
      if (role.permissions.includes(ALL_PERMISSIONS_WILDCARD)) {
        return new Set([ALL_PERMISSIONS_WILDCARD]);
      }
      for (const p of role.permissions) result.add(p);
    }
    return result;
  }

  /** Human-readable list of role names, e.g. "Admin · Kasir". */
  labelFor(roleIds: string[], separator = ' · '): string {
    if (!roleIds.length) return 'Tanpa peran';
    return this.getMany(roleIds)
      .map((r) => r.name)
      .join(separator);
  }
}

function toRole(r: ApiRole): Role {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions
  };
}

export const roles = new RolesStore();
