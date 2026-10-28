import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";
import { panelVariantsAdminKeys } from "./panelVariantsAdminApi";

export interface ApiPanelTextureAssignment {
	id: string;
	panel_id: string;
	texture_id: string;
	is_active: boolean;
	is_catalog_row: boolean;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export const panelTextureAssignmentKeys = {
	all: ["admin", "panel-texture-assignments"] as const,
	byPanel: (panelId?: string) =>
		["admin", "panel-texture-assignments", panelId ?? "all"] as const,
};

export function usePanelTextureAssignments(panelId?: string) {
	return useQuery({
		queryKey: panelTextureAssignmentKeys.byPanel(panelId),
		queryFn: () => {
			const query = panelId ? `?panel_id=${encodeURIComponent(panelId)}` : "";
			return api.get<ApiPanelTextureAssignment[]>(
				`/admin/panel-texture-assignments${query}`,
			);
		},
		staleTime: 15_000,
	});
}

export function useReplacePanelTextureAssignments() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			panelId,
			textureIds,
			expectedTextureIds,
		}: {
			panelId: string;
			textureIds: string[];
			expectedTextureIds?: string[];
		}) =>
			api.put<ApiPanelTextureAssignment[]>(
				`/admin/panels/${panelId}/texture-assignments`,
				{ texture_ids: textureIds, expected_texture_ids: expectedTextureIds },
			),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: panelTextureAssignmentKeys.all,
			});
			queryClient.invalidateQueries({
				queryKey: panelTextureAssignmentKeys.byPanel(variables.panelId),
			});
			queryClient.invalidateQueries({ queryKey: panelVariantsAdminKeys.lists });
		},
	});
}
