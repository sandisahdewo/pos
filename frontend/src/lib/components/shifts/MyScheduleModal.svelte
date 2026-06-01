<script lang="ts">
  import { CalendarDays, CalendarOff, CalendarClock, ExternalLink } from 'lucide-svelte';
  import { Badge, Button, Modal } from '$lib/components/ui';
  import {
    shiftSchedule,
    toISODate,
    parseISODate,
    addDays,
    assignmentStatusLabels,
    assignmentStatusVariant,
    type ShiftAssignment,
    type AssignmentStatus
  } from '$lib/stores/shiftSchedule.svelte';
  import { shiftTemplates } from '$lib/stores/shiftTemplates.svelte';
  import { user } from '$lib/stores/user.svelte';

  type Props = {
    open: boolean;
  };

  let { open = $bindable(false) }: Props = $props();

  const PAST_DAYS = 3;
  const FUTURE_DAYS = 14;

  type Row = {
    date: string;
    bucket: 'past' | 'today' | 'future';
    assignments: Array<{
      assignment: ShiftAssignment;
      tplName: string;
      tplRange: string;
    }>;
  };

  function fmtDate(iso: string): string {
    const d = parseISODate(iso);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  const rows = $derived.by<Row[]>(() => {
    const empId = user.current?.id;
    if (!empId) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startISO = toISODate(addDays(today, -PAST_DAYS));
    const endISO = toISODate(addDays(today, FUTURE_DAYS));
    const todayISO = toISODate(today);

    const items = shiftSchedule
      .forEmployee(empId, { start: startISO, end: endISO })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const grouped = new Map<string, ShiftAssignment[]>();
    for (const a of items) {
      const list = grouped.get(a.date) ?? [];
      list.push(a);
      grouped.set(a.date, list);
    }

    return Array.from(grouped.entries()).map(([date, assignments]) => {
      const bucket: Row['bucket'] = date < todayISO ? 'past' : date === todayISO ? 'today' : 'future';
      return {
        date,
        bucket,
        assignments: assignments
          .map((a) => {
            const tpl = shiftTemplates.getById(a.templateId);
            return {
              assignment: a,
              tplName: tpl?.name ?? '—',
              tplRange: tpl ? `${tpl.startTime}–${tpl.endTime}` : ''
            };
          })
          .sort((a, b) => a.tplRange.localeCompare(b.tplRange))
      };
    });
  });

  const todayRow = $derived(rows.find((r) => r.bucket === 'today'));
  const upcomingRows = $derived(rows.filter((r) => r.bucket === 'future'));
  const pastRows = $derived(rows.filter((r) => r.bucket === 'past'));

  function statusBadge(s: AssignmentStatus) {
    return { variant: assignmentStatusVariant[s], label: assignmentStatusLabels[s] };
  }
</script>

<Modal
  bind:open
  size="lg"
  title="Jadwal Saya"
  description="Ringkasan jadwal shift untuk akun yang sedang masuk."
>
  <div class="space-y-5">
    <div class="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5">
      <p class="text-xs text-slate-500">Login sebagai</p>
      <p class="text-sm font-medium text-slate-900">
        {user.current?.name ?? 'Tamu'}
        <span class="font-normal text-slate-500">· {user.roleLabel}</span>
      </p>
    </div>

    <section>
      <h3 class="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Hari ini
      </h3>
      {#if todayRow}
        <div class="rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2.5">
          <div class="text-sm font-semibold text-slate-900">{fmtDate(todayRow.date)}</div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            {#each todayRow.assignments as a (a.assignment.id)}
              {@const sb = statusBadge(a.assignment.status)}
              <span
                class="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
              >
                <CalendarClock class="h-3 w-3 text-slate-400" />
                <span class="font-medium">{a.tplName}</span>
                <span class="text-slate-400">·</span>
                <span>{a.tplRange}</span>
                <Badge variant={sb.variant} size="sm">{sb.label}</Badge>
              </span>
            {/each}
          </div>
        </div>
      {:else}
        <div class="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">
          <CalendarOff class="h-4 w-4 text-slate-400" />
          Tidak ada jadwal hari ini.
        </div>
      {/if}
    </section>

    <section>
      <h3 class="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Akan datang ({FUTURE_DAYS} hari ke depan)
      </h3>
      {#if upcomingRows.length === 0}
        <div class="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">
          <CalendarDays class="h-4 w-4 text-slate-400" />
          Belum ada jadwal mendatang.
        </div>
      {:else}
        <ul class="space-y-1.5">
          {#each upcomingRows as row (row.date)}
            <li
              class="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-3 py-2"
            >
              <span class="min-w-[150px] text-sm font-medium text-slate-700">
                {fmtDate(row.date)}
              </span>
              <div class="flex flex-wrap gap-1.5">
                {#each row.assignments as a (a.assignment.id)}
                  {@const sb = statusBadge(a.assignment.status)}
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  >
                    <span class="font-medium">{a.tplName}</span>
                    <span class="text-slate-400">·</span>
                    <span>{a.tplRange}</span>
                    <Badge variant={sb.variant} size="sm">{sb.label}</Badge>
                  </span>
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if pastRows.length > 0}
      <section>
        <h3 class="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Sudah lewat ({PAST_DAYS} hari terakhir)
        </h3>
        <ul class="space-y-1.5">
          {#each pastRows as row (row.date)}
            <li
              class="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/40 px-3 py-2"
            >
              <span class="min-w-[150px] text-sm font-medium text-slate-600">
                {fmtDate(row.date)}
              </span>
              <div class="flex flex-wrap gap-1.5">
                {#each row.assignments as a (a.assignment.id)}
                  {@const sb = statusBadge(a.assignment.status)}
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs text-slate-600"
                  >
                    <span class="font-medium">{a.tplName}</span>
                    <span class="text-slate-400">·</span>
                    <span>{a.tplRange}</span>
                    <Badge variant={sb.variant} size="sm">{sb.label}</Badge>
                  </span>
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (open = false)}>Tutup</Button>
    <Button href="/shifts/schedule" variant="primary">
      <ExternalLink class="h-4 w-4" />
      Lihat kalender lengkap
    </Button>
  {/snippet}
</Modal>
