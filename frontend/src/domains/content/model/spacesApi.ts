/** Public spaces come from the server; no static fallback that could resurrect deleted cards. */
import { useCallback, useEffect, useState } from "react";
import { groupSpaceProjects } from "./spaceProjects";
import { validateSpacesData, type SpaceInterior } from "./spacesData";

let cache: SpaceInterior[] | null = null;
let inflight: Promise<SpaceInterior[]> | null = null;
export interface SpacesPageSettings {
	heading: string;
	intro: string;
}
let pageCache: SpacesPageSettings | null = null;
const API_ROOT = import.meta.env.VITE_API_URL || "/api";
export async function fetchSpacesPageSettings(): Promise<SpacesPageSettings> {
	if (pageCache) return pageCache;
	const response = await fetch(`${API_ROOT}/spaces/page`);
	if (!response.ok) throw new Error(`spaces page: HTTP ${response.status}`);
	const value = (await response.json()) as SpacesPageSettings;
	if (!value.heading || !value.intro)
		throw new Error("spaces page: неверные настройки");
	pageCache = value;
	return value;
}

export function invalidateSpacesCache() {
	cache = null;
	inflight = null;
	pageCache = null;
}

export function fetchSpacesInteriors(): Promise<SpaceInterior[]> {
	if (cache) return Promise.resolve(cache);
	if (inflight) return inflight;
	inflight = fetch(`${API_ROOT}/spaces`)
		.then((res) => {
			if (!res.ok) throw new Error(`spaces: HTTP ${res.status}`);
			return res.json();
		})
		.then((json) => {
			cache = validateSpacesData(json);
			return cache;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

export function getCachedSpacesInteriors(): SpaceInterior[] | null {
	return cache;
}

/**
 * Карточки публичной страницы «Пространства».
 * Строки вкладки «Изображения» с одинаковым projectId объединяются в одну
 * карточку объекта: все фото и исполнения вариантов показываются внутри.
 */
export interface SpaceCardItem {
	id: string;
	projectId?: string;
	projectAddress?: string;
	executionVariantId?: string;
	configurations?: SpaceCardItem[];
	mode: "mono" | "combined";
	title: string;
	subtitle: string;
	price: string;
	area: string;
	category?: "home" | "business" | "social" | "mixed";
	image: string;
	images?: string[];
	textureId1: string;
	textureId2: string;
	/** Семейства базовых форм (slug без суффикса размера). Пустые — без привязки к панелям. */
	panelFamily1?: string;
	panelFamily2?: string;
}

/** Фото стен из админской вкладки «Изображения» — источник фото страницы «Пространства». */
export interface SpaceTextureImage {
	id: string;
	textureId1: string;
	textureId2: string;
	image: string;
}

let textureImagesCache: SpaceTextureImage[] | null = null;
let textureImagesInflight: Promise<SpaceTextureImage[]> | null = null;
let spaceCardsCache: SpaceCardItem[] | null = null;
let spaceCardsInflight: Promise<SpaceCardItem[]> | null = null;

export function invalidateSpaceCards() {
	spaceCardsCache = null;
	spaceCardsInflight = null;
}

export function fetchSpaceCards(): Promise<SpaceCardItem[]> {
	if (spaceCardsCache) return Promise.resolve(spaceCardsCache);
	if (spaceCardsInflight) return spaceCardsInflight;
	spaceCardsInflight = fetch(`${API_ROOT}/spaces/cards`)
		.then((res) => {
			if (!res.ok) throw new Error(`spaces cards: HTTP ${res.status}`);
			return res.json();
		})
		.then((json) => {
			spaceCardsCache = Array.isArray(json)
				? groupSpaceProjects(
						(json as SpaceCardItem[]).filter(
							(row) =>
								typeof row?.id === "string" && typeof row?.image === "string",
						),
					)
				: [];
			return spaceCardsCache;
		})
		.finally(() => {
			spaceCardsInflight = null;
		});
	return spaceCardsInflight;
}

export function fetchSpaceTextureImages(): Promise<SpaceTextureImage[]> {
	if (textureImagesCache) return Promise.resolve(textureImagesCache);
	if (textureImagesInflight) return textureImagesInflight;
	// Без админских фото страница продолжает работать на своих картинках — 503/сеть не считаем ошибкой.
	textureImagesInflight = fetch(`${API_ROOT}/spaces/texture-images`)
		.then((res) => (res.ok ? res.json() : []))
		.then((json) => {
			textureImagesCache = Array.isArray(json)
				? (json as SpaceTextureImage[]).filter(
						(row) =>
							typeof row?.id === "string" &&
							typeof row?.textureId1 === "string" &&
							typeof row?.textureId2 === "string" &&
							typeof row?.image === "string",
					)
				: [];
			return textureImagesCache;
		})
		.catch(() => {
			textureImagesCache = [];
			return textureImagesCache;
		})
		.finally(() => {
			textureImagesInflight = null;
		});
	return textureImagesInflight;
}

/** Публичный справочник текстур (id + название) для сопоставления с фактурами сцены. */
export interface CatalogTextureRef {
	id: string;
	name: string;
}

export function fetchCatalogTextureRefs(): Promise<CatalogTextureRef[]> {
	return fetch(`${API_ROOT}/textures`)
		.then((res) => (res.ok ? res.json() : []))
		.then((json) =>
			Array.isArray(json)
				? (json as CatalogTextureRef[]).filter(
						(row) =>
							typeof row?.id === "string" && typeof row?.name === "string",
					)
				: [],
		)
		.catch(() => [] as CatalogTextureRef[]);
}

export function invalidateSpaceTextureImages() {
	textureImagesCache = null;
	textureImagesInflight = null;
	spaceCardsCache = null;
	spaceCardsInflight = null;
}
export type SpacesStatus = "loading" | "error" | "success";
export interface UseSpacesInteriorsResult {
	status: SpacesStatus;
	data: SpaceInterior[];
	page: SpacesPageSettings | null;
	retry: () => void;
}
export interface UseSpaceCardsResult {
	status: SpacesStatus;
	data: SpaceCardItem[];
	retry: () => void;
}

export function useSpaceCards(): UseSpaceCardsResult {
	const [status, setStatus] = useState<SpacesStatus>(
		spaceCardsCache ? "success" : "loading",
	);
	const [data, setData] = useState<SpaceCardItem[]>(spaceCardsCache ?? []);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let alive = true;
		fetchSpaceCards()
			.then((items) => {
				if (alive) {
					setData(items);
					setStatus("success");
				}
			})
			.catch(() => {
				if (alive) setStatus("error");
			});
		return () => {
			alive = false;
		};
	}, [attempt]);
	const retry = useCallback(() => {
		invalidateSpaceCards();
		setStatus("loading");
		setAttempt((n) => n + 1);
	}, []);
	return { status, data, retry };
}

export function useSpacesInteriors(): UseSpacesInteriorsResult {
	const [status, setStatus] = useState<SpacesStatus>(
		cache ? "success" : "loading",
	);
	const [data, setData] = useState<SpaceInterior[]>(cache ?? []);
	const [page, setPage] = useState<SpacesPageSettings | null>(pageCache);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let alive = true;
		fetchSpacesPageSettings()
			.then((value) => {
				if (alive) setPage(value);
			})
			.catch(() => {
				/* Card list handles its own load state. */
			});
		fetchSpacesInteriors()
			.then((items) => {
				if (alive) {
					setData(items);
					setStatus("success");
				}
			})
			.catch(() => {
				if (alive) setStatus("error");
			});
		return () => {
			alive = false;
		};
	}, [attempt]);
	const retry = useCallback(() => {
		invalidateSpacesCache();
		setStatus("loading");
		setAttempt((n) => n + 1);
	}, []);
	return { status, data, page, retry };
}

/** Фото из админской вкладки «Изображения» + справочник текстур для страницы «Пространства». */
export interface UseSpaceTextureImagesResult {
	textureImages: SpaceTextureImage[];
	textureRefs: CatalogTextureRef[];
}

let textureRefsCache: CatalogTextureRef[] | null = null;

export function useSpaceTextureImages(): UseSpaceTextureImagesResult {
	const [textureImages, setTextureImages] = useState<SpaceTextureImage[]>(
		textureImagesCache ?? [],
	);
	const [textureRefs, setTextureRefs] = useState<CatalogTextureRef[]>(
		textureRefsCache ?? [],
	);
	useEffect(() => {
		let alive = true;
		fetchSpaceTextureImages().then((rows) => {
			if (alive) setTextureImages(rows);
		});
		fetchCatalogTextureRefs().then((rows) => {
			textureRefsCache = rows;
			if (alive) setTextureRefs(rows);
		});
		return () => {
			alive = false;
		};
	}, []);
	return { textureImages, textureRefs };
}
