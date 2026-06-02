import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  type ApiTag,
  type TagInput as ApiTagInput
} from '$lib/api/tags';

export type TagColor = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type Tag = {
  id: string;
  name: string;
  color: TagColor;
  publicVisible: boolean;
  description: string;
};

export type TagInput = Omit<Tag, 'id'>;

function toTag(t: ApiTag): Tag {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    publicVisible: t.publicVisible,
    description: t.description
  };
}

function toApiInput(t: TagInput): ApiTagInput {
  return {
    name: t.name,
    color: t.color,
    publicVisible: t.publicVisible,
    description: t.description
  };
}

class TagsStore {
  items = $state<Tag[]>([]);
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const list = await listTags();
      this.items = list.map(toTag);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async add(input: TagInput): Promise<Tag> {
    const created = await createTag(toApiInput(input));
    const t = toTag(created);
    this.items = [...this.items, t];
    return t;
  }

  async update(id: string, patch: Partial<TagInput>): Promise<Tag | undefined> {
    const current = this.getById(id);
    if (!current) return undefined;
    const next: TagInput = {
      name: patch.name ?? current.name,
      color: patch.color ?? current.color,
      publicVisible: patch.publicVisible ?? current.publicVisible,
      description: patch.description ?? current.description
    };
    const updated = await updateTag(id, toApiInput(next));
    const t = toTag(updated);
    this.items = this.items.map((x) => (x.id === id ? t : x));
    return t;
  }

  async remove(id: string): Promise<void> {
    await deleteTag(id);
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
