<script lang="ts" module>
  // Store identity printed at the top of every nota. There is no store-profile
  // setting yet (frontend scaffold) — keep it here as a single source of truth
  // and wire it to /settings later when that exists.
  export const storeProfile = {
    name: 'Toko Saya',
    tagline: 'Point of Sale',
    addressLines: ['Jl. Merdeka No. 123, Jakarta'],
    phone: '0812-3456-7890'
  };
</script>

<script lang="ts">
  import {
    orderItemCount,
    paymentMethodLabels,
    type Order
  } from '$lib/stores/orders.svelte';
  import { customers } from '$lib/stores/customers.svelte';
  import { employees } from '$lib/stores/employees.svelte';
  import { shifts } from '$lib/stores/shifts.svelte';
  import { serviceTypeLabels } from '$lib/stores/settings.svelte';
  import { formatRupiah } from '$lib/utils/currency';

  type Props = {
    order: Order;
    /** Cash tendered by the customer (cash sales). Drives the change row. */
    received?: number;
    /** Change handed back. Defaults to max(0, received − total) when omitted. */
    change?: number;
  };

  let { order, received, change }: Props = $props();

  const customerName = $derived(
    order.customerId
      ? customers.getById(order.customerId)?.name ?? 'Pelanggan'
      : 'Pelanggan walk-in'
  );
  const cashierName = $derived(
    order.employeeId ? employees.getById(order.employeeId)?.name : undefined
  );
  const shiftCode = $derived(
    order.shiftId ? shifts.getById(order.shiftId)?.code : undefined
  );

  const outstanding = $derived(Math.max(0, order.total - order.paidAmount));
  const isCredit = $derived(order.status === 'credit');
  const isCash = $derived(order.paymentMethod === 'cash');
  const changeDue = $derived(
    change ?? (received !== undefined ? Math.max(0, received - order.total) : undefined)
  );

  function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div
  class="nota-print w-[74mm] rounded-lg border border-slate-200 bg-white p-4 text-[11px] leading-tight text-slate-900 shadow-soft [font-variant-numeric:tabular-nums]"
