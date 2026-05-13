<script lang="ts">
  import { goto } from '$app/navigation';
  import { PageHeader } from '$lib/components/ui';
  import ProductForm from '$lib/components/products/ProductForm.svelte';
  import { products, type ProductInput } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  function save(data: ProductInput) {
    const created = products.add(data);
    toast.success('Produk ditambahkan', created.name);
    goto('/products');
    return created;
  }

  function cancel() {
    goto('/products');
  }
</script>

<svelte:head>
  <title>Produk baru · POS Admin</title>
</svelte:head>

<PageHeader
  title="Produk baru"
  description="Tambahkan item ke katalog. Aktifkan mode lanjutan untuk multi-satuan dan varian."
  breadcrumb={[
    { label: 'Data Master' },
    { label: 'Produk', href: '/products' },
    { label: 'Baru' }
  ]}
/>

<ProductForm onSubmit={save} onCancel={cancel} submitLabel="Tambah produk" />
