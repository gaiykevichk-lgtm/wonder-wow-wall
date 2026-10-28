import type { ApiPanelVariant } from "../api/catalogApi";

export interface TextureGroup {
	id: string;
	name: string;
	swatchImage: string;
	variants: ApiPanelVariant[];
	images: string[];
}

/** Preserve execution identity while collecting unique thumbnails per material. */
export function getTextureGroups(
	variants: ApiPanelVariant[],
	textureSwatches: ReadonlyMap<string, string>,
): TextureGroup[] {
	const grouped = new Map<string, ApiPanelVariant[]>();
	for (const variant of variants) {
		const key = variant.texture_id || variant.texture_name || "base";
		const current = grouped.get(key) || [];
		current.push(variant);
		grouped.set(key, current);
	}

	return Array.from(grouped.entries()).map(([id, items]) => {
		const deduped = new Map<string, string>();
		for (const variant of items) {
			for (const path of variant.image_paths) {
				if (path && !deduped.has(path)) deduped.set(path, path);
			}
		}
		return {
			id,
			name: items[0]?.texture_name || "Базовая фактура",
			swatchImage: textureSwatches.get(id) || "",
			variants: items,
			images: Array.from(deduped.values()),
		};
	});
}
