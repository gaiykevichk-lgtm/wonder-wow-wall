import { api } from '../../../shared/api';

// ─── Types — match backend /api/configurator ──────────────────────────

export type AreaChoice = 'whole' | 'custom';

export interface ZoneRect {
  /** Относительные координаты (0..1) выделенной области на фото. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DialogAnswers {
  area_choice: AreaChoice;
  width_m: number;
  height_m: number;
  style: string;
  material: string;
  comment: string;
  zone: ZoneRect | null;
  panel_id: string | null;
  pro_mode?: boolean;
  texture_id?: string | null;
  variant_id?: string | null;
}

export interface ProposalCalc {
  boxes_count: number;
  panels_count: number;
  actual_area: number;
  purchase_price: number;
  price_per_m2: number | null;
}

export interface Proposal {
  id: string;
  variant_tag: string;
  texture_name: string;
  color_name: string;
  style: string;
  area_m2: number;
  coverage: string;
  status: 'ready' | 'visualization_failed';
  preview_url: string | null;
  reason: string;
  calc: ProposalCalc | null;
}

export interface SessionState {
  id: string;
  photo_url: string;
  answers: DialogAnswers | null;
  proposals: Proposal[];
}

export interface ProposalsResponse {
  session_id: string;
  proposals: Proposal[];
}

export interface StitchResponse {
  panorama_url: string;
  photos_used: number;
}

// ─── Defaults — соответствуют CFG-04 («вся стена» по умолчанию) ────

export const DEFAULT_ANSWERS: DialogAnswers = {
  area_choice: 'whole',
  width_m: 3.2,
  height_m: 2.7,
  style: 'Современный',
  material: 'Камень и дерево',
  comment: '',
  zone: null,
  panel_id: null,
};

// ─── API calls ──────────────────────────────────────────────────────

export async function createSession(file: File): Promise<{ id: string; photo_url: string }> {
  const form = new FormData();
  form.append('file', file);
  return api.upload<{ id: string; photo_url: string }>(
    '/configurator/sessions',
    form,
  );
}

export async function getSession(id: string): Promise<SessionState> {
  return api.get<SessionState>(`/configurator/sessions/${id}`);
}

export async function updateSession(id: string, answers: DialogAnswers): Promise<SessionState> {
  return api.put<SessionState>(`/configurator/sessions/${id}`, answers);
}

export async function generateProposals(
  id: string,
  answers: DialogAnswers,
): Promise<ProposalsResponse> {
  return api.post<ProposalsResponse>(
    `/configurator/sessions/${id}/proposals`,
    answers,
  );
}

export async function stitchPanorama(files: File[]): Promise<StitchResponse> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return api.upload<StitchResponse>('/configurator/stitch', form);
}
