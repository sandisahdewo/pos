<script lang="ts">
  import { formatRupiahNumber, parseRupiahNumber } from '$lib/utils/currency';

  type Props = {
    value?: number;
    label?: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    disabled?: boolean;
    prefix?: string;
    id?: string;
    class?: string;
    name?: string;
  };

  let {
    value = $bindable(0),
    label,
    hint,
    error,
    placeholder = '0',
    disabled = false,
    prefix = 'Rp',
    id = crypto.randomUUID(),
    class: klass = '',
    name
  }: Props = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let display = $state(formatRupiahNumber(value));

  $effect(() => {
    const next = formatRupiahNumber(value);
    if (next !== display && document.activeElement !== inputEl) {
      display = next;
    }
  });

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const raw = target.value;
    const cursor = target.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, cursor).replace(/\D/g, '').length;

    const num = parseRupiahNumber(raw);
    const formatted = formatRupiahNumber(num);

    display = formatted;
    value = num;

    requestAnimationFrame(() => {
      if (!inputEl) return;
      let pos = 0;
      let seen = 0;
      const text = inputEl.value;
      while (pos < text.length && seen < digitsBefore) {
        if (/\d/.test(text[pos])) seen++;
        pos++;
      }
      try {
        inputEl.setSelectionRange(pos, pos);
      } catch {
        // ignore — some browsers reject when input isn't focused
      }
    });
  }

  function handleBlur() {
    display = formatRupiahNumber(value);
  }
</script>

<div class={klass}>
  {#if label}
    <label for={id} class="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
  {/if}
  <div class="relative">
    {#if prefix}
      <span
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-slate-400"
      >
        {prefix}
      </span>
    {/if}
    <input
      bind:this={inputEl}
      {id}
      {name}
      type="text"
      inputmode="numeric"
      autocomplete="off"
      {placeholder}
      {disabled}
      value={display}
      oninput={handleInput}
      onblur={handleBlur}
      class="block w-full rounded-lg border bg-white py-2 pr-3 text-sm text-slate-900 shadow-soft transition placeholder:text-slate-400 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
        {error
        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
        : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'}
        {prefix ? 'pl-10' : 'pl-3'}"
    />
  </div>
  {#if error}
    <p class="mt-1.5 text-xs text-rose-600">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-xs text-slate-500">{hint}</p>
  {/if}
</div>
