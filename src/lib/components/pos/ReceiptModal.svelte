<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { Printer, X } from 'lucide-svelte';
  import { Button } from '$lib/components/ui';
  import type { Order } from '$lib/stores/orders.svelte';
  import SaleReceipt from './SaleReceipt.svelte';

  type Props = {
    open?: boolean;
    order?: Order | null;
    /** Cash tendered — forwarded to the nota for the change row. */
    received?: number;
    change?: number;
    /** Label for the dismiss button (e.g. "Transaksi baru" on the till). */
    closeLabel?: string;
    title?: string;
    onClose?: () => void;
  };

  let {
    open = $bindable(false),
    order = null,
    received,
    change,
    closeLabel = 'Tutup',
    title = 'Nota pembelian',
    onClose
  }: Props = $props();

  function close() {
    open = false;
    onClose?.();
  }

  function print() {
    window.print();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close();
  }

  // Relocate the overlay to <body> so that, when printing, every *other* body
  // child can be hidden with display:none — leaving only the nota in flow. This
  // avoids the blank trailing pages that a visibility-only approach produces,
  // and keeps the print rules self-contained (no cooperation from host pages).
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if open && order}
  <div
    use:portal
    class="nota-overlay fixed inset-0 z-[70] flex flex-col items-center overflow-y-auto p-4 sm:p-6"
    role="dialog"
    aria-modal="true"
  >
    <button
      type="button"
      aria-label="Tutup"
      class="nota-backdrop fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
      transition:fade={{ duration: 150 }}
      onclick={close}
    ></button>

    <div
      class="nota-body relative z-10 flex w-full max-w-[420px] flex-col items-center gap-3"
      transition:scale={{ duration: 180, start: 0.96 }}
    >
      <!-- Toolbar (never printed) -->
      <div class="nota-toolbar flex w-full items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-white">{title}</h2>
        <button
          type="button"
          class="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Tutup nota"
          onclick={close}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <SaleReceipt {order} {received} {change} />

      <div class="nota-toolbar grid w-full grid-cols-[1fr_auto] gap-2">
        <Button variant="secondary" onclick={close}>{closeLabel}</Button>
        <Button onclick={print}>
          <Printer class="h-4 w-4" />
          Cetak struk
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* The overlay is portaled to <body>; hide every sibling and the chrome, then
     let the nota flow from the page origin as a single 80mm receipt. */
  @media print {
    @page {
      size: 80mm auto;
      margin: 4mm 3mm;
    }
    :global(body) {
      background: #fff !important;
    }
    :global(body > *:not(.nota-overlay)) {
      display: none !important;
    }
    .nota-overlay {
      position: static !important;
      display: block !important;
      overflow: visible !important;
      padding: 0 !important;
    }
    .nota-backdrop,
    .nota-toolbar {
      display: none !important;
    }
    .nota-body {
      max-width: none !important;
      width: auto !important;
      align-items: flex-start !important;
      gap: 0 !important;
    }
    :global(.nota-print) {
      width: 74mm !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
  }
</style>
