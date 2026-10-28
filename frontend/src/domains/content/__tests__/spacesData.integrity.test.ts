import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
	validateSpacesData,
	availableRoomOptions,
	availableZoneOptions,
	estimateSpacePrice,
	HOME_ZONES,
	SPACES_CATEGORIES,
	SPACES_TEXTURES,
} from "../model/spacesData";

const jsonPath = path.resolve(process.cwd(), "public/content/spaces.json");
const raw = JSON.parse(readFileSync(jsonPath, "utf8"));

describe("spaces.json целостность (ТЗ 06, SPC-08/SPC-09)", () => {
	it("проходит валидацию домена", () => {
		expect(() => validateSpacesData(raw)).not.toThrow();
	});

	it("содержит интерьеры во всех трёх назначениях", () => {
		const items = validateSpacesData(raw);
		for (const category of SPACES_CATEGORIES) {
			expect(items.some((item) => item.category === category.key)).toBe(true);
		}
	});

	it("каждый фактурный вариант ссылается на ту же сцену (SPC-08)", () => {
		const items = validateSpacesData(raw);
		for (const item of items) {
			for (const texture of item.textures) {
				expect(texture.image).toBe(item.image);
			}
		}
	});

	it("зоны домашних интерьеров согласованы со справочником HOME_ZONES", () => {
		const items = validateSpacesData(raw);
		for (const item of items.filter((entry) => entry.category === "home")) {
			const zones = HOME_ZONES[item.roomType] || [];
			expect(zones.some((zone) => zone.key === item.zone)).toBe(true);
		}
	});

	it("семейства фактур вариантов входят в справочник фильтров", () => {
		const items = validateSpacesData(raw);
		const families = SPACES_TEXTURES.map((entry) => entry.key);
		for (const item of items) {
			for (const texture of item.textures) {
				expect(families).toContain(texture.family);
			}
		}
	});

	it("связанные панели каждого интерьера ведут на непустые slug", () => {
		const items = validateSpacesData(raw);
		for (const item of items) {
			expect(item.relatedPanels.length).toBeGreaterThan(0);
			for (const panel of item.relatedPanels) {
				expect(panel.slug.length).toBeGreaterThan(0);
				expect(panel.name.length).toBeGreaterThan(0);
			}
		}
	});

	it("каждый интерьер имеет допустимый режим и площадь (SPC-06)", () => {
		const items = validateSpacesData(raw);
		for (const item of items) {
			expect(["mono", "combined"]).toContain(item.mode);
			expect(item.areaM2).toBeGreaterThan(0);
		}
	});

	it("есть и моно-, и комбинированные решения (SPC-06)", () => {
		const items = validateSpacesData(raw);
		expect(items.some((i) => i.mode === "mono")).toBe(true);
		expect(items.some((i) => i.mode === "combined")).toBe(true);
	});
});

describe("validateSpacesData — отклоняет битые данные", () => {
	const base = () => JSON.parse(JSON.stringify(raw))[0];

	it("недопустимый mode", () => {
		const bad = base();
		bad.mode = "stripes";
		expect(() => validateSpacesData([bad])).toThrow(/mode/);
	});

	it("нулевая площадь", () => {
		const bad = base();
		bad.areaM2 = 0;
		expect(() => validateSpacesData([bad])).toThrow(/площади/);
	});

	it("неизвестный размер панели", () => {
		const bad = base();
		bad.panelSize = "900x900";
		expect(() => validateSpacesData([bad])).toThrow(/размер панели/);
	});

	it("комбинированный интерьер меньше чем с двумя фактурами", () => {
		const bad = base();
		bad.mode = "combined";
		bad.textures = [bad.textures[0]];
		expect(() => validateSpacesData([bad])).toThrow(/меньше двух фактур/);
	});
});

describe("estimateSpacePrice (SPC-10)", () => {
	it("считает панели по площади с округлением вверх", () => {
		const price = estimateSpacePrice(8.4, "600x600");
		expect(price).not.toBeNull();
		// 0.6×0.6 = 0.36 м² → ceil(8.4 / 0.36) = 24 панели
		expect(price!.panelsCount).toBe(24);
		// 24 × 2490 (база) + 24 × 1200 (накладка)
		expect(price!.basePrice).toBe(24 * 2490);
		expect(price!.overlayPrice).toBe(24 * 1200);
		expect(price!.total).toBe(24 * (2490 + 1200));
	});

	it("минимум одна панель для маленькой зоны", () => {
		const price = estimateSpacePrice(0.2, "600x600");
		expect(price!.panelsCount).toBe(1);
	});

	it("возвращает null для неизвестного размера", () => {
		expect(estimateSpacePrice(5, "1200x1200")).toBeNull();
	});
});

describe("чипы фильтров только под реальные данные (приёмка ТЗ 06)", () => {
	const items = validateSpacesData(raw);

	it("бизнес не предлагает «Ресторан», если под него нет ни одной сцены", () => {
		const keys = availableRoomOptions("business", items).map((o) => o.key);
		expect(keys).toContain("office");
		expect(keys).toContain("hotel");
		expect(items.some((i) => i.roomType === "restaurant")).toBe(false);
		expect(keys).not.toContain("restaurant");
	});

	it("домашние зоны не предлагают комбинаций с пустой выдачей", () => {
		for (const room of ["living", "bedroom", "kitchen", "wc"]) {
			for (const zone of availableZoneOptions("home", room, items)) {
				const hit = items.some(
					(i) =>
						i.category === "home" &&
						i.roomType === room &&
						(i.zone === zone.key || i.zone === "all_walls"),
				);
				expect(hit, `${room}/${zone.key} не даёт результатов`).toBe(true);
			}
		}
	});

	it("для бизнеса и соцобъектов зон нет (SPC-03/SPC-04, вопрос Q16)", () => {
		expect(availableZoneOptions("business", "office", items)).toEqual([]);
		expect(availableZoneOptions("social", "school", items)).toEqual([]);
	});

	it("справочник HOME_ZONES шире данных — фильтр сужает его", () => {
		expect(Object.keys(HOME_ZONES).length).toBeGreaterThan(0);
		const bedroomZones = availableZoneOptions("home", "bedroom", items).map(
			(o) => o.key,
		);
		expect(bedroomZones.length).toBeLessThanOrEqual(
			(HOME_ZONES.bedroom || []).length,
		);
	});
});
