/**
 * Домен Content → контекст «Пространства» (ТЗ 06, SPC-01…SPC-09).
 *
 * Данные интерьеров живут в `GET /api/spaces` и загружаются
 * через spacesApi (состояния loading/error/success). Здесь — типы,
 * справочники фильтров и проверка целостности данных (SPC-09).
 */
import {
	BASE_PANEL_PRICES,
	DESIGN_OVERLAY_PRICE,
} from "../../../shared/config/constants";

export interface SpaceTextureVariant {
	id: string;
	name: string;
	/** Семейство фактуры для сопоставления с текстурами каталога. */
	family: "wood" | "stone" | "leather" | "metal" | "textile";
	/** SPC-08: вариант фактуры всегда показывает ту же сцену, что и интерьер. */
	image: string;
	colorHex?: string;
}

export interface SpaceRelatedPanel {
	slug: string;
	name: string;
}

/**
 * SPC-06: каталог состоит из моно-исполнений и комбинированных решений.
 * `mono` — одна фактура на всю стену; `combined` — несколько фактур
 * поясами на одной сцене.
 */
export type SpaceMode = "mono" | "combined";

export interface SpaceInterior {
	id: string;
	title: string;
	category: "home" | "business" | "social";
	categoryLabel: string;
	roomType: string;
	roomTypeLabel: string;
	zone: string;
	zoneLabel: string;
	style: string;
	styleLabel: string;
	texture: string;
	textureLabel: string;
	image: string;
	description: string;
	/** SPC-06: «родной» тип решения для этого интерьера. */
	mode: SpaceMode;
	/** Площадь отделки в м² — базовый расчёт цены (SPC-10: цены различимы). */
	areaM2: number;
	/** Ключ PANEL_SIZES из shared/config, например "600x600". */
	panelSize: string;
	defaultPanelSlug?: string;
	defaultPanelName?: string;
	/** SPC-07: быстрая смена панели (формы/исполнения) внутри интерьера. */
	relatedPanels: SpaceRelatedPanel[];
	textures: SpaceTextureVariant[];
	/** Exact scene variants and catalog finish mappings editable in admin. */
	renders?: { sceneId: string; panelSlug: string; textureId?: string; textureIds?: string[]; mode: SpaceMode; image: string }[];
	catalogBindings?: { panelSlug: string; textureId: string; groupId: string; finishImage: string }[];
}

export const SPACES_CATEGORIES = [
	{ key: "home", label: "Для дома" },
	{ key: "business", label: "Для бизнеса" },
	{ key: "social", label: "Социальные объекты" },
] as const;

export type SpaceCategoryKey = (typeof SPACES_CATEGORIES)[number]["key"];

export const HOME_ROOMS = [
	{ key: "all", label: "Все комнаты" },
	{ key: "living", label: "Гостиная" },
	{ key: "bedroom", label: "Спальня" },
	{ key: "kitchen", label: "Кухня" },
	{ key: "wc", label: "WC" },
] as const;

export const HOME_ZONES: Record<string, { key: string; label: string }[]> = {
	living: [
		{ key: "all_walls", label: "Все стены" },
		{ key: "tv_zone", label: "Зона ТВ" },
		{ key: "sofa_zone", label: "Зона дивана" },
	],
	bedroom: [
		{ key: "all_walls", label: "Все стены" },
		{ key: "headboard_zone", label: "Зона изголовья" },
		{ key: "tv_zone", label: "Зона ТВ" },
	],
	kitchen: [
		{ key: "all_walls", label: "Все стены" },
		{ key: "dining_zone", label: "Обеденная зона" },
	],
	wc: [
		{ key: "all_walls", label: "Все стены" },
		{ key: "vanity_zone", label: "Зона раковины" },
	],
};

export const BUSINESS_ROOMS = [
	{ key: "all", label: "Все типы" },
	{ key: "office", label: "Офис" },
	{ key: "hotel", label: "Отель" },
	{ key: "restaurant", label: "Ресторан" },
	{ key: "cafe", label: "Кофейня" },
	{ key: "retail", label: "Ритейл" },
] as const;

export const SOCIAL_ROOMS = [
	{ key: "all", label: "Все объекты" },
	{ key: "school", label: "Школы" },
	{ key: "kindergarten", label: "Детские сады" },
	{ key: "hospital", label: "Больницы и поликлиники" },
	{ key: "mfc", label: "Муниципальные организации (МФЦ)" },
	{ key: "transport", label: "Транспортные объекты (вокзалы, аэропорты)" },
] as const;

export const SPACES_STYLES = [
	{ key: "all", label: "Все коллекции" },
	{ key: "minimal", label: "Минимализм" },
	{ key: "modern", label: "Современный" },
	{ key: "loft", label: "Лофт" },
	{ key: "neoclassic", label: "Неоклассика" },
	{ key: "scandi", label: "Сканди" },
] as const;

export const SPACES_TEXTURES = [
	{ key: "all", label: "Все фактуры" },
	{ key: "wood", label: "Дерево" },
	{ key: "stone", label: "Природный камень" },
	{ key: "leather", label: "Кожа" },
	{ key: "metal", label: "Металл" },
	{ key: "textile", label: "Текстиль" },
] as const;

/**
 * SPC-09: устойчивый id, тип сцены, зона, связанные варианты.
 * Пустые или повторяющиеся сцены недопустимы; SPC-08 — все фактурные
 * варианты интерьера ссылаются на изображение той же сцены.
 */
