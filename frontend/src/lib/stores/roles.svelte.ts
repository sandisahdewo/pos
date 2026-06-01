import { ALL_PERMISSIONS_WILDCARD } from '$lib/auth/permissions';

export type Role = {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
};

export type RoleInput = Omit<Role, 'id' | 'isSystem'>;

const seed: Role[] = [
  {
    id: 'role_admin',
    name: 'Admin',
    description: 'Akses penuh ke seluruh sistem, termasuk pengaturan peran.',
    isSystem: true,
    permissions: [ALL_PERMISSIONS_WILDCARD]
  },
  {
    id: 'role_manajer',
    name: 'Manajer',
    description: 'Mengelola operasional toko, produk, promo, dan laporan.',
    isSystem: false,
    permissions: [
      'menu.dashboard',
      'menu.pos',
      'menu.orders',
      'feature.orders.refund',
      'menu.promotions',
      'feature.promotions.manage',
      'menu.shifts',
      'menu.employees',
      'menu.suppliers',
      'menu.categories',
      'menu.brands',
      'menu.tags',
      'menu.units',
      'menu.products',
      'menu.pricelists',
      'menu.pricing',
      'menu.taxes',
      'menu.locations',
      'menu.purchase-orders',
      'menu.payouts',
      'menu.inventory',
      'menu.production',
      'menu.stock-opname',
      'menu.customers',
      'menu.reports',
      'menu.reports.laba',
      'menu.forecast',
      'menu.price-history',
      'menu.supplier-prices',
      'menu.stock-movements'
    ]
  },
  {
    id: 'role_kasir',
    name: 'Kasir',
    description: 'Operasional kasir, pesanan, dan pelanggan harian.',
    isSystem: false,
    permissions: [
      'menu.dashboard',
      'menu.pos',
      'menu.orders',
      'menu.shifts',
      'menu.customers',
      'menu.promotions'
    ]
  },
  {
    id: 'role_staf',
    name: 'Staf',
    description: 'Akses dasar: melihat beranda dan pesanan.',
    isSystem: false,
    permissions: ['menu.dashboard', 'menu.orders']
  },
  {
    id: 'role_akuntan',
    name: 'Akuntan',
    description: 'Keuangan, utang/piutang, dan laporan laba rugi.',
    isSystem: false,
    permissions: [
      'menu.dashboard',
      'menu.orders',
      'menu.purchase-orders',
      'menu.payouts',
      'menu.utang',
      'menu.piutang',
      'menu.reports',
      'menu.reports.laba',
      'menu.price-history',
      'menu.supplier-prices',
      'menu.taxes'
    ]
  },
  {
    id: 'role_gudang',
    name: 'Gudang',
    description: 'Inventaris, opname, produksi, dan riwayat stok.',
    isSystem: false,
    permissions: [
      'menu.dashboard',
      'menu.inventory',
      'menu.production',
      'menu.stock-opname',
      'menu.suppliers',
      'menu.purchase-orders',
      'menu.products',
      'menu.categories',
      'menu.brands',
      'menu.units',
      'menu.locations',
      'menu.stock-movements',
      'menu.forecast'
    ]
  }
];

class RolesStore {
  items = $state<Role[]>(structuredClone(seed));
  private nextId = seed.length + 1;

  add(input: RoleInput): Role {
    const role: Role = { ...input, id: `role_${this.nextId++}`, isSystem: false };
    this.items.push(role);
    return role;
  }

  update(id: string, patch: Partial<RoleInput>): Role | undefined {
    const idx = this.items.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    const current = this.items[idx];
    // System roles can have their description tweaked, but name and permissions are locked.
    if (current.isSystem) {
      this.items[idx] = {
        ...current,
        description: patch.description ?? current.description
      };
    } else {
      this.items[idx] = { ...current, ...patch };
    }
    return this.items[idx];
  }

  remove(id: string): { ok: true } | { ok: false; reason: string } {
    const role = this.getById(id);
    if (!role) return { ok: false, reason: 'Peran tidak ditemukan.' };
    if (role.isSystem) return { ok: false, reason: 'Peran sistem tidak bisa dihapus.' };
    this.items = this.items.filter((r) => r.id !== id);
    return { ok: true };
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

  /** Human-readable list of role names for an employee, e.g. "Admin · Kasir". */
  labelFor(roleIds: string[], separator = ' · '): string {
    if (!roleIds.length) return 'Tanpa peran';
    return this.getMany(roleIds)
      .map((r) => r.name)
      .join(separator);
  }
}

export const roles = new RolesStore();