>
  <!-- Store header -->
  <div class="text-center">
    <div class="text-sm font-bold tracking-wide">{storeProfile.name}</div>
    {#if storeProfile.tagline}
      <div class="text-[10px] text-slate-500">{storeProfile.tagline}</div>
    {/if}
    {#each storeProfile.addressLines as line (line)}
      <div class="text-[10px] text-slate-500">{line}</div>
    {/each}
    {#if storeProfile.phone}
      <div class="text-[10px] text-slate-500">Telp. {storeProfile.phone}</div>
    {/if}
  </div>

  <div class="my-2 border-t border-dashed border-slate-300"></div>

  <!-- Meta -->
  <dl class="space-y-0.5 text-[10px]">
    <div class="flex justify-between gap-2">
      <dt class="text-slate-500">No. Nota</dt>
      <dd class="font-mono font-semibold">{order.code}</dd>
    </div>
    <div class="flex justify-between gap-2">
      <dt class="text-slate-500">Waktu</dt>
      <dd>{fmtDateTime(order.createdAt)}</dd>
    </div>
    {#if cashierName}
      <div class="flex justify-between gap-2">
        <dt class="text-slate-500">Kasir</dt>
        <dd>{cashierName}{shiftCode ? ` · ${shiftCode}` : ''}</dd>
      </div>
    {/if}
    {#if order.serviceType}
      <div class="flex justify-between gap-2">
        <dt class="text-slate-500">Layanan</dt>
        <dd>
          {serviceTypeLabels[order.serviceType]}{order.tableNumber
            ? ` · Meja ${order.tableNumber}`
            : ''}
        </dd>
      </div>
    {/if}
    <div class="flex justify-between gap-2">
      <dt class="text-slate-500">Pelanggan</dt>
      <dd class="max-w-[44mm] truncate text-right">{customerName}</dd>
    </div>
  </dl>

  <div class="my-2 border-t border-dashed border-slate-300"></div>

  <!-- Line items -->
  <div class="space-y-1.5">
    {#each order.lines as line (line.id)}
      <div>
        <div class="font-medium">
          {line.productName}{line.variantName ? ` — ${line.variantName}` : ''}
        </div>
        <div class="flex justify-between gap-2 text-slate-600">
          <span>{line.quantity} {line.unitCode} × {formatRupiah(line.unitPrice)}</span>
          <span class="tabular-nums">{formatRupiah(line.quantity * line.unitPrice)}</span>
        </div>
        {#each line.extras as ex (ex.extraId)}
          <div class="flex justify-between gap-2 pl-3 text-[10px] text-slate-500">
            <span>+ {ex.name}</span>
            <span class="tabular-nums">{formatRupiah(line.quantity * ex.priceDelta)}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <div class="my-2 border-t border-dashed border-slate-300"></div>

  <!-- Totals -->
  <dl class="space-y-0.5">
    <div class="flex justify-between gap-2 text-slate-600">
      <dt>Subtotal ({orderItemCount(order)} item)</dt>
      <dd class="tabular-nums">{formatRupiah(order.subtotal)}</dd>
    </div>

    {#if order.appliedPromos && order.appliedPromos.length > 0}
      {#each order.appliedPromos as p (p.promoId)}
        <div class="flex justify-between gap-2 text-emerald-700">
          <dt class="max-w-[44mm] truncate">{p.promoName}</dt>
          <dd class="tabular-nums">−{formatRupiah(p.discountAmount)}</dd>
        </div>
      {/each}
    {/if}

    {#if order.taxTotal > 0}
      <div class="flex justify-between gap-2 text-slate-600">
        <dt>Pajak</dt>
        <dd class="tabular-nums">{formatRupiah(order.taxTotal)}</dd>
      </div>
    {/if}

    <div class="mt-1 flex items-baseline justify-between gap-2 border-t border-slate-300 pt-1">
      <dt class="text-sm font-bold">TOTAL</dt>
      <dd class="text-sm font-bold tabular-nums">{formatRupiah(order.total)}</dd>
    </div>
  </dl>

  <!-- Payment -->
  <div class="mt-2 space-y-0.5 border-t border-dashed border-slate-300 pt-2">
    <div class="flex justify-between gap-2 text-slate-600">
      <span>Pembayaran</span>
      <span class="font-medium text-slate-900">{paymentMethodLabels[order.paymentMethod]}</span>
    </div>

    {#if isCredit}
      <div class="flex justify-between gap-2 text-slate-600">
        <span>Dibayar</span>
        <span class="tabular-nums">{formatRupiah(order.paidAmount)}</span>
      </div>
      <div class="flex justify-between gap-2 font-semibold text-amber-700">
        <span>Sisa piutang</span>
        <span class="tabular-nums">{formatRupiah(outstanding)}</span>
      </div>
    {:else if isCash && received !== undefined}
      <div class="flex justify-between gap-2 text-slate-600">
        <span>Tunai</span>
        <span class="tabular-nums">{formatRupiah(received)}</span>
      </div>
      <div class="flex justify-between gap-2 font-medium text-slate-900">
        <span>Kembali</span>
        <span class="tabular-nums">{formatRupiah(changeDue ?? 0)}</span>
      </div>
    {/if}
  </div>

  {#if order.promoDiscount && order.promoDiscount > 0}
    <div class="mt-1 text-center text-[10px] font-medium text-emerald-700">
      Anda hemat {formatRupiah(order.promoDiscount)}
    </div>
  {/if}

  {#if order.notes}
    <div class="mt-2 border-t border-dashed border-slate-300 pt-2 text-[10px] text-slate-500">
      {order.notes}
    </div>
  {/if}

  <div class="my-2 border-t border-dashed border-slate-300"></div>

  <!-- Footer -->
  <div class="text-center text-[10px] text-slate-500">
    <div class="font-medium text-slate-700">Terima kasih telah berbelanja 🙏</div>
    <div class="mt-0.5">Barang dapat ditukar dalam 1×24 jam dengan menunjukkan nota ini.</div>
  </div>
</div>
