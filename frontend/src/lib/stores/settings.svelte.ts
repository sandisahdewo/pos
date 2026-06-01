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

class SettingsStore {
  value = $state<Settings>({
    inventory: {
      locationsEnabled: true,
      auditTrailEnabled: true
    },
    operations: {
      shiftsEnabled: true,
      shiftRules: { ...defaultShiftRules },
      fnb: { ...defaultFnb }
    }
  });

  setLocationsEnabled(on: boolean): void {
    this.value.inventory.locationsEnabled = on;
  }

  setAuditTrailEnabled(on: boolean): void {
    this.value.inventory.auditTrailEnabled = on;
  }

  setShiftsEnabled(on: boolean): void {
    this.value.operations.shiftsEnabled = on;
  }

  setShiftRule<K extends keyof ShiftRules>(key: K, value: ShiftRules[K]): void {
    this.value.operations.shiftRules[key] = value;
  }

  setFnbEnabled(on: boolean): void {
    this.value.operations.fnb.enabled = on;
  }

  setFnbField<K extends keyof FnbSettings>(key: K, value: FnbSettings[K]): void {
    this.value.operations.fnb[key] = value;
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
