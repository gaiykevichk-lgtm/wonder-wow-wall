import type { SpaceCardItem } from "./spacesApi";

export function groupSpaceProjects(rows: SpaceCardItem[]): SpaceCardItem[] {
	const projects = new Map<string, SpaceCardItem>();
	for (const row of rows) {
		// Название идентифицирует объект; категория является фильтром,
		// а не основанием создавать повторную карточку.
		const key = normalizeProjectTitle(row.title) || row.projectId || row.id;
		const photos = [row.image, ...(row.images || [])].filter(Boolean);
		const existing = projects.get(key);
		if (!existing) {
			projects.set(key, {
				...row,
				images: [...new Set(photos)],
				configurations: [row],
			});
		} else {
			existing.images = [...new Set([...(existing.images || []), ...photos])];
			if (!existing.configurations!.some((item) => item.id === row.id)) {
				existing.configurations!.push(row);
			}
			if (existing.category !== row.category) existing.category = "mixed";
			existing.subtitle ||= row.subtitle;
			existing.area ||= row.area;
			existing.price ||= row.price;
		}
	}
	return [...projects.values()];
}

function normalizeProjectTitle(title: string): string {
	return title
		.normalize("NFKC")
		.trim()
		.toLocaleLowerCase("ru-RU")
		.replace(/[ё]/g, "е")
		.replace(/\s+/g, " ");
}
