export type TagColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type Tag = {
  id: string;
  name: string;          // unique label, used as the FK from Product.tags
  color: TagColor;
  publicVisible: boolean; // show on POS card / shelf label for customers
  description: string;
};

export type TagInput = Omit<Tag, 'id'>;

const seed: Tag[] = [
  {
    id: 'tag_baru',
    name: 'Baru',
    color: 'brand',
    publicVisible: true,
    description: 'Produk baru masuk katalog.'
  },
  {
    id: 'tag_best',
    name: 'Best Seller',
    color: 'success',
    publicVisible: true,
    description: 'Produk paling sering laku.'
  },
  {
    id: 'tag_halal',
    name: 'Halal',
    color: 'success',
    publicVisible: true,
    description: 'Bersertifikat MUI Halal.'
  },
  {
    id: 'tag_promo',
    name: 'Promo',
    color: 'warning',
    publicVisible: true,
    description: 'Sedang dalam program promo.'
  },
  {
    id: 'tag_lokal',
    name: 'Lokal',
    color: 'info',
    publicVisible: true,
    description: 'Produk lokal / UMKM.'
  }
];

class TagsStore {
  items = $state<Tag[]>([...seed]);
  private nextId = seed.length + 1;

  add(input: TagInput): Tag {
    const tag: Tag = { ...input, id: `tag_${this.nextId++}` };
    this.items.push(tag);
    return tag;
  }

  update(id: string, patch: Partial<TagInput>): Tag | undefined {
    const idx = this.items.findIndex((t) => t.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = { ...this.items[idx], ...patch };
    return this.items[idx];
  }

  remove(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
  }

  getById(id: string): Tag | undefined {
    return this.items.find((t) => t.id === id);
  }

  // Match a tag by name (case-insensitive). Empty result for unknown names —
  // products may still hold the string, it just won't have a color/visibility.
  getByName(name: string): Tag | undefined {
    const lower = name.trim().toLowerCase();
    return this.items.find((t) => t.name.toLowerCase() === lower);
  }
}

export const tags = new TagsStore();
