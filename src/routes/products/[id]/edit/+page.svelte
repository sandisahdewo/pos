<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ArrowLeft, PackageX } from 'lucide-svelte';
  import { Button, Card, PageHeader } from '$lib/components/ui';
  import ProductForm from '$lib/components/products/ProductForm.svelte';
  import { products, type ProductInput } from '$lib/stores/products.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const id = $derived(page.params.id ?? '');
  const product = $derived(id ? products.getById(id) : undefined);

  function save(data: ProductInput) {
    const updated = products.update(id, data);
    if (!updated) throw new Error(`Product ${id} not found during save.`);
    toast.success('Produk diperbarui', data.name);
    goto('/products');
    return updated;
  }

  function cancel() {
    goto('/products');
  }
</script>

<svelte:head>
  <title>{product ? `Ubah · ${product.name}` : 'Produk tidak ditemukan'} · POS Admin</title>
</svelte:head>

{#if product}
  <PageHeader
    title="Ubah produk"
    description={product.name}
    breadcrumb={[
      { label: 'Data Master' },
      { label: 'Produk', href: '/products' },
      { label: product.name }
    ]}
  />

  <ProductForm {product} onSubmit={save} onCancel={cancel} submitLabel="Simpan perubahan" />
{:else}
  <PageHeader
    title="Produk tidak ditemukan"
    breadcrumb={[
      { label: 'Data Master' },
      { label: 'Produk', href: '/products' },
      { label: 'Tidak ditemukan' }
    ]}
  />
  <Card>
    <div class="flex flex-col items-center gap-3 py-10 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <PackageX class="h-6 w-6" />
      </div>
      <p class="text-sm font-medium text-slate-700">
        Produk dengan id <code class="rounded bg-slate-100 px-1 font-mono">{id}</code> tidak ditemukan.
      </p>
      <p class="text-xs text-slate-500">Mungkin sudah dihapus atau link-nya salah.</p>
      <Button variant="outline" onclick={() => goto('/products')}>
        <ArrowLeft class="h-4 w-4" />
        Kembali ke daftar produk
      </Button>
    </div>
  </Card>
{/if}
