/**
 * Phase 6 (Configurator) — admin Textures / Colors / Variant-Images bindings.
 *
 * Cache-key + mutation pattern mirrors `catalogAdminApi` / `panelsAdminApi`.
 *
 * Backend:
 *   Textures
 *     * `GET    /api/admin/textures`                        — list all
 *     * `POST   /api/admin/textures`                        — create (201)
 *     * `PATCH  /api/admin/textures/{id}`                   — partial update
 *     * `DELETE /api/admin/textures/{id}`                   — hard delete (204)
 *   Texture Colors
 *     * `GET    /api/admin/textures/{texture_id}/colors`    — list by texture
 *     * `POST   /api/admin/textures/{texture_id}/colors`    — create (201)
 *     * `PATCH  /api/admin/texture-colors/{id}`             — partial update
 *     * `DELETE /api/admin/texture-colors/{id}`             — hard delete (204)
 *   Variant Images
 *     * `GET    /api/admin/variant-images?design_id=&texture_id=` — filtered list
 *     * `POST   /api/admin/variant-images`                  — create (201)
 *     * `DELETE /api/admin/variant-images/{id}`              — hard delete (204)
 *
 * Error envelope `{detail, code}`:
 *   * 404 `texture_not_found` / `texture_color_not_found` / `variant_image_not_found`
 *   * 409 `texture_slug_conflict` / `texture_has_variants` / `variant_image_combination_conflict`
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";

// ─── Wire types: Textures ───────────────────────────────────────────────

export interface ApiTexture {
	id: string;
	name: string;
	slug: string;
	swatch_image: string;
	sort_order: number;
	is_active: boolean;
	created_at: string;
}

export interface TextureCreatePayload {
	name: string;
	slug: string;
	swatch_image?: string;
	sort_order?: number;
	is_active?: boolean;
}

export interface TextureUpdatePayload {
	name?: string;
	slug?: string;
	swatch_image?: string;
	sort_order?: number;
	is_active?: boolean;
}

// ─── Wire types: Colors ─────────────────────────────────────────────────

export interface ApiTextureColor {
	id: string;
	texture_id: string;
	name: string;
	hex: string;
	swatch_image: string;
	sort_order: number;
	is_active: boolean;
	created_at: string;
}

export interface TextureColorCreatePayload {
	name: string;
	hex?: string;
	swatch_image?: string;
	sort_order?: number;
	is_active?: boolean;
}

export interface TextureColorUpdatePayload {
	name?: string;
	hex?: string;
	swatch_image?: string;
	sort_order?: number;
	is_active?: boolean;
}

// ─── Wire types: Variant Images ─────────────────────────────────────────

export interface ApiVariantImage {
	id: string;
	design_id: string;
	texture_id: string;
	color_id: string;
	image_path: string;
	// ── Panel Creator Wizard additions ────────────────────────────────
	size_key: string | null;
	hex: string | null;
	// ─────────────────────────────────────────────────────────────────
	created_at: string;
}

export interface VariantImageCreatePayload {
	design_id: string;
	texture_id: string;
	color_id: string;
	image_path: string;
	size_key?: string | null;
	hex?: string | null;
}

// ── Panel Creator Wizard batch types ──────────────────────────────────────

export interface VariantImageBatchItemPayload {
	texture_id: string;
	color_id: string;
	image_path: string;
	size_key?: string | null;
	hex?: string | null;
}

export interface VariantImageBatchPayload {
	design_id: string;
	variants: VariantImageBatchItemPayload[];
}

export interface VariantImageBatchResponse {
	created: ApiVariantImage[];
	updated: ApiVariantImage[];
	errors: Array<{ index: number; errors: Record<string, string> }>;
	total_processed: number;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const texturesAdminKeys = {
	texturesAll: ["admin", "textures"] as const,
	colorsAll: ["admin", "texture-colors"] as const,
	colorsByTexture: (textureId: string) =>
		["admin", "texture-colors", textureId] as const,
	variantsAll: ["admin", "variant-images"] as const,
	variantsList: (params: { designId?: string; textureId?: string }) =>
		["admin", "variant-images", params] as const,
};

// ─── Hooks: Textures ────────────────────────────────────────────────────

export function useAdminTextures() {
	return useQuery({
		queryKey: texturesAdminKeys.texturesAll,
		queryFn: () => api.get<ApiTexture[]>("/admin/textures"),
		staleTime: 30_000,
		retry: false,
	});
}

export function useCreateTexture() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: TextureCreatePayload) =>
			api.post<ApiTexture>("/admin/textures", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.texturesAll });
		},
	});
}

export function useUpdateTexture() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			textureId,
			body,
		}: {
			textureId: string;
			body: TextureUpdatePayload;
		}) => api.patch<ApiTexture>(`/admin/textures/${textureId}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.texturesAll });
		},
	});
}

export function useDeleteTexture() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (textureId: string) =>
			api.delete<void>(`/admin/textures/${textureId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.texturesAll });
			qc.invalidateQueries({ queryKey: texturesAdminKeys.variantsAll });
		},
	});
}

// ─── Hooks: Colors ──────────────────────────────────────────────────────

export function useAdminTextureColors(textureId: string | undefined) {
	return useQuery({
		queryKey: textureId
			? texturesAdminKeys.colorsByTexture(textureId)
			: ["admin", "texture-colors", "noop"],
		queryFn: () =>
			api.get<ApiTextureColor[]>(`/admin/textures/${textureId}/colors`),
		enabled: !!textureId,
		staleTime: 15_000,
		retry: false,
	});
}

export function useCreateTextureColor() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			textureId,
			body,
		}: {
			textureId: string;
			body: TextureColorCreatePayload;
		}) =>
			api.post<ApiTextureColor>(`/admin/textures/${textureId}/colors`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.colorsAll });
		},
	});
}

export function useUpdateTextureColor() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			colorId,
			body,
		}: {
			colorId: string;
			body: TextureColorUpdatePayload;
		}) => api.patch<ApiTextureColor>(`/admin/texture-colors/${colorId}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.colorsAll });
		},
	});
}

export function useDeleteTextureColor() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (colorId: string) =>
			api.delete<void>(`/admin/texture-colors/${colorId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.colorsAll });
			qc.invalidateQueries({ queryKey: texturesAdminKeys.variantsAll });
		},
	});
}

// ─── Hooks: Variant Images ──────────────────────────────────────────────

export function useAdminVariantImages(params: {
	designId?: string;
	textureId?: string;
}) {
	const hasFilter = !!params.designId && !!params.textureId;
	return useQuery({
		queryKey: texturesAdminKeys.variantsList(params),
		queryFn: () => {
			const qs = new URLSearchParams();
			if (params.designId) qs.set("design_id", params.designId);
			if (params.textureId) qs.set("texture_id", params.textureId);
			const suffix = qs.toString() ? `?${qs.toString()}` : "";
			return api.get<ApiVariantImage[]>(`/admin/variant-images${suffix}`);
		},
		enabled: hasFilter,
		staleTime: 15_000,
		retry: false,
	});
}

export function useCreateVariantImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: VariantImageCreatePayload) =>
			api.post<ApiVariantImage>("/admin/variant-images", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.variantsAll });
		},
	});
}

export function useDeleteVariantImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (variantId: string) =>
			api.delete<void>(`/admin/variant-images/${variantId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.variantsAll });
		},
	});
}

// ─── Panel Creator Wizard batch hooks ──────────────────────────────────────

export function useCreateVariantImageBatch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: VariantImageBatchPayload) =>
			api.post<VariantImageBatchResponse>("/admin/variant-images/batch", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: texturesAdminKeys.variantsAll });
		},
	});
}
