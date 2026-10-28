import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";

export interface PanelAvailabilityStatus {
	id: string;
	name: string;
	color: string;
}
const key = ["admin", "panel-availability-statuses"] as const;
export function usePanelAvailabilityStatuses() {
	return useQuery({
		queryKey: key,
		queryFn: () =>
			api.get<PanelAvailabilityStatus[]>("/admin/panel-availability-statuses"),
	});
}
export function useSavePanelAvailabilityStatus() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id?: string;
			name: string;
			color: string;
		}) =>
			id
				? api.patch(`/admin/panel-availability-statuses/${id}`, body)
				: api.post("/admin/panel-availability-statuses", body),
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
}
export function useDeletePanelAvailabilityStatus() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			api.delete(`/admin/panel-availability-statuses/${id}`),
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
}
