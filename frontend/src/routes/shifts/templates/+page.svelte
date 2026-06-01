<script lang="ts">
  import { Plus, Trash2, Pencil, Check, X, Info } from 'lucide-svelte';
  import { Alert, Badge, Button, Card, Input, PageHeader } from '$lib/components/ui';
  import ShiftHubTabs from '$lib/components/shifts/ShiftHubTabs.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import {
    shiftTemplates,
    plannedDurationHours,
    type ShiftTemplate
  } from '$lib/stores/shiftTemplates.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  const shiftsOn = $derived(settings.value.operations.shiftsEnabled);

  let editingTplId = $state<string | null>(null);
  let tplDraft = $state<{ name: string; startTime: string; endTime: string; notes: string }>({
    name: '',
    startTime: '06:00',
    endTime: '14:00',
    notes: ''
  });
  let tplErrors = $state<{ name?: string; time?: string }>({});

  function openAddTpl() {
    editingTplId = 'new';
    tplDraft = { name: '', startTime: '06:00', endTime: '14:00', notes: '' };
    tplErrors = {};
  }

  function openEditTpl(t: ShiftTemplate) {
    editingTplId = t.id;
    tplDraft = {
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      notes: t.notes
    };
    tplErrors = {};
  }

  function cancelTpl() {
    editingTplId = null;
    tplErrors = {};
  }

  function saveTpl() {
    const next: typeof tplErrors = {};
    if (!tplDraft.name.trim()) next.name = 'Nama wajib diisi.';
    if (!/^\d{2}:\d{2}$/.test(tplDraft.startTime) || !/^\d{2}:\d{2}$/.test(tplDraft.endTime))
      next.time = 'Format jam harus HH:MM.';
    tplErrors = next;
    if (Object.keys(next).length) return;

    if (editingTplId === 'new') {
      shiftTemplates.add({
        name: tplDraft.name.trim(),
        startTime: tplDraft.startTime,
        endTime: tplDraft.endTime,
        notes: tplDraft.notes,
        status: 'active'
      });
      toast.success('Template ditambahkan', tplDraft.name);
    } else if (editingTplId) {
      shiftTemplates.update(editingTplId, {
        name: tplDraft.name.trim(),
        startTime: tplDraft.startTime,
        endTime: tplDraft.endTime,
        notes: tplDraft.notes
      });
      toast.success('Template diperbarui', tplDraft.name);
    }
    editingTplId = null;
  }

  function removeTpl(t: ShiftTemplate) {
    shiftTemplates.remove(t.id);
    toast.success('Template dihapus', t.name);
  }

  function toggleArchive(t: ShiftTemplate) {
    shiftTemplates.update(t.id, { status: t.status === 'active' ? 'archived' : 'active' });
  }
</script>

<svelte:head>
  <title>Template Shift · POS Admin</title>
</svelte:head>

<PageHeader
  title="Shift Kasir"
  description="Kelola template jam kerja yang dipakai kasir saat membuka shift."
  breadcrumb={[
    { label: 'Operasional' },
    { label: 'Shift Kasir', href: '/shifts' },
    { label: 'Template' }
  ]}
>
  {#snippet actions()}
    {#if editingTplId !== 'new'}
      <Button onclick={openAddTpl}>
        <Plus class="h-4 w-4" />
        Tambah template
      </Button>
    {/if}
  {/snippet}
</PageHeader>

<ShiftHubTabs />

{#if !shiftsOn}
  <Alert variant="warning" title="Fitur shift sedang dimatikan">
    <span class="flex items-center gap-1.5">
      <Info class="h-3.5 w-3.5" />
      Template tetap bisa dikelola, tapi tidak dipakai sampai shift diaktifkan kembali di
      <a href="/settings" class="underline">Pengaturan</a>.
    </span>
  </Alert>
{/if}

<Card class="mt-{shiftsOn ? '0' : '4'}">
  <div class="mb-3">
    <h2 class="text-base font-semibold text-slate-900">Template aktif & arsip</h2>
    <p class="mt-0.5 text-xs text-slate-500">
      Template menentukan rentang jam shift (mis. Pagi 06:00–14:00). Jam sebenarnya tetap dicatat
      sesuai waktu real saat shift dibuka.
    </p>
  </div>

  <div class="space-y-2">
    {#if editingTplId === 'new'}
      <div class="rounded-md border border-brand-200 bg-brand-50/30 p-3">
        <div class="grid gap-3 sm:grid-cols-12">
          <Input
            class="sm:col-span-4"
            label="Nama"
            placeholder="mis. Pagi"
            bind:value={tplDraft.name}
            error={tplErrors.name}
          />
          <Input
            class="sm:col-span-3"
            label="Mulai"
            type="time"
            bind:value={tplDraft.startTime}
          />
          <Input
            class="sm:col-span-3"
            label="Selesai"
            type="time"
            bind:value={tplDraft.endTime}
            error={tplErrors.time}
          />
          <Input
            class="sm:col-span-2"
            label="Catatan"
            placeholder="(opsional)"
            bind:value={tplDraft.notes}
          />
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onclick={cancelTpl}>
            <X class="h-3.5 w-3.5" />
            Batal
          </Button>
          <Button size="sm" onclick={saveTpl}>
            <Check class="h-3.5 w-3.5" />
            Simpan
          </Button>
        </div>
      </div>
    {/if}

    {#each shiftTemplates.items as t (t.id)}
      {#if editingTplId === t.id}
        <div class="rounded-md border border-brand-200 bg-brand-50/30 p-3">
          <div class="grid gap-3 sm:grid-cols-12">
            <Input
              class="sm:col-span-4"
              label="Nama"
              bind:value={tplDraft.name}
              error={tplErrors.name}
            />
            <Input
              class="sm:col-span-3"
              label="Mulai"
              type="time"
              bind:value={tplDraft.startTime}
            />
            <Input
              class="sm:col-span-3"
              label="Selesai"
              type="time"
              bind:value={tplDraft.endTime}
              error={tplErrors.time}
            />
            <Input
              class="sm:col-span-2"
              label="Catatan"
              bind:value={tplDraft.notes}
            />
          </div>
          <div class="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="outline" onclick={cancelTpl}>
              <X class="h-3.5 w-3.5" />
              Batal
            </Button>
            <Button size="sm" onclick={saveTpl}>
              <Check class="h-3.5 w-3.5" />
              Simpan
            </Button>
          </div>
        </div>
      {:else}
        <div class="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-slate-900">{t.name}</span>
              <Badge variant={t.status === 'active' ? 'success' : 'neutral'} size="sm" dot>
                {t.status === 'active' ? 'Aktif' : 'Diarsipkan'}
              </Badge>
            </div>
            <div class="mt-0.5 text-xs text-slate-500">
              {t.startTime}–{t.endTime} · {plannedDurationHours(t)} jam
              {#if t.notes}
                <span class="text-slate-400"> · {t.notes}</span>
              {/if}
            </div>
          </div>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onclick={() => toggleArchive(t)}
          >
            {t.status === 'active' ? 'Arsipkan' : 'Aktifkan'}
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Ubah"
            onclick={() => openEditTpl(t)}
          >
            <Pencil class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Hapus"
            onclick={() => removeTpl(t)}
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      {/if}
    {/each}

    {#if shiftTemplates.items.length === 0 && editingTplId !== 'new'}
      <p
        class="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500"
      >
        Belum ada template. Klik "Tambah template" untuk membuat.
      </p>
    {/if}
  </div>
</Card>
