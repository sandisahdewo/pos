<script lang="ts">
  type Props = {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
  };

  let { size = 'md', class: klass = '' }: Props = $props();

  const sizeMap = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  } as const;
</script>

<svg
  class="animate-spin text-brand-600 {sizeMap[size]} {klass}"
  viewBox="0 0 24 24"
  fill="none"
  aria-label="Memuat"
>
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
</svg>
