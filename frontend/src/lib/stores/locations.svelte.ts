import { batches } from './batches.svelte';
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  type ApiLocation,
  type LocationInput as ApiLocationInput
} from '$lib/api/locations';

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

function toLocation(l: ApiLocation): Location {
  return {
    id: l.id,
    name: l.name,
    slug: l.slug,
    kind: l.kind,
    customerVisible: l.customerVisible,
    isDefaultReceipt: l.isDefaultReceipt,
    displayOrder: l.displayOrder,
    description: l.description,
    status: l.status
  };
}

function toApiInput(l: LocationInput): ApiLocationInput {
  return {
    name: l.name,
    slug: l.slug,
    kind: l.kind,
    customerVisible: l.customerVisible,
    isDefaultReceipt: l.isDefaultReceipt,
    displayOrder: l.displayOrder,
    description: l.description,
    status: l.status
  };
}

class LocationsStore {
  items = $state<Location[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listLocations();
      this.items = list.map(toLocation);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: LocationInput): Promise<Location> {
    const created = await createLocation(toApiInput(input));
    const l = toLocation(created);
    // Promoting to default also demotes any other in the backend — reflect that.
    this.items = [
      ...this.items.map((x) => (l.isDefaultReceipt ? { ...x, isDefaultReceipt: false } : x)),
      l
    ];
    return l;
  }

  async update(id: string, patch: Partial<LocationInput>): Promise<Location | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: LocationInput = {
      name: patch.name ?? current.name,
      slug: patch.slug,
      kind: patch.kind ?? current.kind,
      customerVisible: patch.customerVisible ?? current.customerVisible,
      isDefaultReceipt: patch.isDefaultReceipt ?? current.isDefaultReceipt,
      displayOrder: patch.displayOrder ?? current.displayOrder,
      description: patch.description ?? current.description,
      status: patch.status ?? current.status
    };
    const updated = await updateLocation(id, toApiInput(next));
    const l = toLocation(updated);
    this.items = this.items.map((x) => {
      if (x.id === id) return l;
      if (l.isDefaultReceipt) return { ...x, isDefaultReceipt: false };
      return x;
    });
    return l;
  }

  async remove(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    // Client-side guard mirrors backend rules so the UI can show an instant
    // explanation. Backend still enforces these as the source of truth.
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
    try {
      await deleteLocation(id);
      this.items = this.items.filter((l) => l.id !== id);
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Gagal menghapus lokasi.';
      return { ok: false, reason };
    }
  }

  getById(id: string): Location | undefined {
    return this.items.find((l) => l.id === id);
  }

  default(): Location | undefined {
    return (
      this.items.find((l) => l.isDefaultReceipt && l.status === 'active') ??
      this.items.find((l) => l.status === 'active') ??
      this.items[0]
    );
  }

  defaultId(): string {
    return this.default()?.id ?? '';
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
