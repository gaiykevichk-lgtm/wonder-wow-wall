/**
 * Phase 12 — admin PanelVariant API (wizard).
 *
 * Endpoints:
 *   GET    /api/admin/panel-variants           — list with filters
 *   GET    /api/admin/panel-variants/{id}    — single variant
 *   POST   /api/admin/panel-variants          — create single
 *   POST   /api/admin/panel-variants/batch   — batch create (wizard)
 *   PATCH  /api/admin/panel-variants/{id}    — update
 *   DELETE /api/admin/panel-variants/{id}    — delete
 *   POST   /api/admin/panel-variants/{id}/images — add image
 *   DELETE /api/admin/panel-variants/{id}/images/{path} — remove image
 *   PATCH  /api/admin/panel-variants/{id}/reorder — reorder images
 */

import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api } from "../../../shared/api";

// ─── Types ─────────────────────────────────────────────────────────────

export interface ApiPanelVariant {
	id: string;
	panel_id: string;
	name?: string;
	slug?: string;
	texture_id: string;
	color_id: string | null;
	color_hex: string | null;
	image_paths: string[];
	design_image_paths: string[];
	recommendation_image_paths: string[];
	sort_order: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ApiPanelVariantListResponse {
	items: ApiPanelVariant[];
	total: number;
	offset: number;
	limit: number;
}

// Batch variant data from wizard
export interface WizardVariantData {
	texture_id: string;
	color_id: string | null;
	color_hex: string | null;
	image_paths: string[];
	design_image_paths?: string[];
	recommendation_image_paths?: string[];
}

export interface BatchCreatePayload {
	panel_id: string;
	variants: WizardVariantData[];
}

export interface BatchCreateResponse {
	created: number;
	variants: ApiPanelVariant[];
}

export interface UpdateVariantPayload {
	name?: string;
	slug?: string;
	/** Re-assign the texture of an existing variant. `panel_id` is not
	 * patchable — the photos belong to a specific panel size. */
	texture_id?: string;
	/** @deprecated colour was removed from the product model */
	color_id?: string | null;
	/** @deprecated colour was removed from the product model */
	color_hex?: string | null;
	image_paths?: string[];
	design_image_paths?: string[];
	recommendation_image_paths?: string[];
	is_active?: boolean;
}

// ─── Query Keys ────────────────────────────────────────────────────────

export const panelVariantsAdminKeys = {
	lists: ["admin", "panel-variants", "list"] as const,
	list: (panelId?: string, isActive?: boolean) =>
		["admin", "panel-variants", "list", { panelId, isActive }] as const,
	detail: (variantId: string) =>
		["admin", "panel-variants", "detail", variantId] as const,
};

// ─── Queries ───────────────────────────────────────────────────────────

export function usePanelVariantsAdminList(params?: {
	panel_id?: string;
	is_active?: boolean | null;
	offset?: number;
	limit?: number;
	allPages?: boolean;
}) {
	const {
		panel_id,
		is_active,
		offset = 0,
		limit = 100,
		allPages = false,
	} = params ?? {};

	return useQuery({
		queryKey: [
			...panelVariantsAdminKeys.list(panel_id, is_active ?? undefined),
			{ offset, limit, allPages },
		],
		queryFn: async () => {
			const searchParams = new URLSearchParams();
			if (panel_id) searchParams.set("panel_id", panel_id);
			if (is_active !== undefined && is_active !== null) {
				searchParams.set("is_active", String(is_active));
			}
			searchParams.set("offset", String(offset));
			searchParams.set("limit", String(limit));
			if (!allPages)
				return api.get<ApiPanelVariantListResponse>(
					`/admin/panel-variants?${searchParams.toString()}`,
				);
			const items: ApiPanelVariant[] = [];
			let total = 0;
			do {
				searchParams.set("offset", String(items.length));
				searchParams.set("limit", "500");
				const page = await api.get<ApiPanelVariantListResponse>(
					`/admin/panel-variants?${searchParams}`,
				);
				items.push(...page.items);
				total = page.total;
				if (page.items.length === 0) break;
			} while (items.length < total);
			return { items, total, offset: 0, limit: items.length };
		},
		placeholderData: keepPreviousData,
		staleTime: 15_000,
	});
}

export function usePanelVariantDetail(variantId: string | undefined) {
	return useQuery({
		queryKey: panelVariantsAdminKeys.detail(variantId ?? ""),
		queryFn: () =>
			api.get<ApiPanelVariant>(`/admin/panel-variants/${variantId}`),
		enabled: !!variantId,
		staleTime: 15_000,
	});
}

// ─── Mutations ────────────────────────────────────────────────────────

export function useCreatePanelVariant() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (
			body: Omit<ApiPanelVariant, "id" | "created_at" | "updated_at">,
		) => api.post<ApiPanelVariant>("/admin/panel-variants", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useCreatePanelVariantsBatch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: BatchCreatePayload) =>
			api.post<BatchCreateResponse>("/admin/panel-variants/batch", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useUpdatePanelVariant() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			variantId,
			body,
		}: {
			variantId: string;
			body: UpdateVariantPayload;
		}) =>
			api.patch<ApiPanelVariant>(`/admin/panel-variants/${variantId}`, body),
		onSuccess: (data) => {
			qc.setQueryData(panelVariantsAdminKeys.detail(data.id), data);
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useUpdatePanelVariantRowTexture() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			panel_id: string;
			current_texture_id: string;
			texture_id: string;
		}) =>
			api.patch<ApiPanelVariant[]>("/admin/panel-variant-rows/texture", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
			qc.invalidateQueries({
				queryKey: ["admin", "panel-texture-assignments"],
			});
		},
	});
}

