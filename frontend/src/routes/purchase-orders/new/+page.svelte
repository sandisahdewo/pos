<script lang="ts">
  import { goto } from '$app/navigation';
  import { PageHeader } from '$lib/components/ui';
  import PurchaseOrderForm from '$lib/components/purchase-orders/PurchaseOrderForm.svelte';
  import {
    purchaseOrders,
    type PurchaseOrderInput
  } from '$lib/stores/purchaseOrders.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  function save(data: PurchaseOrderInput) {
    const created = purchaseOrders.add(data);
    toast.success('Order pembelian dibuat', created.code);
    goto(`/purchase-orders/${created.id}`);
  }

  function cancel() {
    goto('/purchase-orders');
  }
</script>

<svelte:head>
  <title>Order pembelian baru · POS Admin</title>
</svelte:head>

<PageHeader
  title="Order pembelian baru"
  description="Buat order ke pemasok. Simpan sebagai Draft, lalu tandai Terkirim dan terima saat barang datang."
  breadcrumb={[
    { label: 'Pengadaan' },
    { label: 'Order Pembelian', href: '/purchase-orders' },
    { label: 'Baru' }
  ]}
/>

<PurchaseOrderForm onSubmit={save} onCancel={cancel} submitLabel="Simpan draft" />
