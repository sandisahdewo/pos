<script lang="ts">
  import { goto } from '$app/navigation';
  import { PageHeader } from '$lib/components/ui';
  import ProductForm from '$lib/components/products/ProductForm.svelte';
  import { products, type ProductInput } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  async function save(data: ProductInput) {
    try {
      const created = await products.add(data);
      toast.success('Produk ditambahkan', created.name);
      await goto('/products');
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
      toast.error('Gagal menyimpan produk', msg);
      throw err;
    }
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
