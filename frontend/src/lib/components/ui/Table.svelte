<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  // `key` accepts any string so callers can declare "virtual" columns (e.g. a
  // derived Stock column whose value isn't a field on Row). Known field names still
  // autocomplete via the `keyof Row & string` branch.
  type Column<Row> = {
    key: (keyof Row & string) | (string & {});
    label: string;
    align?: 'left' | 'right' | 'center';
    width?: string;
  };

  type Props = {
    columns: Column<T>[];
    rows: T[];
    rowKey?: (row: T) => string | number;
    empty?: Snippet;
    cell?: Snippet<[{ row: T; column: Column<T>; value: unknown }]>;
    class?: string;
  };

  let { columns, rows, rowKey, empty, cell, class: klass = '' }: Props = $props();

  const alignClass = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center'
  } as const;
</script>

<div class="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card {klass}">
  <div class="scrollbar-thin overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50">
        <tr>
          {#each columns as col}
            <th
              scope="col"
              style={col.width ? `width: ${col.width}` : ''}
              class="px-4 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase {alignClass[
                col.align ?? 'left'
              ]}"
            >
              {col.label}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#if rows.length === 0}
          <tr>
            <td colspan={columns.length} class="px-4 py-10 text-center text-sm text-slate-500">
              {#if empty}
                {@render empty()}
              {:else}
                No data available
              {/if}
            </td>
          </tr>
        {:else}
          {#each rows as row, i (rowKey ? rowKey(row) : i)}
            <tr class="transition-colors hover:bg-slate-50">
              {#each columns as col}
                <td class="px-4 py-3 text-slate-700 {alignClass[col.align ?? 'left']}">
                  {#if cell}
                    {@render cell({ row, column: col, value: (row as Record<string, unknown>)[col.key] })}
                  {:else}
                    {(row as Record<string, unknown>)[col.key]}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
