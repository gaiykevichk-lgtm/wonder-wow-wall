import { api } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface PlacedPanelPayload {
  design_id: string;
  design_name: string;
  design_image: string;
  size_key: string;
  color: string;
  color_name: string;
  x: number;
  y: number;
  render_width: number;
  render_height: number;
}

export interface VisualizationProjectPayload {
  name: string;
  photo_url: string;
  photo_width: number;
  photo_height: number;
  wall_mask_base64: string;
  calibration_pixels_per_cm: number;
  panels: PlacedPanelPayload[];
  perspective_corners: { x: number; y: number }[] | null;
  placement_mode: string;
}

export interface VisualizationProjectResponse extends VisualizationProjectPayload {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface VisualizationProjectListItem {
  id: string;
  name: string;
  photo_width: number;
  photo_height: number;
  panel_count: number;
  placement_mode: string;
  created_at: string;
  updated_at: string;
}

// ─── API Functions ──────────────────────────────────────────────────

const BASE = '/visualizer/projects';

export function saveVisualizationProject(
  data: VisualizationProjectPayload,
): Promise<VisualizationProjectResponse> {
  return api.post<VisualizationProjectResponse>(BASE, data);
}

export function updateVisualizationProject(
  id: string,
  data: VisualizationProjectPayload,
): Promise<VisualizationProjectResponse> {
  return api.put<VisualizationProjectResponse>(`${BASE}/${id}`, data);
}

export function loadVisualizationProjects(): Promise<VisualizationProjectListItem[]> {
  return api.get<VisualizationProjectListItem[]>(BASE);
}

export function loadVisualizationProject(
  id: string,
): Promise<VisualizationProjectResponse> {
  return api.get<VisualizationProjectResponse>(`${BASE}/${id}`);
}

export function deleteVisualizationProject(id: string): Promise<void> {
  return api.delete<void>(`${BASE}/${id}`);
}
