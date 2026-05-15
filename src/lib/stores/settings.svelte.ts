export type Settings = {
  inventory: {
    locationsEnabled: boolean;
    auditTrailEnabled: boolean;
  };
  operations: {
    shiftsEnabled: boolean;
  };
};

class SettingsStore {
  value = $state<Settings>({
    inventory: {
      locationsEnabled: true,
      auditTrailEnabled: true
    },
    operations: {
      shiftsEnabled: true
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
