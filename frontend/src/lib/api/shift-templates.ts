import { apiFetch } from './client';

export type ApiShiftTemplateStatus = 'active' | 'archived';

export type ApiShiftTemplate = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: ApiShiftTemplateStatus;
  createdAt: string;
  updatedAt: string;
};

export type ShiftTemplateInput = {
  name: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: ApiShiftTemplateStatus;
};

export function listShiftTemplates(): Promise<ApiShiftTemplate[]> {
  return apiFetch<ApiShiftTemplate[]>('/api/shift-templates');
}
export function createShiftTemplate(input: ShiftTemplateInput): Promise<ApiShiftTemplate> {
  return apiFetch<ApiShiftTemplate>('/api/shift-templates', { method: 'POST', body: input });
}
export function updateShiftTemplate(id: string, input: ShiftTemplateInput): Promise<ApiShiftTemplate> {
  return apiFetch<ApiShiftTemplate>(`/api/shift-templates/${id}`, { method: 'PATCH', body: input });
}
export function deleteShiftTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/api/shift-templates/${id}`, { method: 'DELETE' });
}
