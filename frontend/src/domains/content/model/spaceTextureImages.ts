/**
 * Фото страницы «Пространства» берутся из админской вкладки «Изображения»
 * (`/api/spaces/texture-images`): каждая запись — фото стены для одной
 * текстуры (моно: `textureId1 === textureId2`) или для пары текстур.
 *
 * Сопоставление идёт по семействам фактур (`wood`, `stone`, …), потому что
 * интерьеры описывают фактуру семейством, а админские фото — конкретным
 * `textureId`. Если подходящего фото нет, страница показывает собственное
 * изображение интерьера — без выдуманных подстановок.
 */
import type { CatalogTextureRef, SpaceTextureImage } from './spacesApi';
import { SPACES_TEXTURES, type SpaceInterior } from './spacesData';

/** textureId → семейство фактуры: точное имя справочника, затем подстрока имени текстуры каталога. */
const CATALOG_NAME_TO_FAMILY: Array<[string, string]> = [
	['дерев', 'wood'],
	['орех', 'wood'],
	['берез', 'wood'],
	['дуб', 'wood'],
	['ясен', 'wood'],
	['тик', 'wood'],
	['эбен', 'wood'],
	['рейк', 'wood'],
	['камен', 'stone'],
	['мрамор', 'stone'],
	['травертин', 'stone'],
	['микроцемент', 'stone'],
	['базальт', 'stone'],
	['гранит', 'stone'],
	['оникс', 'stone'],
	['кож', 'leather'],
	['металл', 'metal'],
	['титан', 'metal'],
	['латунь', 'metal'],
	['алюмин', 'metal'],
	['текстиль', 'textile'],
	['войлок', 'textile'],
];

export function familyFromCatalogName(name: string): string | undefined {
	const normalized = (name || '').toLowerCase();
	for (const [fragment, family] of CATALOG_NAME_TO_FAMILY) {
		if (fragment && normalized.includes(fragment)) return family;
	}
	return undefined;
}

export function buildTextureFamilyIndex(
	textureRefs: CatalogTextureRef[],
): Map<string, string> {
	const index = new Map<string, string>();
	for (const texture of textureRefs) {
		if (typeof texture?.name !== 'string' || typeof texture?.id !== 'string') continue;
		const exact = SPACES_TEXTURES.find(
			(space) => space.label.toLowerCase() === texture.name.toLowerCase(),
		)?.key;
		const key = exact && exact !== 'all' ? exact : familyFromCatalogName(texture.name);
		if (key) index.set(texture.id, key);
	}
	return index;
}

/** Уникальные семейства фактур интерьера в порядке выбора. */
export function interiorFamilies(interior: SpaceInterior): string[] {
	const families = interior.textures
		.map((texture) => texture.family)
		.filter((family): family is string => !!family);
	return [...new Set(families)];
}

const isMono = (image: SpaceTextureImage) => image.textureId1 === image.textureId2;

function familiesOf(
	image: SpaceTextureImage,
	index: Map<string, string>,
): string[] {
	const first = index.get(image.textureId1);
	const second = index.get(image.textureId2);
	return [first, second].filter((family): family is string => !!family);
}

/** Фото для карточки интерьера: моно — одна фактура, комбинация — пара фактур сцены. */
export function resolveSpacePhoto(
	images: SpaceTextureImage[],
	index: Map<string, string>,
	interior: SpaceInterior,
): string | undefined {
	if (!images.length) return undefined;
	if (interior.mode === 'mono') {
		return images.find(
			(image) => isMono(image) && index.get(image.textureId1) === interior.texture,
		)?.image;
	}
	const wanted = new Set(interiorFamilies(interior));
	const pair = images.find((image) => {
		if (isMono(image)) return false;
		const families = familiesOf(image, index);
		return (
			families.length === 2 &&
			families[0] !== families[1] &&
			families.every((family) => wanted.has(family))
		);
	});
	return pair?.image;
}

/**
 * Фото для выбранного варианта в модалке «Переодеть фактуры»:
 * моно — активная фактура, комбинация — пара фактур из сцены интерьера.
 */
export function resolveVariantPhoto(
	images: SpaceTextureImage[],
	index: Map<string, string>,
	mode: 'mono' | 'combined',
	activeFamily: string | undefined,
	interior: SpaceInterior,
): string | undefined {
	if (!images.length) return undefined;
	if (mode === 'mono') {
		if (!activeFamily) return undefined;
		return images.find(
			(image) => isMono(image) && index.get(image.textureId1) === activeFamily,
		)?.image;
	}
	const wanted = new Set(
		[activeFamily, ...interiorFamilies(interior)].filter(
			(family): family is string => !!family,
		),
	);
	return images.find((image) => {
		if (isMono(image)) return false;
		const families = familiesOf(image, index);
		return (
			families.length === 2 &&
			families[0] !== families[1] &&
			families.every((family) => wanted.has(family))
		);
	})?.image;
}
