/**
 * Phase 7B — admin panels (SKU) bindings.
 *
 * Mirrors the cache-key + mutation pattern established by usersAdminApi
 * (Phase 5): `lists` / `detail(id)` are kept under separate prefixes so
 * a list invalidation never evicts the detail cache (Phase 4B audit fix).
 *
 * Backend:
 *   * `GET    /api/admin/panels`           — paginated, includes inactive
 *   * `GET    /api/admin/panels/{id}`      — single
 *   * `POST   /api/admin/panels`           — create (201)
 *   * `PATCH  /api/admin/panels/{id}`      — partial update (None = "don't touch")
 *   * `DELETE /api/admin/panels/{id}`      — hard delete (204)
 *
 * Error envelope `{detail, code}`:
 *   * 404 + `panel_not_found`
 *   * 409 + `panel_slug_conflict`
 *   * 409 + `panel_size_conflict` — same form name + dimensions
 */

import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { api, shouldRetryQuery } from "../../../shared/api";
import { catalogKeys } from "../../catalog/api/catalogApi";

// ─── Wire types — mirror backend Pydantic responses 1:1 ─────────────────

export interface ApiPanel {
	id: string;
	name: string;
	slug: string;
	width_mm: number;
	height_mm: number;
	size_label: string;
	base_price: number;
	description: string;
	thickness_mm?: number;
	execution?: string;
	mounting_system?: string;
	base_material?: string;
	packaging?: string;
	photo_path: string;
	/** Ordered catalog gallery (up to 2). First item always === photo_path. */
	photo_paths: string[];
	is_active: boolean;
	created_at: string;
}

export interface ApiPanelListResponse {
	items: ApiPanel[];
	total: number;
	offset: number;
	limit: number;
}

// `null` on optional fields means "don't touch" (PATCH semantics on the
// backend — `Field(default=None)`). To CLEAR an optional string the
// caller passes `""` explicitly. Same shape as backend `PanelUpdate`.
export interface PanelUpdatePayload {
	name?: string;
	slug?: string;
	width_mm?: number;
	height_mm?: number;
	size_label?: string;
	base_price?: number;
	description?: string;
	thickness_mm?: number;
	execution?: string;
	mounting_system?: string;
	base_material?: string;
	packaging?: string;
	photo_path?: string;
	/** `[]` clears the gallery (and the primary photo with it). */
	photo_paths?: string[];
	is_active?: boolean;
}

export interface PanelSizesCreatePayload {
	name: string;
	slug: string;
	sizes: Array<"300x300" | "300x600" | "600x600">;
	description?: string;
	thickness_mm?: number;
	execution?: string;
	mounting_system?: string;
	base_material?: string;
	packaging?: string;
	photo_path?: string;
	photo_paths?: string[];
	is_active?: boolean;
}

export interface PanelCreatePayload {
	name: string;
	slug: string;
	width_mm: number;
	height_mm: number;
	size_label?: string;
	base_price: number;
	description?: string;
	thickness_mm?: number;
	execution?: string;
	mounting_system?: string;
	base_material?: string;
	packaging?: string;
	photo_path?: string;
	photo_paths?: string[];
	is_active?: boolean;
}

// ─── Filter contract used by store + URL sync ───────────────────────────

export interface PanelsAdminFilters {
	/** null = "all", true = "active only", false = "inactive only" */
	isActive: boolean | null;
	/** Free-text on name/slug — applied client-side (backend has no filter yet). */
	search: string | null;
}

