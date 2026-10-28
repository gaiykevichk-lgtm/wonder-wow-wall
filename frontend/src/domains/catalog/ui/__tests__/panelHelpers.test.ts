import { describe, expect, it } from "vitest";
import { groupVariantsToPanels } from "../panelHelpers";
import type { ApiPublicPanel } from "../../api/catalogApi";

const makePanel = (id: string, slug: string, name: string): ApiPublicPanel => ({
	id, slug, name, width_mm: 300, height_mm: 300, size_label: "30×30 см",
	base_price: 1000, description: "", photo_path: `PANEL_PHOTO/${id}.png`,
	photo_paths: [`PANEL_PHOTO/${id}.png`], form_preview_path: "", is_active: true,
});

describe("панели для блока «Время выбирать»", () => {
	it("объединяет повторные SKU одной формы, но не теряет другие формы и их фото", () => {
		const panels = [
			makePanel("pyramid-a", "piramida", "ПИРАМИДА"),
			makePanel("pyramid-b", "piramida", "ПИРАМИДА"),
			makePanel("arch", "arka", "АРКА"),
			makePanel("rail", "reyka", "Рейка"),
			makePanel("column", "111", "КОЛОННА"),
		];
		const cards = groupVariantsToPanels([], panels);
		expect(cards).toHaveLength(4);
		expect(cards.map((card) => card.panel_name)).toEqual(["АРКА", "КОЛОННА", "ПИРАМИДА", "Рейка"]);
		expect(cards.find((card) => card.panel_name === "ПИРАМИДА")?.panel_id).toBe("pyramid-a");
		expect(cards.every((card) => card.catalog_photos.length > 0)).toBe(true);
	});
});
