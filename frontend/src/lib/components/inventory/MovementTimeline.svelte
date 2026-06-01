<script lang="ts">
  import { ArrowUp, ArrowDown, ExternalLink, History as HistoryIcon } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui';
  import {
    adjustmentReasonLabels,
    movementKindLabels,
    type StockMovement,
    type StockMovementKind
  } from '$lib/stores/stockMovements.svelte';

  type Props = {
    movements: StockMovement[];
    emptyTitle?: string;
    emptyHint?: string;
    onImageClick?: (movement: StockMovement) => void;
  };

  let {
    movements,
    emptyTitle = 'Belum ada pergerakan',
    emptyHint = 'Lakukan transaksi atau penyesuaian stok untuk mulai mengisi riwayat.',
    onImageClick
  }: Props = $props();

  function kindBadgeVariant(
    kind: StockMovementKind
  ): 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' {
    switch (kind) {
      case 'receive':
        return 'success';
      case 'sale':
        return 'neutral';
      case 'sale-cancel':
        return 'warning';
      case 'adjust-in':
        return 'success';
      case 'adjust-out':
        return 'danger';
      case 'move-out':
      case 'move-in':
      case 'move-relocate':
        return 'info';
      case 'return-consignor':
        return 'brand';
      default:
        return 'neutral';
    }
  }

  function formatDateTime(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return iso;
    }
  }

  function formatDelta(v: number): string {
    if (v > 0) return `+${v}`;
    return String(v);
  }

  function deltaClass(v: number): string {
    if (v > 0) return 'font-semibold text-emerald-700';
    if (v < 0) return 'font-semibold text-rose-700';
    return 'text-slate-500';
  }

  function referenceHref(m: StockMovement): string | null {
    if (!m.reference) return null;
    switch (m.reference.kind) {
      case 'po':
        return `/purchase-orders/${m.reference.id}`;
      case 'order':
        return `/orders/${m.reference.id}`;
      case 'opname':
        return `/stock-opname/${m.reference.id}`;
      default:
        return null;
    }
  }
</script>

{#if movements.length === 0}
  <div class="flex flex-col items-center gap-2 py-10 text-center">
    <HistoryIcon class="h-8 w-8 text-slate-300" />
    <p class="text-sm font-medium text-slate-600">{emptyTitle}</p>
    <p class="max-w-sm text-xs text-slate-400">{emptyHint}</p>
  </div>
{:else}
  <ol class="relative space-y-3 border-l border-slate-200 pl-5">
    {#each movements as m (m.id)}
      {@const href = referenceHref(m)}
      <li class="relative">
        <span
          class="absolute -left-[26px] top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white
            {m.qtyDelta > 0
            ? 'bg-emerald-500'
            : m.qtyDelta < 0
              ? 'bg-rose-500'
              : 'bg-slate-400'}"
        >
          {#if m.qtyDelta > 0}
            <ArrowUp class="h-2.5 w-2.5 text-white" />
          {:else if m.qtyDelta < 0}
            <ArrowDown class="h-2.5 w-2.5 text-white" />
          {/if}
        </span>
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
          <Badge variant={kindBadgeVariant(m.kind)} size="sm">
            {movementKindLabels[m.kind]}
          </Badge>
          <span class={deltaClass(m.qtyDelta)}>{formatDelta(m.qtyDelta)}</span>
          <span class="text-slate-500">→ sisa {m.qtyAfter}</span>
          <span class="text-slate-400">·</span>
          <span class="text-slate-500">{formatDateTime(m.at)}</span>
          <span class="text-slate-400">·</span>
          <span class="text-slate-500">oleh {m.performedBy}</span>
          {#if m.reference?.code}
            <span class="text-slate-400">·</span>
            {#if href}
              <a
                {href}
                class="inline-flex items-center gap-0.5 font-mono text-brand-700 hover:underline"
              >
                <ExternalLink class="h-3 w-3" />
                {m.reference.code}
              </a>
            {:else}
              <span class="font-mono text-slate-500">{m.reference.code}</span>
            {/if}
          {/if}
          {#if m.reason}
            <span class="text-slate-400">·</span>
            <Badge variant="neutral" size="sm">{adjustmentReasonLabels[m.reason]}</Badge>
          {/if}
        </div>
        {#if m.notes || m.imageUrl}
          <div class="mt-1 flex items-start gap-2">
            {#if m.imageUrl}
              <button
                type="button"
                class="shrink-0 overflow-hidden rounded-md border border-slate-200 hover:border-brand-400 hover:shadow-soft"
                onclick={() => onImageClick?.(m)}
                aria-label="Lihat foto bukti"
                title="Lihat foto bukti"
              >
                <img src={m.imageUrl} alt="Foto bukti" class="h-10 w-10 object-cover" />
              </button>
            {/if}
            {#if m.notes}
              <p class="text-xs text-slate-500">{m.notes}</p>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
{/if}