export function validateSpacesData(items: unknown): SpaceInterior[] {
	if (!Array.isArray(items)) {
		throw new Error("spaces: неверный формат интерьеров");
	}
	const seenIds = new Set<string>();
	const seenScenes = new Set<string>();
	for (const raw of items) {
		const item = raw as SpaceInterior;
		if (!item?.id || seenIds.has(item.id)) {
			throw new Error(`spaces: дублирующийся или пустой id «${item?.id}»`);
		}
		seenIds.add(item.id);
		if (!item.image) {
			throw new Error(`spaces: интерьер ${item.id} без изображения сцены`);
		}
		if (seenScenes.has(`${item.roomType}:${item.image}`)) {
			throw new Error(`spaces: дублирующаяся сцена ${item.id}`);
		}
		seenScenes.add(`${item.roomType}:${item.image}`);
		if (!Array.isArray(item.textures) || item.textures.length === 0) {
			throw new Error(`spaces: интерьер ${item.id} без фактурных вариантов`);
		}
		if (item.mode !== "mono" && item.mode !== "combined") {
			throw new Error(
				`spaces: интерьер ${item.id} имеет недопустимый mode «${item.mode}»`,
			);
		}
		if (!(item.areaM2 > 0)) {
			throw new Error(`spaces: интерьер ${item.id} без корректной площади`);
		}
		if (!(item.panelSize in BASE_PANEL_PRICES)) {
			throw new Error(
				`spaces: интерьер ${item.id} ссылается на неизвестный размер панели «${item.panelSize}»`,
			);
		}
		// Комбинированное решение обязано показывать минимум две фактуры,
		// иначе переключатель режима не даёт пользователю никакого выбора.
		if (item.mode === "combined" && item.textures.length < 2) {
			throw new Error(
				`spaces: комбинированный интерьер ${item.id} содержит меньше двух фактур`,
			);
		}
		for (const tex of item.textures) {
			if (tex.image !== item.image) {
				throw new Error(
					`spaces: вариант ${tex.id} интерьера ${item.id} ссылается на чужую сцену`,
				);
			}
		}
		if (!Array.isArray(item.relatedPanels) || item.relatedPanels.length === 0) {
			throw new Error(`spaces: интерьер ${item.id} без связанных панелей`);
		}
	}
	return items as SpaceInterior[];
}

// ─── Расчёт стоимости решения (SPC-10: цены различимы) ────────────────────

export interface SpacePriceEstimate {
	/** Количество базовых панелей с округлением вверх. */
	panelsCount: number;
	/** Площадь одной панели, м². */
	panelAreaM2: number;
	/** Стоимость базовых панелей. */
	basePrice: number;
	/** Стоимость накладок (по одной на панель). */
	overlayPrice: number;
	/** Итог. */
	total: number;
}

/**
 * Оценка стоимости отделочного решения по площади и размеру панели.
 * Считается по тем же константам, что каталог и конфигуратор,
 * чтобы цифры в «Пространствах» не расходились с корзиной.
 */
export function estimateSpacePrice(
	areaM2: number,
	panelSize: string,
): SpacePriceEstimate | null {
	const unit = BASE_PANEL_PRICES[panelSize];
	if (unit === undefined) return null;
	const [w, h] = panelSize.split("x").map(Number);
	if (!w || !h) return null;
	const panelAreaM2 = (w / 1000) * (h / 1000);
	if (panelAreaM2 <= 0) return null;
	const panelsCount = Math.max(1, Math.ceil(areaM2 / panelAreaM2));
	const basePrice = panelsCount * unit;
	const overlayPrice = panelsCount * DESIGN_OVERLAY_PRICE;
	return {
		panelsCount,
		panelAreaM2,
		basePrice,
		overlayPrice,
		total: basePrice + overlayPrice,
	};
}

export function formatSpacePrice(value: number): string {
	return `${value.toLocaleString("ru-RU")} ₽`;
}

// ─── Фильтрация чипов по реальным данным ───────────────────────────────

/**
 * Приёмка ТЗ 06: «Каждая категория содержит только реально существующие
 * типы помещений». Справочники выше описывают иерархию из источника,
 * но показать можно только те типы и зоны, под которые в данных есть
 * интерьеры — иначе чип даёт заведомо пустую выдачу.
 */
export function availableRoomOptions(
	category: string,
	items: readonly SpaceInterior[],
): ChipOption[] {
	const source =
		category === "home"
			? HOME_ROOMS
			: category === "business"
				? BUSINESS_ROOMS
				: category === "social"
					? SOCIAL_ROOMS
					: [];
		const present = new Set(
			items.filter((i) => i.category === category).map((i) => i.roomType),
		);
		return source
			.filter((opt) => opt.key === "all" || present.has(opt.key))
			.map((opt) => ({ key: opt.key, label: opt.label }));
}

/** Тот же принцип для зон выбранного типа помещения. */
export function availableZoneOptions(
	category: string,
	room: string,
	items: readonly SpaceInterior[],
): ChipOption[] {
	if (!room || room === "all") return [];
	// SPC-03/SPC-04: для бизнеса и соцобъектов зоны источником не заданы
	// (открытый вопрос Q16), поэтому чипов зон там не бывает.
	if (category !== "home") return [];
	const source: { key: string; label: string }[] = HOME_ZONES[room] ?? [];
	const present = new Set(
		items
			.filter((i) => i.category === category && i.roomType === room)
			.map((i) => i.zone),
	);
	return source
		.filter((opt) => present.has(opt.key))
		.map((opt) => ({ key: opt.key, label: opt.label }));
}

export interface ChipOption {
	key: string;
	label: string;
}
