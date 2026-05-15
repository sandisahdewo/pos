import { batches } from './batches.svelte';

export type LocationKind = 'shelf' | 'rack' | 'warehouse';
export type LocationStatus = 'active' | 'archived';

export type Location = {
  id: string;
  name: string;
  slug: string;
  kind: LocationKind;
  customerVisible: boolean;
  isDefaultReceipt: boolean;
  displayOrder: number;
  description: string;
  status: LocationStatus;
};

export type LocationInput = Omit<Location, 'id' | 'slug'> & { slug?: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const seed: Location[] = [
  {
    id: 'loc_shelf',
    name: 'Etalase',
    slug: 'etalase',
    kind: 'shelf',
    customerVisible: true,
    isDefaultReceipt: false,
    displayOrder: 1,
    description: 'Produk yang dipajang di depan — pelanggan bisa ambil sendiri.',
    status: 'active'
  },
  {
    id: 'loc_rack',
    name: 'Rak Belakang',
    slug: 'rak-belakang',
    kind: 'rack',
    customerVisible: false,
    isDefaultReceipt: false,
    displayOrder: 2,
    description: 'Stok di belakang kasir — pelanggan minta, kasir ambilkan.',
    status: 'active'
  },
  {
    id: 'loc_gudang',
    name: 'Gudang',
    slug: 'gudang',
    kind: 'warehouse',
    customerVisible: false,
    isDefaultReceipt: true,
    displayOrder: 3,
    description: 'Penyimpanan bulk — tidak diakses pelanggan.',
    status: 'active'
  }
];

export const locationKindOptions: { value: LocationKind; label: string; description: string }[] = [
  {
    value: 'shelf',
    label: 'Etalase / Display',
    description: 'Dipajang — pelanggan ambil sendiri.'
  },
  {
    value: 'rack',
    label: 'Rak Belakang',
    description: 'Di belakang kasir — kasir ambilkan saat diminta.'
  },
  {
    value: 'warehouse',
    label: 'Gudang',
    description: 'Penyimpanan bulk yang tidak terlihat pelanggan.'
  }
];

export function defaultVisibilityForKind(kind: LocationKind): boolean {
  return kind === 'shelf';
}

class LocationsStore {
  items = $state<Location[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: LocationInput): Location {
    const loc: Location = {
      id: `loc_${this.nextId++}`,
      name: input.name,
      slug: input.slug?.trim() || slugify(input.name),
      kind: input.kind,
      customerVisible: input.customerVisible,
      isDefaultReceipt: input.isDefaultReceipt,
      displayOrder: input.displayOrder,
      description: input.description,
      status: input.status
    };
    if (loc.isDefaultReceipt) {
      this.items = this.items.map((l) => ({ ...l, isDefaultReceipt: false }));
    }
    this.items.push(loc);
    return loc;
  }

  update(id: string, patch: Partial<LocationInput>): Location | undefined {
    const idx = this.items.findIndex((l) => l.id === id);
    if (idx === -1) return undefined;
    const slugPatch =
      patch.name && !patch.slug ? { slug: slugify(patch.name) } : {};
    if (patch.isDefaultReceipt) {
      this.items = this.items.map((l) => ({
        ...l,
        ...(l.id === id ? { ...patch, ...slugPatch } : {}),
        isDefaultReceipt: l.id === id
      }));
      return this.items.find((l) => l.id === id);
    }
    this.items[idx] = { ...this.items[idx], ...patch, ...slugPatch };
    return this.items[idx];
  }

  remove(id: string): { ok: boolean; reason?: string } {
    const loc = this.getById(id);
    if (!loc) return { ok: false, reason: 'Lokasi tidak ditemukan.' };
    if (loc.isDefaultReceipt)
      return { ok: false, reason: 'Tidak bisa menghapus lokasi default penerimaan.' };
    if (batches.items.some((b) => b.locationId === id && b.qtyRemaining > 0))
      return {
        ok: false,
        reason: 'Lokasi masih memiliki stok. Pindahkan dulu ke lokasi lain.'
      };
    if (this.items.length <= 1)
      return { ok: false, reason: 'Minimal harus ada satu lokasi.' };
    this.items = this.items.filter((l) => l.id !== id);
    return { ok: true };
  }

  getById(id: string): Location | undefined {
    return this.items.find((l) => l.id === id);
  }

  default(): Location {
    return (
      this.items.find((l) => l.isDefaultReceipt && l.status === 'active') ??
      this.items.find((l) => l.status === 'active') ??
      this.items[0]
    );
  }

  defaultId(): string {
    return this.default()?.id ?? 'loc_gudang';
  }

  active(): Location[] {
    return this.items.filter((l) => l.status === 'active');
  }

  sortedActive(): Location[] {
    return this.active().sort((a, b) => a.displayOrder - b.displayOrder);
  }

  customerVisibleIds(): Set<string> {
    return new Set(this.items.filter((l) => l.customerVisible).map((l) => l.id));
  }
}

export const locations = new LocationsStore();
