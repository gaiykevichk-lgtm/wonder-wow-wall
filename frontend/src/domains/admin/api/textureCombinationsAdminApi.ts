import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api";

export type SpaceCardCategory = "home" | "business" | "social";

export const SPACE_CARD_CATEGORIES: Array<{
	value: SpaceCardCategory;
	label: string;
}> = [
	{ value: "home", label: "Для дома" },
	{ value: "business", label: "Для бизнеса" },
	{ value: "social", label: "Социальные объекты" },
];

export interface ApiSpaceCardFields {
	title: string;
	project_id?: string;
	project_address?: string;
	execution_variant_id?: string;
	subtitle: string;
	price: string;
	area: string;
	category: SpaceCardCategory;
}

export interface ApiTextureCombinationImage {
	id: string;
	texture_id_1: string;
	texture_id_2: string;
	/** Семейства базовых форм (slug без суффикса размера). Пустые — без привязки к панелям. */
	panel_family_1: string;
	panel_family_2: string;
	image_path: string;
	/** Все фото карточки; первое — обложка. Со строками до миграции 037 приходит [image_path]. */
	image_paths: string[];
	created_at: string;
	card: ApiSpaceCardFields;
}

export interface TextureCombinationImageCreatePayload {
	texture_id_1: string;
	texture_id_2: string;
	/** Моно — одно семейство в обоих полях, комбо — два разных; пустые — без привязки. */
	panel_family_1?: string;
	panel_family_2?: string;
	image_path?: string;
	image_paths?: string[];
	card?: ApiSpaceCardFields;
}

export interface TextureCombinationImageUpdatePayload {
	texture_id_1: string;
	texture_id_2: string;
	panel_family_1?: string;
	panel_family_2?: string;
	image_path?: string;
	/** Полная замена галереи; отсутствие поля — заменить только обложку. */
	image_paths?: string[];
	card?: ApiSpaceCardFields;
}

const keys = {
	all: ["admin", "texture-combination-images"] as const,
};

export function useTextureCombinationImagesAdmin() {
	return useQuery({
		queryKey: keys.all,
		queryFn: () =>
			api.get<ApiTextureCombinationImage[]>(
				"/admin/texture-combination-images",
			),
		staleTime: 15_000,
	});
}

export function useCreateTextureCombinationImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: TextureCombinationImageCreatePayload) =>
			api.post<ApiTextureCombinationImage>(
				"/admin/texture-combination-images",
				body,
			),
		onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
	});
}

export function useUpdateTextureCombinationImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			body,
		}: {
			id: string;
			body: TextureCombinationImageUpdatePayload;
		}) =>
			api.patch<ApiTextureCombinationImage>(
				`/admin/texture-combination-images/${id}`,
				body,
			),
		onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
	});
}

export function useDeleteTextureCombinationImage() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			api.delete<void>(`/admin/texture-combination-images/${id}`),
		onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
	});
}
