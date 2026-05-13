<script lang="ts">
  import { X } from 'lucide-svelte';

  type Props = {
    values?: string[];
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    class?: string;
    id?: string;
  };

  let {
    values = $bindable<string[]>([]),
    placeholder = 'Ketik dan tekan Enter…',
    error,
    disabled = false,
    class: klass = '',
    id = crypto.randomUUID()
  }: Props = $props();

  let pending = $state('');

  function add(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (values.includes(v)) return;
    values = [...values, v];
  }

  function remove(i: number) {
    values = values.filter((_, idx) => idx !== i);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(pending);
      pending = '';
    } else if (e.key === 'Backspace' && pending === '' && values.length > 0) {
      remove(values.length - 1);
    }
  }

  function handleBlur() {
    if (pending.trim()) {
      add(pending);
      pending = '';
    }
  }
</script>

<div class={klass}>
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
      onkeydown={handleKey}
      onblur={handleBlur}
      class="min-w-[100px] flex-1 border-0 bg-transparent px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none disabled:cursor-not-allowed"
    />
  </div>
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {/if}
</div>
