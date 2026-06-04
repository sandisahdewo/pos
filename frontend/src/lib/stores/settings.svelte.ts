import { getSettings, putSettings } from '$lib/api/settings';

export type ShiftRules = {
  /** Pre-fill kas awal from the closing cash of this employee's most recent closed shift. */
  inheritOpeningFromPrevClose: boolean;
  /** When |variance| exceeds this amount at close-time, show an extra warning. */
  varianceWarnThreshold: number;
  /** Lock /pos transactions until a shift is open. Not yet wired to behavior. */
  requireShiftBeforePos: boolean;
};

export type ServiceType = 'dineIn' | 'takeAway';

export type FnbSettings = {
  /** Master toggle. When off, /pos hides the service type selector and orders skip the snapshot. */
  enabled: boolean;
  /** Pre-fill new cart sessions with this type. */
  defaultServiceType: ServiceType;
  /** When true, dine-in orders cannot be submitted with an empty table number. */
  requireTableNumber: boolean;
};

export type Settings = {
  inventory: {
    locationsEnabled: boolean;
    auditTrailEnabled: boolean;
  };
  operations: {
    shiftsEnabled: boolean;
    shiftRules: ShiftRules;
    fnb: FnbSettings;
  };
};

const defaultShiftRules: ShiftRules = {
  inheritOpeningFromPrevClose: false,
  varianceWarnThreshold: 5000,
  requireShiftBeforePos: false
};

const defaultFnb: FnbSettings = {
  enabled: false,
  defaultServiceType: 'takeAway',
  requireTableNumber: true
};

function defaultSettings(): Settings {
  return {
    inventory: {
      locationsEnabled: true,
      auditTrailEnabled: true
    },
    operations: {
      shiftsEnabled: true,
      shiftRules: { ...defaultShiftRules },
      fnb: { ...defaultFnb }
    }
  };
}

// Deep-merge server value over defaults so missing keys (newly added settings)
// fall back to sane defaults without crashing the UI.
function mergeSettings(stored: unknown): Settings {
  const base = defaultSettings();
  if (!stored || typeof stored !== 'object') return base;
  const s = stored as Partial<Settings>;
  if (s.inventory) {
    base.inventory.locationsEnabled =
      s.inventory.locationsEnabled ?? base.inventory.locationsEnabled;
    base.inventory.auditTrailEnabled =
      s.inventory.auditTrailEnabled ?? base.inventory.auditTrailEnabled;
  }
  if (s.operations) {
    base.operations.shiftsEnabled =
      s.operations.shiftsEnabled ?? base.operations.shiftsEnabled;
    if (s.operations.shiftRules) {
      base.operations.shiftRules = {
        ...base.operations.shiftRules,
        ...s.operations.shiftRules
      };
    }
    if (s.operations.fnb) {
      base.operations.fnb = { ...base.operations.fnb, ...s.operations.fnb };
    }
  }
  return base;
}

class SettingsStore {
  value = $state<Settings>(defaultSettings());
  loaded = $state(false);
  loading = $state(false);

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const res = await getSettings();
      this.value = mergeSettings(res.value);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  // Persist the current value to the backend. Best-effort fire-and-forget
  // so /settings toggles feel instant — failures don't roll back the UI.
  private persist(): void {
    void putSettings(this.value).catch(() => {
      /* leave optimistic state — surfaces if user reloads */
    });
  }

  setLocationsEnabled(on: boolean): void {
    this.value.inventory.locationsEnabled = on;
    this.persist();
  }

  setAuditTrailEnabled(on: boolean): void {
    this.value.inventory.auditTrailEnabled = on;
    this.persist();
  }

  setShiftsEnabled(on: boolean): void {
    this.value.operations.shiftsEnabled = on;
    this.persist();
  }

  setShiftRule<K extends keyof ShiftRules>(key: K, value: ShiftRules[K]): void {
    this.value.operations.shiftRules[key] = value;
    this.persist();
  }

  setFnbEnabled(on: boolean): void {
    this.value.operations.fnb.enabled = on;
    this.persist();
  }

  setFnbField<K extends keyof FnbSettings>(key: K, value: FnbSettings[K]): void {
    this.value.operations.fnb[key] = value;
    this.persist();
  }
}

export const settings = new SettingsStore();

export function locationsEnabled(): boolean {
  return settings.value.inventory.locationsEnabled;
}

export function auditTrailEnabled(): boolean {
  return settings.value.inventory.auditTrailEnabled;
}

export function shiftsEnabled(): boolean {
  return settings.value.operations.shiftsEnabled;
}

export function shiftRules(): ShiftRules {
  return settings.value.operations.shiftRules;
}

export function fnbEnabled(): boolean {
  return settings.value.operations.fnb.enabled;
}

export function fnbSettings(): FnbSettings {
  return settings.value.operations.fnb;
}

export const serviceTypeLabels: Record<ServiceType, string> = {
  dineIn: 'Dine-in',
  takeAway: 'Take-away'
};
