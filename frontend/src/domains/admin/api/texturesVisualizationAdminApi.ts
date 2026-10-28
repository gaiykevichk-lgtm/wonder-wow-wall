/** Admin API hooks для TextureVisualization — блок «WWW в дизайне».
 *
 * Backend: TextureVisualization CRUD
 *   * `GET    /admin/texture-visualizations`          — список всех
 *   * `GET    /admin/texture-visualizations/{id}`    — одна
 *   * `POST   /admin/texture-visualizations`          — создать
 *   * `PATCH  /admin/texture-visualizations/{id}`    — обновить
 *   * `DELETE /admin/texture-visualizations/{id}`    — удалить
 *
 * Error envelope `{detail, code}`:
 *   * 404 `texture_visualization_not_found` / `texture_not_found`
 *   * 409 `texture_visualization_already_exists`
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../../../shared/api/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiTextureVisualization {
	id: string;
	texture_id: string;
	media_type: "image" | "video";
	media_url: string;
	poster_url: string;
	bg_image_url: string;
	title: string;
	subtitle: string;
	scroll_hint: string;
	description: string;
	is_active: boolean;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface TextureVisualizationCreatePayload {
	texture_id: string;
	media_type?: "image" | "video";
	media_url?: string;
	poster_url?: string;
	bg_image_url?: string;
	title?: string;
	subtitle?: string;
	scroll_hint?: string;
	description?: string;
	is_active?: boolean;
	sort_order?: number;
}

export interface TextureVisualizationUpdatePayload {
	media_type?: "image" | "video" | null;
	media_url?: string | null;
	poster_url?: string | null;
	bg_image_url?: string | null;
	title?: string | null;
	subtitle?: string | null;
	scroll_hint?: string | null;
	description?: string | null;
	is_active?: boolean | null;
	sort_order?: number | null;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const textureVisualizationKeys = {
	all: ["admin", "texture-visualizations"] as const,
	list: () => [...textureVisualizationKeys.all] as const,
	detail: (id: string) => [...textureVisualizationKeys.all, id] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** GET /admin/texture-visualizations — список всех визуализаций */
export function useTextureVisualizationsAdmin() {
	const result = useQuery<ApiTextureVisualization[], ApiError>({
		queryKey: textureVisualizationKeys.list(),
		queryFn: () =>
			api.get<ApiTextureVisualization[]>("/admin/texture-visualizations"),
		staleTime: 15_000,
		retry: false,
	});
	return result;
}

/** GET /admin/texture-visualizations/{id} — одна визуализация */
export function useTextureVisualizationAdmin(vizId: string | undefined) {
	return useQuery<ApiTextureVisualization, ApiError>({
		queryKey: textureVisualizationKeys.detail(vizId ?? ""),
		queryFn: () =>
			api.get<ApiTextureVisualization>(
				`/admin/texture-visualizations/${vizId}`,
			),
		enabled: !!vizId,
		staleTime: 15_000,
		retry: false,
	});
}

/** POST /admin/texture-visualizations — создать визуализацию */
export function useCreateTextureVisualization() {
	const qc = useQueryClient();
	return useMutation<
		ApiTextureVisualization,
		ApiError,
		TextureVisualizationCreatePayload
	>({
		mutationFn: (payload) =>
			api.post<ApiTextureVisualization>(
				"/admin/texture-visualizations",
				payload,
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: textureVisualizationKeys.all });
		},
	});
}

/** PATCH /admin/texture-visualizations/{id} — обновить визуализацию */
export function useUpdateTextureVisualization() {
	const qc = useQueryClient();
	return useMutation<
		ApiTextureVisualization,
		ApiError,
		{ vizId: string; payload: TextureVisualizationUpdatePayload }
	>({
		mutationFn: ({ vizId, payload }) =>
			api.patch<ApiTextureVisualization>(
				`/admin/texture-visualizations/${vizId}`,
				payload,
			),
		onSuccess: (_data, { vizId }) => {
			qc.invalidateQueries({ queryKey: textureVisualizationKeys.all });
			qc.invalidateQueries({
				queryKey: textureVisualizationKeys.detail(vizId),
			});
		},
	});
}

/** DELETE /admin/texture-visualizations/{id} — удалить визуализацию */
export function useDeleteTextureVisualization() {
	const qc = useQueryClient();
	return useMutation<void, ApiError, string>({
		mutationFn: (vizId) => api.delete(`/admin/texture-visualizations/${vizId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: textureVisualizationKeys.all });
		},
	});
}
