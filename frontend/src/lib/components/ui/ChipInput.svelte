<script lang="ts">
  import { X } from 'lucide-svelte';

  type Props = {
    values?: string[];
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    suggestions?: string[];
    class?: string;
    id?: string;
  };

  let {
    values = $bindable<string[]>([]),
    placeholder = 'Ketik dan tekan Enter…',
    error,
    disabled = false,
    suggestions = [],
    class: klass = '',
    id = crypto.randomUUID()
  }: Props = $props();

  let pending = $state('');
  let focused = $state(false);

  // Filtered suggestion list: case-insensitive contains; excludes already-selected.
  // Capped at 8 to keep the dropdown small.
  const matches = $derived.by(() => {
    if (suggestions.length === 0) return [];
    const q = pending.trim().toLowerCase();
    const selectedLower = values.map((v) => v.toLowerCase());
    return suggestions
      .filter((s) => !selectedLower.includes(s.toLowerCase()))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  });

  const showDropdown = $derived(focused && matches.length > 0);

  function add(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (values.some((existing) => existing.toLowerCase() === v.toLowerCase())) return;
    values = [...values, v];
  }

  function remove(i: number) {
    values = values.filter((_, idx) => idx !== i);
  }

  function pickSuggestion(s: string) {
    add(s);
    pending = '';
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      // If exactly one suggestion matches the typed prefix, prefer it for
      // cleaner casing; otherwise fall back to free-form input.
      if (pending.trim() && matches.length > 0) {
        const exact = matches.find((m) => m.toLowerCase() === pending.trim().toLowerCase());
        add(exact ?? pending);
      } else {
        add(pending);
      }
      pending = '';
    } else if (e.key === 'Backspace' && pending === '' && values.length > 0) {
      remove(values.length - 1);
    } else if (e.key === 'Escape') {
      focused = false;
    }
  }

  function handleBlur() {
    // Defer so that a click on a suggestion item still registers first.
    setTimeout(() => {
      focused = false;
      if (pending.trim()) {
        add(pending);
        pending = '';
      }
    }, 100);
  }
</script>

<div class="relative {klass}">
  <div
    class="flex flex-wrap items-center gap-1 rounded-lg border bg-white p-1.5 shadow-soft transition focus-within:ring-2 focus-within:outline-none
      {error
      ? 'border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-200'
      : 'border-slate-200 focus-within:border-brand-500 focus-within:ring-brand-100'}
      {disabled ? 'cursor-not-allowed bg-slate-50' : ''}"
  >
    {#each values as v, i (i + v)}
      <span
        class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
      >
        {v}
        <button
          type="button"
          class="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          aria-label="Hapus {v}"
          onclick={() => remove(i)}
          {disabled}
        >
          <X class="h-3 w-3" />
        </button>
      </span>
    {/each}
    <input
      {id}
      type="text"
      {placeholder}
      {disabled}
      bind:value={pending}
      onfocus={() => (focused = true)}
      onkeydown={handleKey}
      onblur={handleBlur}
      class="min-w-[100px] flex-1 border-0 bg-transparent px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none disabled:cursor-not-allowed"
    />
  </div>
  {#if showDropdown}
    <ul
      class="absolute top-full left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      {#each matches as match (match)}
        <li>
          <button
            type="button"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pickSuggestion(match)}
            class="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-brand-50 hover:text-brand-700"
          >
            {match}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {/if}
</div>
