import { apiFetch } from './client';

// Pass-through types — the shifts store is the source of truth for the
// nested shape (entries + cash counts).
export type ShiftSessionPayload = Record<string, unknown>;
export type ShiftSessionRecord = Record<string, unknown>;

export function listShiftSessions(params?: {
  status?: string;
  employeeId?: string;
}): Promise<ShiftSessionRecord[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.employeeId) q.set('employeeId', params.employeeId);
  const qs = q.toString();
  return apiFetch<ShiftSessionRecord[]>(`/api/shifts${qs ? `?${qs}` : ''}`);
}
export function getShiftSession(id: string): Promise<ShiftSessionRecord> {
  return apiFetch<ShiftSessionRecord>(`/api/shifts/${id}`);
}
export function createShiftSession(input: ShiftSessionPayload): Promise<ShiftSessionRecord> {
  return apiFetch<ShiftSessionRecord>('/api/shifts', { method: 'POST', body: input });
}
export function updateShiftSession(
  id: string,
  input: ShiftSessionPayload
): Promise<ShiftSessionRecord> {
  return apiFetch<ShiftSessionRecord>(`/api/shifts/${id}`, { method: 'PATCH', body: input });
}
