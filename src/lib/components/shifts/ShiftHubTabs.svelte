<script lang="ts">
  import { page } from '$app/state';
  import { CalendarClock, CalendarDays, FileClock, SlidersHorizontal } from 'lucide-svelte';

  type Tab = {
    label: string;
    href: string;
    icon: typeof CalendarClock;
    /** Match exact pathname, otherwise treat sub-paths as still on this tab. */
    exact?: boolean;
  };

  const tabs: Tab[] = [
    { label: 'Sesi', href: '/shifts', icon: CalendarClock, exact: true },
    { label: 'Jadwal', href: '/shifts/schedule', icon: CalendarDays },
    { label: 'Template', href: '/shifts/templates', icon: FileClock },
    { label: 'Aturan', href: '/shifts/rules', icon: SlidersHorizontal }
  ];

  function isActive(tab: Tab): boolean {
    const path = page.url.pathname;
    if (tab.exact) return path === tab.href;
    return path === tab.href || path.startsWith(tab.href + '/');
  }
</script>

<div role="tablist" class="-mt-2 mb-5 flex gap-1 border-b border-slate-200 overflow-x-auto">
  {#each tabs as tab (tab.href)}
    {@const active = isActive(tab)}
    <a
      role="tab"
      href={tab.href}
      aria-selected={active}
      class="-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors
        {active
        ? 'border-brand-600 text-brand-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'}"
    >
      <tab.icon class="h-4 w-4 {active ? 'text-brand-600' : 'text-slate-400'}" />
      {tab.label}
    </a>
  {/each}
</div>
