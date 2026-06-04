import { apiFetch } from './client';

export type SettingsRecord = { value: unknown; updatedAt: string };

export function getSettings(): Promise<SettingsRecord> {
  return apiFetch<SettingsRecord>('/api/settings');
}
export function putSettings(value: unknown): Promise<SettingsRecord> {
  return apiFetch<SettingsRecord>('/api/settings', { method: 'PUT', body: { value } });
}
