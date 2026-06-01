<script lang="ts">
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';

  type Props = {
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    loading?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  };

  let {
    open = $bindable(false),
    title = 'Anda yakin?',
    message = 'Tindakan ini tidak bisa dibatalkan.',
    confirmLabel = 'Konfirmasi',
    cancelLabel = 'Batal',
    variant = 'danger',
    loading = false,
    onConfirm,
    onCancel
  }: Props = $props();

  function cancel() {
    open = false;
    onCancel?.();
  }

  function confirm() {
    onConfirm?.();
    open = false;
  }
</script>

<Modal bind:open {title} size="sm" onClose={onCancel}>
  <p class="text-sm text-slate-600">{message}</p>

  {#snippet footer()}
    <Button variant="outline" onclick={cancel}>{cancelLabel}</Button>
    <Button variant={variant} onclick={confirm} {loading}>{confirmLabel}</Button>
  {/snippet}
</Modal>
