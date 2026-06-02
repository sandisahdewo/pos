import { taxRates } from './taxRates.svelte';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type ApiCategory,
  type CategoryInput as ApiCategoryInput
} from '$lib/api/categories';

export type CategoryColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: CategoryColor;
  taxRateId: string;
  parentId?: string;
};

export type CategoryInput = Omit<Category, 'id' | 'slug'> & { slug?: string };

function toCategory(c: ApiCategory): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    color: c.color,
    taxRateId: c.taxRateId ?? '',
    parentId: c.parentId
  };
}

function toApiInput(c: CategoryInput): ApiCategoryInput {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description,
    color: c.color,
    taxRateId: c.taxRateId ? c.taxRateId : null,
    parentId: c.parentId ? c.parentId : null
  };
}

class CategoriesStore {
  items = $state<Category[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listCategories();
      this.items = list.map(toCategory);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: CategoryInput): Promise<Category> {
    const payload: CategoryInput = {
      ...input,
      taxRateId: input.taxRateId || taxRates.defaultId()
    };
    const created = await createCategory(toApiInput(payload));
    const c = toCategory(created);
    this.items = [...this.items, c];
    return c;
  }

  async update(id: string, patch: Partial<CategoryInput>): Promise<Category | undefined> {
    // Merge with the cached row so the PATCH request carries the full shape
    // (backend Update expects all fields; partial updates are simulated here).
    const current = this.getById(id);
    if (!current) return undefined;
    const next: CategoryInput = {
      name: patch.name ?? current.name,
      slug: patch.slug,
      description: patch.description ?? current.description,
      color: patch.color ?? current.color,
      taxRateId: patch.taxRateId ?? current.taxRateId,
      parentId: patch.parentId ?? current.parentId
    };
    const updated = await updateCategory(id, toApiInput(next));
    const c = toCategory(updated);
    this.items = this.items.map((x) => (x.id === id ? c : x));
    return c;
  }

  async remove(id: string): Promise<void> {
    await deleteCategory(id);
    this.items = this.items.filter((c) => c.id !== id);
  }

  getById(id: string): Category | undefined {
    return this.items.find((c) => c.id === id);
  }

  // Walk up from this category to root. Order: root first, this last.
  // Defensive against cycles (caps at 16 hops).
  path(id: string): Category[] {
    const out: Category[] = [];
    let current = this.getById(id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id) && out.length < 16) {
      seen.add(current.id);
      out.unshift(current);
      current = current.parentId ? this.getById(current.parentId) : undefined;
    }
    return out;
  }

  // All descendants of this category, recursively. Excludes the input id.
  descendantsOf(id: string): Category[] {
    const out: Category[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const next = stack.pop()!;
      for (const c of this.items) {
        if (c.parentId === next && !out.find((o) => o.id === c.id)) {
          out.push(c);
          stack.push(c.id);
        }
      }
    }
    return out;
  }

  // Cycle prevention: is `ancestorId` an ancestor of `descendantId`? Used to
  // block setting parent to self or to one's own descendant.
  isAncestorOf(ancestorId: string, descendantId: string): boolean {
    let current = this.getById(descendantId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.parentId === ancestorId) return true;
      current = current.parentId ? this.getById(current.parentId) : undefined;
    }
    return false;
  }
}

export const categories = new CategoriesStore();

export const colorOptions: { value: CategoryColor; label: string }[] = [
  { value: 'brand', label: 'Brand (blue)' },
  { value: 'success', label: 'Success (green)' },
  { value: 'warning', label: 'Warning (amber)' },
  { value: 'danger', label: 'Danger (rose)' },
  { value: 'info', label: 'Info (sky)' },
  { value: 'neutral', label: 'Neutral (slate)' }
];
