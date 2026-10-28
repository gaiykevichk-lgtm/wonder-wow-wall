import { describe, it, expect } from 'vitest';
import {
	buildTextureFamilyIndex,
	interiorFamilies,
	resolveSpacePhoto,
	resolveVariantPhoto,
} from '../model/spaceTextureImages';
import type { SpaceInterior } from '../model/spacesData';

const refs = [
	{ id: 'tex-wood', name: 'Дерево' },
	{ id: 'tex-textile', name: 'Текстиль' },
	{ id: 'tex-leather', name: 'Кожа' },
	{ id: 'tex-variant', name: 'Орех американский' },
	{ id: 'tex-unknown', name: 'Неизвестная фактура' },
];
const index = buildTextureFamilyIndex(refs);

const images = [
	{ id: 'i1', textureId1: 'tex-wood', textureId2: 'tex-wood', image: '/wood.jpg' },
	{ id: 'i2', textureId1: 'tex-textile', textureId2: 'tex-textile', image: '/textile.jpg' },
	{ id: 'i3', textureId1: 'tex-leather', textureId2: 'tex-textile', image: '/leather-textile.jpg' },
	{ id: 'i4', textureId1: 'tex-unknown', textureId2: 'tex-unknown', image: '/unknown.jpg' },
];

const monoWood = { mode: 'mono', texture: 'wood', textures: [{ family: 'wood', id: 'a', image: '/own.jpg' }] } as unknown as SpaceInterior;
const monoStone = { mode: 'mono', texture: 'stone', textures: [{ family: 'stone', id: 'a', image: '/own.jpg' }] } as unknown as SpaceInterior;
const combinedLeatherTextile = { mode: 'combined', texture: 'leather', textures: [{ family: 'leather', id: 'a', image: '/own.jpg' }, { family: 'textile', id: 'b', image: '/own.jpg' }] } as unknown as SpaceInterior;
const combinedStoneLeather = { mode: 'combined', texture: 'stone', textures: [{ family: 'stone', id: 'a', image: '/own.jpg' }, { family: 'leather', id: 'b', image: '/own.jpg' }] } as unknown as SpaceInterior;

describe('buildTextureFamilyIndex', () => {
	it('переводит id текстур в семейства по названию', () => {
		expect(index.get('tex-wood')).toBe('wood');
		expect(index.get('tex-textile')).toBe('textile');
	});
	it('пропускает текстуры без семейства в «Пространствах»', () => {
		expect(index.has('tex-unknown')).toBe(false);
	});
	it('сопоставляет варианты каталога по подстроке названия', () => {
		expect(index.get('tex-variant')).toBe('wood');
	});
	it('не падает на мусорных данных', () => {
		expect(buildTextureFamilyIndex([{ id: 'x' } as never]).size).toBe(0);
	});
});

describe('interiorFamilies', () => {
	it('возвращает уникальные семейства в порядке выбора', () => {
		expect(interiorFamilies(combinedLeatherTextile)).toEqual(['leather', 'textile']);
	});
});

describe('resolveSpacePhoto', () => {
	it('моно-интерьер берёт фото своей фактуры', () => {
		expect(resolveSpacePhoto(images, index, monoWood)).toBe('/wood.jpg');
	});
	it('комбинированный интерьер берёт фото пары фактур', () => {
		expect(resolveSpacePhoto(images, index, combinedLeatherTextile)).toBe('/leather-textile.jpg');
	});
	it('без подходящего фото возвращает undefined — подмены нет', () => {
		expect(resolveSpacePhoto(images, index, monoStone)).toBeUndefined();
		expect(resolveSpacePhoto(images, index, combinedStoneLeather)).toBeUndefined();
		expect(resolveSpacePhoto([], index, monoWood)).toBeUndefined();
	});
});

describe('resolveVariantPhoto', () => {
	it('моно-режим берёт фото активной фактуры', () => {
		expect(resolveVariantPhoto(images, index, 'mono', 'textile', monoWood)).toBe('/textile.jpg');
		expect(resolveVariantPhoto(images, index, 'mono', 'stone', monoWood)).toBeUndefined();
	});
	it('комбинированный режим берёт фото пары фактур сцены', () => {
		expect(resolveVariantPhoto(images, index, 'combined', 'leather', combinedLeatherTextile)).toBe('/leather-textile.jpg');
		expect(resolveVariantPhoto(images, index, 'combined', 'stone', combinedStoneLeather)).toBeUndefined();
	});
});
