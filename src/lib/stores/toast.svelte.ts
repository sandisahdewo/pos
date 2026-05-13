export type ToastType = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
};

class ToastStore {
  toasts = $state<Toast[]>([]);
  private nextId = 1;

  push(input: Omit<Toast, 'id'>, duration = 4000): number {
    const id = this.nextId++;
    this.toasts.push({ ...input, id });
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
    return id;
  }

  info(title: string, message?: string) {
    return this.push({ type: 'info', title, message });
  }
  success(title: string, message?: string) {
    return this.push({ type: 'success', title, message });
  }
  warning(title: string, message?: string) {
    return this.push({ type: 'warning', title, message });
  }
  error(title: string, message?: string) {
    return this.push({ type: 'error', title, message });
  }

  remove(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clear() {
    this.toasts = [];
  }
}

export const toast = new ToastStore();
