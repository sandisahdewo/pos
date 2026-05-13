<script lang="ts">
  type Props = {
    class?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'full';
  };

  let { class: klass = 'h-4 w-full', rounded = 'md' }: Props = $props();

  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  } as const;
</script>

<div class="animate-pulse bg-slate-200/80 {roundedClass[rounded]} {klass}"></div>
