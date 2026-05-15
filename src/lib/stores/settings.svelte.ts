export type Settings = {
  inventory: {
    locationsEnabled: boolean;
    auditTrailEnabled: boolean;
  };
};

class SettingsStore {
  value = $state<Settings>({
    inventory: {
      locationsEnabled: true,
      auditTrailEnabled: true
    }
  });

  setLocationsEnabled(on: boolean): void {
    this.value.inventory.locationsEnabled = on;
  }

  setAuditTrailEnabled(on: boolean): void {
    this.value.inventory.auditTrailEnabled = on;
  }
}

export const settings = new SettingsStore();

export function locationsEnabled(): boolean {
  return settings.value.inventory.locationsEnabled;
}

export function auditTrailEnabled(): boolean {
  return settings.value.inventory.auditTrailEnabled;
}
