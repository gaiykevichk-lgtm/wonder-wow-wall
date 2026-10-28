/**
 * Хелперы для группировки вариантов панелей.
 * Логика вынесена сюда (а не в CatalogPage.tsx), чтобы ESLint не блокировал
 * Fast Refresh при экспорте не-компонентных функций.
 */

import type { ApiPanelVariant, ApiPublicPanel } from "../api/catalogApi";

/** Уникальная текстура внутри одной панели. */
export interface TextureSwatch {
	texture_id: string;
	texture_name: string;
	preview_path: string; // первый image_path группы
	variant_count: number; // сколько вариантов (цветов) у этой текстуры
}

/** Одна карточка-панель в каталоге: группа вариантов по panel_id. */
export interface PanelCardData {
	panel_id: string;
	panel_name: string;
	panel_size: string;
	textures: TextureSwatch[];
	/**
	 * Базовый силуэт формы (белый PNG) из админки — показывается
	 * ПЕРВЫМ в карточке как превью формы панели.
	 */
	form_preview: string;
	/**
	 * Собственные фото панели (до 2), загруженные на шаге 1 визарда.
	 * Приоритетнее превью текстуры: админ выбрал их именно для каталога.
	 * Пусто — если фото не загружены, тогда UI падает на текстуры.
	 */
	catalog_photos: string[];
	/**
	 * Цена базовой формы из админки (`Panel.base_price`).
	 */
	base_price: number;
	/**
	 * Описание базовой формы из админки (`Panel.description`).
	 */
	description: string;
}

/**
 * Строит карточки исключительно из публичных базовых форм (`/panels`).
 * Варианты дополняют форму только связями доступных фактур и никогда не
 * подменяют админские название, размер, описание, цену или изображения.
 */
export function groupVariantsToPanels(
	variants: ApiPanelVariant[],
	panels: ApiPublicPanel[] = [],
): PanelCardData[] {
	const variantsByPanel = new Map<string, ApiPanelVariant[]>();
	for (const variant of variants) {
		const related = variantsByPanel.get(variant.panel_id);
		if (related) related.push(variant);
		else variantsByPanel.set(variant.panel_id, [variant]);
	}

	const panelFamilies = new Map<string, ApiPublicPanel[]>();
	for (const panel of panels) {
		const familyKey = `${panel.slug.replace(/-(?:300x300|300x600|600x600)$/, "")}:${panel.width_mm}x${panel.height_mm}`;
		const family = panelFamilies.get(familyKey);
		if (family) family.push(panel);
		else panelFamilies.set(familyKey, [panel]);
	}

	return Array.from(panelFamilies.values())
		.map((family): PanelCardData => {
			const panel = family[0];
			const textures = new Map<string, TextureSwatch>();
			for (const variant of family.flatMap((item) => variantsByPanel.get(item.id) ?? [])) {
				const existing = textures.get(variant.texture_id);
				if (existing) {
					existing.variant_count += 1;
					continue;
				}
				const previewPath = variant.image_paths[0];
				if (!previewPath) continue;
				textures.set(variant.texture_id, {
					texture_id: variant.texture_id,
					texture_name: variant.texture_name,
					preview_path: previewPath,
					variant_count: 1,
				});
			}

			return {
				panel_id: panel.id,
				panel_name: panel.name,
				panel_size: panel.size_label,
				textures: Array.from(textures.values()).sort((a, b) =>
					a.texture_name.localeCompare(b.texture_name),
				),
				form_preview: panel.form_preview_path ?? "",
				catalog_photos: panel.photo_paths ?? [],
				base_price: panel.base_price,
				description: panel.description ?? "",
			};
		})
		.sort((a, b) => a.panel_name.localeCompare(b.panel_name));
}
