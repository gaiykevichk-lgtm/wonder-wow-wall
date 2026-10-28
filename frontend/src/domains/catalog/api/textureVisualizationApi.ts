/** Public API hooks для TextureVisualization — блок «WWW в дизайне». */
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api/client";
import type { ApiError } from "../../../shared/api/client";

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

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const textureVisualizationKeys = {
	byTexture: (textureId: string) =>
		["texture-visualizations", textureId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** GET /api/textures/{textureId}/visualization — получить визуализацию фактуры */
export function useTextureVisualization(textureId: string) {
	return useQuery<ApiTextureVisualization | null, ApiError>({
		queryKey: textureVisualizationKeys.byTexture(textureId),
		queryFn: async () => {
			const data = await api.get<ApiTextureVisualization | null>(
				`/textures/${textureId}/visualization`,
			);
			return data;
		},
		enabled: !!textureId,
	});
}
