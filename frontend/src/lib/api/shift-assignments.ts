import { apiFetch } from './client';

export type ApiAssignmentStatus = 'planned' | 'completed' | 'absent' | 'replaced';

export type ApiShiftAssignment = {
  id: string;
  date: string;
  templateId: string;
  employeeId: string;
  notes: string;
  status: ApiAssignmentStatus;
  actualShiftId?: string;
};

export type ShiftAssignmentInput = {
  date: string;
  templateId: string;
  employeeId: string;
  notes: string;
  status?: ApiAssignmentStatus;
  actualShiftId?: string | null;
};

export type BulkAssignmentRequest = {
  startDate: string;
  endDate: string;
  pattern: Record<string, Array<{ templateId: string; employeeId: string }>>;
  notes?: string;
};

export type BulkAssignmentResponse = { created: number; skipped: number };

export function listShiftAssignments(): Promise<ApiShiftAssignment[]> {
  return apiFetch<ApiShiftAssignment[]>('/api/shift-assignments');
}
export function createShiftAssignment(input: ShiftAssignmentInput): Promise<ApiShiftAssignment> {
  return apiFetch<ApiShiftAssignment>('/api/shift-assignments', { method: 'POST', body: input });
}
export function updateShiftAssignment(id: string, input: ShiftAssignmentInput): Promise<ApiShiftAssignment> {
  return apiFetch<ApiShiftAssignment>(`/api/shift-assignments/${id}`, {
    method: 'PATCH',
    body: input
  });
}
export function deleteShiftAssignment(id: string): Promise<void> {
  return apiFetch<void>(`/api/shift-assignments/${id}`, { method: 'DELETE' });
}
export function bulkShiftAssignments(req: BulkAssignmentRequest): Promise<BulkAssignmentResponse> {
  return apiFetch<BulkAssignmentResponse>('/api/shift-assignments/bulk', {
    method: 'POST',
    body: req
  });
}