export function useReorderPanelVariants() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			panel_id: string;
			texture_id: string;
			ordered_ids: string[];
		}) =>
			api.patch<ApiPanelVariant[]>("/admin/panel-variant-groups/reorder", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useDeletePanelVariant() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (variantId: string) =>
			api.delete<void>(`/admin/panel-variants/${variantId}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useDeletePanelVariantGroup() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			panelId,
			textureId,
		}: {
			panelId: string;
			textureId: string;
		}) =>
			api.delete<void>(
				`/admin/panel-variant-groups?panel_id=${encodeURIComponent(panelId)}&texture_id=${encodeURIComponent(textureId)}`,
			),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists }),
	});
}

export function useDeletePanelVariantRow() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			panelId,
			textureId,
		}: {
			panelId: string;
			textureId: string;
		}) =>
			api.delete<void>(
				`/admin/panel-variant-rows?panel_id=${encodeURIComponent(panelId)}&texture_id=${encodeURIComponent(textureId)}`,
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
			qc.invalidateQueries({
				queryKey: ["admin", "panel-texture-assignments"],
			});
			qc.invalidateQueries({ queryKey: ["admin", "panels", "list"] });
		},
	});
}

export function useDuplicatePanelVariantGroup() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { panel_id: string; texture_id: string }) =>
			api.post<{
				panel: { id: string; name: string; slug: string };
				variants: ApiPanelVariant[];
			}>("/admin/panel-variant-groups/duplicate", body),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists }),
	});
}

export function useAddVariantImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			variantId,
			imagePath,
		}: {
			variantId: string;
			imagePath: string;
		}) =>
			api.post<ApiPanelVariant>(`/admin/panel-variants/${variantId}/images`, {
				image_path: imagePath,
			}),
		onSuccess: (data) => {
			qc.setQueryData(panelVariantsAdminKeys.detail(data.id), data);
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useRemoveVariantImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			variantId,
			imagePath,
		}: {
			variantId: string;
			imagePath: string;
		}) =>
			api.delete<ApiPanelVariant>(
				`/admin/panel-variants/${variantId}/images/${encodeURIComponent(imagePath)}`,
			),
		onSuccess: (data) => {
			qc.setQueryData(panelVariantsAdminKeys.detail(data.id), data);
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

export function useReorderVariantImages() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			variantId,
			imagePaths,
		}: {
			variantId: string;
			imagePaths: string[];
		}) =>
			api.patch<ApiPanelVariant>(`/admin/panel-variants/${variantId}/reorder`, {
				image_paths: imagePaths,
			}),
		onSuccess: (data) => {
			qc.setQueryData(panelVariantsAdminKeys.detail(data.id), data);
			qc.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}

// ─── S3 Upload Types ──────────────────────────────────────────────────

export interface S3PresignedUploadResponse {
	upload_url: string;
	object_key: string;
	public_url?: string;
}

export interface S3ConfigResponse {
	endpoint: string;
	bucket: string;
	region: string;
	upload_expire_seconds: number;
}

// ─── S3 Upload Functions ─────────────────────────────────────────────

export async function getPresignedUploadUrl(
	filename: string,
	contentType: string = "image/jpeg",
	panelId?: string,
	textureId?: string,
	variantId?: string,
): Promise<S3PresignedUploadResponse> {
	return api.post<S3PresignedUploadResponse>("/admin/upload/presigned", {
		filename,
		content_type: contentType,
		panel_id: panelId,
		texture_id: textureId,
		variant_id: variantId,
	});
}

export async function getTempUploadUrl(
	filename: string,
	contentType: string = "image/jpeg",
): Promise<S3PresignedUploadResponse> {
	return api.post<S3PresignedUploadResponse>("/admin/upload/temp", {
		filename,
		content_type: contentType,
	});
}

export async function getUploadConfig(): Promise<S3ConfigResponse> {
	return api.get<S3ConfigResponse>("/admin/upload/config");
}

/**
 * Upload a file to S3 using presigned URL.
 * Returns the S3 object key for use in panel variants.
 */
export async function uploadToS3(file: File, uploadUrl: string): Promise<void> {
	const response = await fetch(uploadUrl, {
		method: "PUT",
		body: file,
		headers: {
			"Content-Type": file.type,
		},
	});

	if (!response.ok) {
		throw new Error(
			`S3 upload failed: ${response.status} ${response.statusText}`,
		);
	}
}

/**
 * Complete workflow: get presigned URL + upload file.
 * Returns the S3 object key for storing in panel variant.
 */
export async function uploadFileToS3(
	file: File,
	panelId?: string,
	textureId?: string,
	variantId?: string,
): Promise<string> {
	// 1. Get presigned URL
	const { upload_url, object_key } = await getPresignedUploadUrl(
		file.name,
		file.type,
		panelId,
		textureId,
		variantId,
	);

	// 2. Upload directly to S3
	await uploadToS3(file, upload_url);

	// 3. Return the object key for storage in the variant
	return object_key;
}

export function useUpdatePanelVariantRowActivity() {
 const client = useQueryClient();
 return useMutation({
  mutationFn: (body: { panel_id: string; texture_id: string; is_active: boolean }) =>
   api.patch<void>("/admin/panel-variant-rows/activity", body),
  onSuccess: () => {
   client.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
   client.invalidateQueries({ queryKey: ["admin", "panel-texture-assignments"] });
  },
 });
}
