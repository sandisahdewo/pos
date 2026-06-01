import { customers } from './customers.svelte';
import type { PaymentMethod } from './orders.svelte';
import { settings, type ServiceType } from './settings.svelte';

export type CartLine = {
  id: string;
  productId: string;
  variantId?: string;
  unitId: string;
  unitFactor: number;
  quantity: number;
  extras: string[];
  notes: string;
};

export type CartSession = {
  id: string;
  label: string;
  customerId: string;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  dismissedPromoIds: string[];
  // F&B service metadata. Set from settings.operations.fnb.defaultServiceType when
  // a new session opens; ignored at charge time when settings.fnb.enabled is false.
  serviceType: ServiceType;
  tableNumber: string;
  createdAt: string;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function blank(label: string): CartSession {
  return {
    id: crypto.randomUUID(),
    label,
    customerId: '',
    lines: [],
    paymentMethod: 'cash',
    paymentAmount: 0,
    dismissedPromoIds: [],
    serviceType: settings.value.operations.fnb.defaultServiceType,
    tableNumber: '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

class CartSessionsStore {
  sessions = $state<CartSession[]>([blank('Tab 1')]);
  activeSessionId = $state<string>('');
  private nextLabelN = 2;

  constructor() {
    this.activeSessionId = this.sessions[0]?.id ?? '';
  }

  get active(): CartSession {
    const found = this.sessions.find((s) => s.id === this.activeSessionId);
    if (found) return found;
    // Defensive: if active was somehow cleared, reset to first or create blank
    if (this.sessions.length === 0) this.sessions.push(blank('Tab 1'));
    this.activeSessionId = this.sessions[0].id;
    return this.sessions[0];
  }

  create(): CartSession {
    const next = blank(`Tab ${this.nextLabelN++}`);
    this.sessions.push(next);
    this.activeSessionId = next.id;
    return next;
  }

  switchTo(id: string): void {
    if (this.sessions.some((s) => s.id === id)) {
      this.activeSessionId = id;
    }
  }

  close(id: string): void {
    const idx = this.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return;
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.activeSessionId === id) {
      if (this.sessions.length === 0) {
        const fresh = blank(`Tab ${this.nextLabelN++}`);
        this.sessions = [fresh];
        this.activeSessionId = fresh.id;
      } else {
        this.activeSessionId = this.sessions[Math.max(0, idx - 1)]?.id ?? this.sessions[0].id;
      }
    }
  }

  /**
   * Remove the active session (post-charge). Auto-creates a blank if empty.
   * Returns the now-active session (existing next, or freshly created).
   */
  completeActive(): CartSession {
    const currentId = this.activeSessionId;
    this.close(currentId);
    return this.active;
  }

  touch(): void {
    const s = this.active;
    s.updatedAt = nowIso();
  }

  labelFor(session: CartSession): string {
    if (session.customerId) {
      const c = customers.getById(session.customerId);
      if (c) return c.name;
    }
    return session.label;
  }
}

export const cartSessions = new CartSessionsStore();
