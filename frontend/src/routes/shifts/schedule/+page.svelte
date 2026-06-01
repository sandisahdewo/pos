<script lang="ts">
  import { ChevronLeft, ChevronRight, Wand2, CalendarDays } from 'lucide-svelte';
  import { Badge, Button, Card, PageHeader } from '$lib/components/ui';
  import ShiftHubTabs from '$lib/components/shifts/ShiftHubTabs.svelte';
  import {
    shiftSchedule,
    parseISODate,
    toISODate,
    addDays,
    dayOfWeekShort,
    type ShiftAssignment
  } from '$lib/stores/shiftSchedule.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import { employees } from '$lib/stores/employees.svelte';
  import AssignmentModal from '$lib/components/shifts/AssignmentModal.svelte';
  import BulkGenerateModal from '$lib/components/shifts/BulkGenerateModal.svelte';

  function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  // Indonesian week starts Senin (Monday = 1). We want our grid to start on Senin.
  function weekStart(d: Date): Date {
    const dow = d.getDay(); // 0=Sun..6=Sat
    const offset = dow === 0 ? -6 : 1 - dow;
    return addDays(d, offset);
  }

  function sameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  function fmtMonthYear(d: Date): string {
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  const today = new Date();
  const todayISO = toISODate(today);

  let viewDate = $state(new Date(today.getFullYear(), today.getMonth(), 1));

  let assignmentModalOpen = $state(false);
  let bulkModalOpen = $state(false);
  let modalDate = $state(toISODate(today));
  let editingAssignment = $state<ShiftAssignment | undefined>(undefined);

  // Build calendar grid (always 6 rows × 7 cols = 42 days). First day is weekStart(monthStart).
  const calendarDays = $derived.by(() => {
    const monthStart = startOfMonth(viewDate);
    const first = weekStart(monthStart);
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
  });

  const monthStartISO = $derived(toISODate(startOfMonth(viewDate)));
  const monthEndISO = $derived(toISODate(endOfMonth(viewDate)));

  // Range expanded slightly to cover the calendar's first/last partial weeks.
  const visibleAssignments = $derived.by(() => {
    if (calendarDays.length === 0) return [] as ShiftAssignment[];
    const start = toISODate(calendarDays[0]);
    const end = toISODate(calendarDays[calendarDays.length - 1]);
    return shiftSchedule.forRange(start, end);
  });

  function assignmentsOn(iso: string): ShiftAssignment[] {
    return visibleAssignments.filter((a) => a.date === iso);
  }

  // Color palette per template (stable mapping via template index).
  const templatePalette = [
    { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500' },
    { bg: 'bg-violet-100', text: 'text-violet-800', dot: 'bg-violet-500' },
    { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' }
  ];

  function tplColor(templateId: string) {
    const idx = shiftTemplates.items.findIndex((t) => t.id === templateId);
    if (idx === -1) return { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' };
    return templatePalette[idx % templatePalette.length];
  }

  function empInitial(employeeId: string): string {
    const name = employees.getById(employeeId)?.name ?? '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function empName(employeeId: string): string {
    return employees.getById(employeeId)?.name ?? '—';
  }

  function tplName(templateId: string): string {
    return shiftTemplates.getById(templateId)?.name ?? '—';
  }

  function prevMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  }
  function nextMonth() {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  }
  function goToday() {
    viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  function clickCell(d: Date) {
    modalDate = toISODate(d);
    editingAssignment = undefined;
    assignmentModalOpen = true;
  }

  function clickAssignment(a: ShiftAssignment, evt: Event) {
    evt.stopPropagation();
    modalDate = a.date;
    editingAssignment = a;
    assignmentModalOpen = true;
  }

  const monthAssignmentCount = $derived(
    shiftSchedule.forRange(monthStartISO, monthEndISO).length
  );

  const dayHeadersOrdered = [1, 2, 3, 4, 5, 6, 0] as const;
</script>

<svelte:head>
  <title>Jadwal Shift · POS Admin</title>
</svelte:head>

<PageHeader
  title="Shift Kasir"
  description="Atur siapa shift kapan untuk satu minggu, sebulan, atau lebih."
  breadcrumb={[
    { label: 'Operasional' },
    { label: 'Shift Kasir', href: '/shifts' },
    { label: 'Jadwal' }
  ]}
>
  {#snippet actions()}
    <Button onclick={() => (bulkModalOpen = true)}>
      <Wand2 class="h-4 w-4" />
      Generate massal
    </Button>
  {/snippet}
</PageHeader>

<ShiftHubTabs />

<Card padded={false} class="overflow-hidden">
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Bulan sebelumnya"
        onclick={prevMonth}
      >
        <ChevronLeft class="h-4 w-4" />
      </button>
      <h2 class="px-2 text-base font-semibold text-slate-900">
        {fmtMonthYear(viewDate)}
      </h2>
      <button
        type="button"
        class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Bulan berikutnya"
        onclick={nextMonth}
      >
        <ChevronRight class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="ml-2 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        onclick={goToday}
      >
        Hari ini
      </button>
    </div>

    <div class="flex-1"></div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-slate-500">{monthAssignmentCount} jadwal bulan ini</span>
      {#each shiftTemplates.active() as t (t.id)}
        {@const c = tplColor(t.id)}
        <div class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full {c.dot}"></span>
          <span class="text-xs text-slate-600">{t.name}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
    {#each dayHeadersOrdered as dow}
      <div class="px-2 py-2 text-center text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
        {dayOfWeekShort[dow]}
      </div>
    {/each}
  </div>

  <div class="grid grid-cols-7">
    {#each calendarDays as d, i (i)}
      {@const iso = toISODate(d)}
      {@const inMonth = sameMonth(d, viewDate)}
      {@const isToday = iso === todayISO}
      {@const todays = assignmentsOn(iso)}
      <button
        type="button"
        class="group relative flex min-h-[120px] flex-col gap-1 border-r border-b border-slate-100 p-2 text-left transition hover:bg-slate-50
          {inMonth ? 'bg-white' : 'bg-slate-50/50'}"
        onclick={() => clickCell(d)}
      >
        <div class="flex items-center justify-between">
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
              {isToday
              ? 'bg-brand-600 text-white'
              : inMonth
              ? 'text-slate-700'
              : 'text-slate-400'}"
          >
            {d.getDate()}
          </span>
          {#if todays.length > 3}
            <span class="text-[10px] text-slate-400">+{todays.length - 3}</span>
          {/if}
        </div>

        <div class="flex flex-col gap-0.5">
          {#each todays.slice(0, 3) as a (a.id)}
            {@const c = tplColor(a.templateId)}
            <span
              role="button"
              tabindex="0"
              class="flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium {c.bg} {c.text} hover:brightness-95"
              title={`${tplName(a.templateId)} · ${empName(a.employeeId)}`}
              onclick={(e) => clickAssignment(a, e)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') clickAssignment(a, e);
              }}
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {c.dot}"></span>
              <span class="truncate">{empInitial(a.employeeId)} · {tplName(a.templateId)}</span>
            </span>
          {/each}
        </div>
      </button>
    {/each}
  </div>
</Card>

{#if visibleAssignments.length === 0}
  <Card class="mt-4">
    <div class="flex flex-col items-center gap-2 py-6 text-center">
      <CalendarDays class="h-10 w-10 text-slate-300" />
      <p class="text-sm font-medium text-slate-700">Belum ada jadwal untuk bulan ini</p>
      <p class="max-w-md text-xs text-slate-500">
        Klik tanggal mana saja untuk menambah satu jadwal, atau gunakan "Generate massal" untuk menyusun pola berulang sekaligus untuk seminggu, sebulan, atau setahun.
      </p>
      <Button class="mt-2" onclick={() => (bulkModalOpen = true)}>
        <Wand2 class="h-4 w-4" />
        Buat jadwal massal
      </Button>
    </div>
  </Card>
{/if}

<AssignmentModal
  bind:open={assignmentModalOpen}
  date={modalDate}
  editing={editingAssignment}
/>
<BulkGenerateModal bind:open={bulkModalOpen} defaultStart={monthStartISO} />