export interface PanelsAdminQuery extends PanelsAdminFilters {
	page: number;
	size: number;
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const panelsAdminKeys = {
	// Narrower than `['admin','panels']` so a `lists` invalidation never
	// evicts `detail(id)` (Phase 4B prefix-overlap fix).
	lists: ["admin", "panels", "list"] as const,
	list: (q: PanelsAdminQuery) => ["admin", "panels", "list", q] as const,
	detail: (panelId: string) => ["admin", "panels", "detail", panelId] as const,
};

function buildListQueryString(q: PanelsAdminQuery): string {
	// Phase 7B remediation 2 (FE-B) — filters now travel to the backend
	// (`is_active`, `search`) so paginated `total` reflects the visible
	// set and we don't burn bandwidth re-fetching the same page for each
	// filter combination. The query DTO still drives the React Query
	// cache key, so the cache layer behaves identically (one entry per
	// unique filter combo) while the wire payload is smaller.
	const params = new URLSearchParams();
	const offset = (q.page - 1) * q.size;
	params.set("offset", String(offset));
	params.set("limit", String(q.size));
	if (q.isActive !== null) params.set("is_active", String(q.isActive));
	if (q.search) params.set("search", q.search);
	return params.toString();
}

// ─── Hooks ──────────────────────────────────────────────────────────────

export function usePanelsAdminList(
	q: PanelsAdminQuery,
	options?: { enabled?: boolean; allPages?: boolean },
) {
	return useQuery({
		queryKey: options?.allPages
			? [...panelsAdminKeys.lists, "all", q.isActive, q.search]
			: panelsAdminKeys.list(q),
		enabled: options?.enabled ?? true,
		queryFn: async () => {
			if (!options?.allPages)
				return api.get<ApiPanelListResponse>(
					`/admin/panels?${buildListQueryString(q)}`,
				);
			const items: ApiPanel[] = [];
			let total = 0;
			while (true) {
				const params = new URLSearchParams({
					offset: String(items.length),
					limit: "500",
				});
				if (q.isActive !== null) params.set("is_active", String(q.isActive));
				if (q.search) params.set("search", q.search);
				const batch = await api.get<ApiPanelListResponse>(
					`/admin/panels?${params}`,
				);
				items.push(...batch.items);
				total = batch.total;
				if (!batch.items.length || items.length >= total) break;
			}
			return { items, total, offset: 0, limit: items.length };
		},
		placeholderData: keepPreviousData,
		staleTime: 15_000,
		// Reads must survive one transient transport failure: a single empty
		// 2xx body used to leave the panel select permanently empty over the
		// whole admin catalog page (dropdown showed "No data").
		retry: shouldRetryQuery,
	});
}

export function usePanelDetail(panelId: string | undefined) {
	return useQuery({
		queryKey: panelId
			? panelsAdminKeys.detail(panelId)
			: ["admin", "panels", "detail", "noop"],
		queryFn: () => api.get<ApiPanel>(`/admin/panels/${panelId}`),
		enabled: !!panelId,
		staleTime: 15_000,
		retry: shouldRetryQuery,
	});
}

// ─── Mutations ──────────────────────────────────────────────────────────

export function useCreatePanel() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: PanelCreatePayload) =>
			api.post<ApiPanel>("/admin/panels", body),
		onSuccess: (data) => {
			// Prime the detail cache so an immediate "edit" navigation skips a
			// round-trip; invalidate both admin and public projections so the
			// catalog reflects the saved base form immediately.
			qc.setQueryData(panelsAdminKeys.detail(data.id), data);
			qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
			qc.invalidateQueries({ queryKey: catalogKeys.panels() });
		},
	});
}

export function useCreatePanelSizes() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: PanelSizesCreatePayload) =>
			api.post<ApiPanel[]>("/admin/panels/sizes", body),
		onSuccess: (panels) => {
			panels.forEach((panel) =>
				qc.setQueryData(panelsAdminKeys.detail(panel.id), panel),
			);
			qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
			qc.invalidateQueries({ queryKey: catalogKeys.panels() });
		},
	});
}

export function useUpdatePanel() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			panelId,
			body,
		}: {
			panelId: string;
			body: PanelUpdatePayload;
		}) => api.patch<ApiPanel>(`/admin/panels/${panelId}`, body),
		onSuccess: (data) => {
			qc.setQueryData(panelsAdminKeys.detail(data.id), data);
			qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
			qc.invalidateQueries({ queryKey: catalogKeys.panels() });
		},
	});
}

export function useDuplicatePanel() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (panelId: string) =>
			api.post<ApiPanel>(
				`/admin/panels/${encodeURIComponent(panelId)}/duplicate`,
			),
		onSuccess: () => qc.invalidateQueries({ queryKey: panelsAdminKeys.lists }),
	});
}

export function useDeletePanel() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (panelId: string) =>
			api.delete<void>(`/admin/panels/${panelId}`),
		onSuccess: (_data, panelId) => {
			qc.removeQueries({ queryKey: panelsAdminKeys.detail(panelId) });
			qc.invalidateQueries({ queryKey: panelsAdminKeys.lists });
			qc.invalidateQueries({ queryKey: catalogKeys.panels() });
		},
	});
}
