<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ArrowLeft, Receipt as ReceiptIcon } from 'lucide-svelte';
  import { Button, Card, PageHeader } from '$lib/components/ui';
  import PurchaseOrderForm from '$lib/components/purchase-orders/PurchaseOrderForm.svelte';
  import {
    purchaseOrders,
    type PurchaseOrderInput
  } from '$lib/stores/purchaseOrders.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const id = $derived(page.params.id ?? '');
  const po = $derived(id ? purchaseOrders.getById(id) : undefined);
  const canEdit = $derived(po?.status === 'draft');

  function save(data: PurchaseOrderInput) {
    purchaseOrders.update(id, data);
    toast.success('Order pembelian diperbarui', po?.code ?? '');
    goto(`/purchase-orders/${id}`);
  }

  function cancel() {
    goto(`/purchase-orders/${id}`);
  }
</script>

<svelte:head>
  <title>{po ? `Ubah ${po.code}` : 'PO tidak ditemukan'} · POS Admin</title>
</svelte:head>

{#if po && canEdit}
  <PageHeader
    title="Ubah order pembelian"
    description={po.code}
    breadcrumb={[
      { label: 'Pengadaan' },
      { label: 'Order Pembelian', href: '/purchase-orders' },
      { label: po.code, href: `/purchase-orders/${po.id}` },
      { label: 'Ubah' }
    ]}
  />

  <PurchaseOrderForm purchaseOrder={po} onSubmit={save} onCancel={cancel} submitLabel="Simpan perubahan" />
{:else if po && !canEdit}
  <PageHeader
    title="Tidak bisa diubah"
    description={`${po.code} berstatus ${po.status} — hanya Draft yang bisa diubah.`}
    breadcrumb={[
      { label: 'Pengadaan' },
      { label: 'Order Pembelian', href: '/purchase-orders' },
      { label: po.code }
    ]}
  />
  <Card>
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <ReceiptIcon class="h-6 w-6" />
      </div>
      <p class="text-sm font-medium text-slate-700">
        PO ini berstatus <strong>{po.status}</strong> dan tidak bisa diubah.
      </p>
      <p class="text-xs text-slate-500">Lihat detailnya, atau batalkan dan buat yang baru.</p>
      <Button variant="outline" onclick={() => goto(`/purchase-orders/${po.id}`)}>
        <ArrowLeft class="h-4 w-4" />
        Lihat order pembelian
      </Button>
    </div>
  </Card>
{:else}
  <PageHeader
    title="Order pembelian tidak ditemukan"
    breadcrumb={[
      { label: 'Pengadaan' },
      { label: 'Order Pembelian', href: '/purchase-orders' },
      { label: 'Tidak ditemukan' }
    ]}
  />
  <Card>
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <p class="text-sm font-medium text-slate-700">
        Tidak menemukan PO dengan id <code class="rounded bg-slate-100 px-1 font-mono">{id}</code>.
      </p>
      <Button variant="outline" onclick={() => goto('/purchase-orders')}>
        <ArrowLeft class="h-4 w-4" />
        Kembali ke daftar order pembelian
      </Button>
    </div>
  </Card>
{/if}
