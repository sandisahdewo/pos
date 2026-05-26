export type ShiftRules = {
  /** Pre-fill kas awal from the closing cash of this employee's most recent closed shift. */
  inheritOpeningFromPrevClose: boolean;
  /** When |variance| exceeds this amount at close-time, show an extra warning. */
  varianceWarnThreshold: number;
  /** Lock /pos transactions until a shift is open. Not yet wired to behavior. */
  requireShiftBeforePos: boolean;
};

export type Settings = {
  inventory: {
    locationsEnabled: boolean;
    auditTrailEnabled: boolean;
  };
  operations: {
    shiftsEnabled: boolean;
    shiftRules: ShiftRules;
  };
};

const defaultShiftRules: ShiftRules = {
  inheritOpeningFromPrevClose: false,
  varianceWarnThreshold: 5000,
  requireShiftBeforePos: false
};

class SettingsStore {
  value = $state<Settings>({
    inventory: {
      locationsEnabled: true,
      auditTrailEnabled: true
    },
    operations: {
      shiftsEnabled: true,
      shiftRules: { ...defaultShiftRules }
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
