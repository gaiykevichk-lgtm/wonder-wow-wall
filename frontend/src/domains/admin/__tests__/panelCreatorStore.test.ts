/**
 * Phase Panel Creator Wizard — unit tests for panelCreatorStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { usePanelCreatorStore } from '../model/panelCreatorStore';
import type { ApiAdminDesign, ApiTexture, ApiTextureColor } from '../api/texturesAdminApi';

// Mock data
const mockDesign: ApiAdminDesign = {
  id: 'design-1',
  name: 'Wave Pattern',
  slug: 'wave-pattern',
  category_id: 'cat-1',
  style: 'abstract',
  image: '/images/wave.jpg',
  preview_image: '/images/wave-preview.jpg',
  description: 'Beautiful wave pattern',
  price: 1200,
  colors: [],
  rating: 4.5,
  reviews_count: 12,
  is_new: true,
  is_popular: false,
  is_published: true,
  created_at: '2024-01-01T00:00:00Z',
};

const mockTextures: ApiTexture[] = [
  {
    id: 'tex-1',
    name: 'Concrete',
    slug: 'concrete',
    swatch_image: '/images/concrete.jpg',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'tex-2',
    name: 'Wood',
    slug: 'wood',
    swatch_image: '/images/wood.jpg',
    sort_order: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

const mockColors: ApiTextureColor[] = [
  {
    id: 'color-1',
    texture_id: 'tex-1',
    name: 'Gray',
    hex: '#808080',
    swatch_image: '',
    sort_order: 1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'color-2',
    texture_id: 'tex-1',
    name: 'White',
    hex: '#FFFFFF',
    swatch_image: '',
    sort_order: 2,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

// Helper to create texture colors map
function createTextureColorsMap(textureId: string, colors: ApiTextureColor[]): Map<string, ApiTextureColor[]> {
  const map = new Map<string, ApiTextureColor[]>();
  map.set(textureId, colors);
  return map;
}

function createTextureNamesMap(textures: ApiTexture[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of textures) {
    map.set(t.id, t.name);
  }
  return map;
}

describe('PanelCreatorStore', () => {
  beforeEach(() => {
    // Reset store before each test
    usePanelCreatorStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts at step 1', () => {
      const state = usePanelCreatorStore.getState();
      expect(state.currentStep).toBe(1);
    });

    it('has no selected design', () => {
      const state = usePanelCreatorStore.getState();
      expect(state.selectedDesign).toBeNull();
    });

    it('has no selected textures', () => {
      const state = usePanelCreatorStore.getState();
      expect(state.selectedTextureIds.size).toBe(0);
    });

    it('has all sizes selected by default', () => {
      const state = usePanelCreatorStore.getState();
      expect(state.selectedSizes.size).toBe(3);
      expect(state.selectedSizes.has('30x30')).toBe(true);
      expect(state.selectedSizes.has('30x60')).toBe(true);
      expect(state.selectedSizes.has('60x60')).toBe(true);
    });

    it('has no variants initially', () => {
      const state = usePanelCreatorStore.getState();
      expect(state.variants).toEqual([]);
    });
  });

  describe('navigation', () => {
    it('goNext increments step', () => {
      const store = usePanelCreatorStore.getState();
      store.goNext();
      expect(usePanelCreatorStore.getState().currentStep).toBe(2);
    });

    it('goBack decrements step', () => {
      const store = usePanelCreatorStore.getState();
      store.goNext(); // 1 -> 2
      store.goBack(); // 2 -> 1
      expect(usePanelCreatorStore.getState().currentStep).toBe(1);
    });

    it('goBack does nothing at step 1', () => {
      const store = usePanelCreatorStore.getState();
      store.goBack();
      expect(usePanelCreatorStore.getState().currentStep).toBe(1);
    });

    it('goNext does nothing at step 4', () => {
      const store = usePanelCreatorStore.getState();
      store.goNext(); // 1 -> 2
      store.goNext(); // 2 -> 3
      store.goNext(); // 3 -> 4
      store.goNext(); // 4 -> stays 4
      expect(usePanelCreatorStore.getState().currentStep).toBe(4);
    });

    it('setStep sets specific step', () => {
      const store = usePanelCreatorStore.getState();
      store.setStep(3);
      expect(usePanelCreatorStore.getState().currentStep).toBe(3);
    });
  });

  describe('design selection (step 1)', () => {
    it('setDesign stores selected design', () => {
      const store = usePanelCreatorStore.getState();
      store.setDesign(mockDesign);
      expect(usePanelCreatorStore.getState().selectedDesign).toEqual(mockDesign);
    });

    it('setDesign replaces previous design', () => {
      const store = usePanelCreatorStore.getState();
      store.setDesign(mockDesign);
      const anotherDesign = { ...mockDesign, id: 'design-2', name: 'Another' };
      store.setDesign(anotherDesign);
      expect(usePanelCreatorStore.getState().selectedDesign?.id).toBe('design-2');
    });
  });

  describe('texture selection (step 2)', () => {
    it('toggleTexture adds texture', () => {
      const store = usePanelCreatorStore.getState();
      store.toggleTexture('tex-1');
      expect(usePanelCreatorStore.getState().selectedTextureIds.has('tex-1')).toBe(true);
    });

    it('toggleTexture removes texture if already selected', () => {
      const store = usePanelCreatorStore.getState();
      store.toggleTexture('tex-1');
      store.toggleTexture('tex-1');
      expect(usePanelCreatorStore.getState().selectedTextureIds.has('tex-1')).toBe(false);
    });

    it('selectAllTextures selects all', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1', 'tex-2', 'tex-3']);
      const selected = usePanelCreatorStore.getState().selectedTextureIds;
      expect(selected.size).toBe(3);
      expect(selected.has('tex-1')).toBe(true);
      expect(selected.has('tex-2')).toBe(true);
      expect(selected.has('tex-3')).toBe(true);
    });

    it('deselectAllTextures clears selection', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1', 'tex-2']);
      store.deselectAllTextures();
      expect(usePanelCreatorStore.getState().selectedTextureIds.size).toBe(0);
    });

    it('setTextures replaces selection', () => {
      const store = usePanelCreatorStore.getState();
      store.toggleTexture('tex-1');
      store.setTextures(['tex-2']);
      expect(usePanelCreatorStore.getState().selectedTextureIds.size).toBe(1);
      expect(usePanelCreatorStore.getState().selectedTextureIds.has('tex-1')).toBe(false);
      expect(usePanelCreatorStore.getState().selectedTextureIds.has('tex-2')).toBe(true);
    });
  });

  describe('size selection (step 3)', () => {
    it('toggleSize removes size if already selected', () => {
      const store = usePanelCreatorStore.getState();
      // 30x30 is selected by default
      store.toggleSize('30x30');
      expect(usePanelCreatorStore.getState().selectedSizes.has('30x30')).toBe(false);
    });

    it('toggleSize adds size if not selected', () => {
      const store = usePanelCreatorStore.getState();
      store.toggleSize('30x30'); // Remove
      store.toggleSize('30x30'); // Add back
      expect(usePanelCreatorStore.getState().selectedSizes.has('30x30')).toBe(true);
    });

    it('selectAllSizes selects all 3 sizes', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllSizes();
      const sizes = usePanelCreatorStore.getState().selectedSizes;
      expect(sizes.size).toBe(3);
      expect(sizes.has('30x30')).toBe(true);
      expect(sizes.has('30x60')).toBe(true);
      expect(sizes.has('60x60')).toBe(true);
    });

    it('deselectAllSizes clears selection', () => {
      const store = usePanelCreatorStore.getState();
      store.deselectAllSizes();
      expect(usePanelCreatorStore.getState().selectedSizes.size).toBe(0);
    });
  });

  describe('variants (step 4)', () => {
    it('buildVariants creates correct number of variants', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      // Select only 30x30 size for simpler test
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', mockColors);
      const namesMap = createTextureNamesMap(mockTextures);

      store.buildVariants(colorsMap, namesMap);

      // 1 texture x 2 colors x 1 size = 2 variants
      expect(usePanelCreatorStore.getState().variants.length).toBe(2);
    });

    it('buildVariants creates variants with correct keys', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', [mockColors[0]]);
      const namesMap = createTextureNamesMap(mockTextures);

      store.buildVariants(colorsMap, namesMap);

      const variant = usePanelCreatorStore.getState().variants[0];
      expect(variant.key).toBe('tex-1:color-1:30x30');
      expect(variant.textureId).toBe('tex-1');
      expect(variant.colorId).toBe('color-1');
      expect(variant.sizeKey).toBe('30x30');
      expect(variant.hex).toBe('#808080'); // From mockColors[0]
    });

    it('buildVariants uses texture color hex when not overridden', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', [mockColors[0]]);
      const namesMap = createTextureNamesMap(mockTextures);

      store.buildVariants(colorsMap, namesMap);

      const variant = usePanelCreatorStore.getState().variants[0];
      expect(variant.hex).toBe('#808080'); // From mockColors[0].hex
    });

    it('setVariantImage updates variant image path', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', [mockColors[0]]);
      const namesMap = createTextureNamesMap(mockTextures);
      store.buildVariants(colorsMap, namesMap);

      const variantKey = usePanelCreatorStore.getState().variants[0].key;
      store.setVariantImage(variantKey, '/images/new-photo.jpg');

      expect(usePanelCreatorStore.getState().variants[0].imagePath).toBe('/images/new-photo.jpg');
    });

    it('setVariantHex updates variant hex', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', [mockColors[0]]);
      const namesMap = createTextureNamesMap(mockTextures);
      store.buildVariants(colorsMap, namesMap);

      const variantKey = usePanelCreatorStore.getState().variants[0].key;
      store.setVariantHex(variantKey, '#FF5500');

      expect(usePanelCreatorStore.getState().variants[0].hex).toBe('#FF5500');
    });

    it('setVariantsImage updates multiple variants', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', mockColors); // 2 colors
      const namesMap = createTextureNamesMap(mockTextures);
      store.buildVariants(colorsMap, namesMap);

      const keys = usePanelCreatorStore.getState().variants.map(v => v.key);
      store.setVariantsImage(keys, '/images/batch-photo.jpg');

      const variants = usePanelCreatorStore.getState().variants;
      expect(variants.every(v => v.imagePath === '/images/batch-photo.jpg')).toBe(true);
    });

    it('clearVariantImage removes variant image', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      store.deselectAllSizes();
      store.toggleSize('30x30');

      const colorsMap = createTextureColorsMap('tex-1', [mockColors[0]]);
      const namesMap = createTextureNamesMap(mockTextures);
      store.buildVariants(colorsMap, namesMap);

      const variantKey = usePanelCreatorStore.getState().variants[0].key;
      store.setVariantImage(variantKey, '/images/photo.jpg');
      store.clearVariantImage(variantKey);

      expect(usePanelCreatorStore.getState().variants[0].imagePath).toBeNull();
    });
  });

  describe('reset', () => {
    it('reset restores initial state', () => {
      const store = usePanelCreatorStore.getState();

      // Make changes
      store.setDesign(mockDesign);
      store.toggleTexture('tex-1');
      store.toggleSize('30x30');
      store.setStep(4);

      // Reset
      store.reset();

      // Verify reset
      expect(usePanelCreatorStore.getState().currentStep).toBe(1);
      expect(usePanelCreatorStore.getState().selectedDesign).toBeNull();
      expect(usePanelCreatorStore.getState().selectedTextureIds.size).toBe(0);
      expect(usePanelCreatorStore.getState().variants).toEqual([]);
    });
  });

  describe('multi-size variant generation', () => {
    it('generates separate variants for each size', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1']);
      // Keep all sizes selected (default)

      const colorsMap = createTextureColorsMap('tex-1', [mockColors[0]]); // 1 color
      const namesMap = createTextureNamesMap(mockTextures);

      store.buildVariants(colorsMap, namesMap);

      // 1 texture x 1 color x 3 sizes = 3 variants
      const variants = usePanelCreatorStore.getState().variants;
      expect(variants.length).toBe(3);

      const sizeKeys = variants.map(v => v.sizeKey).sort();
      expect(sizeKeys).toEqual(['30x30', '30x60', '60x60']);
    });

    it('generates correct total for multiple textures and colors', () => {
      const store = usePanelCreatorStore.getState();
      store.selectAllTextures(['tex-1', 'tex-2']);
      store.deselectAllSizes();
      store.toggleSize('30x30');
      store.toggleSize('60x60'); // 2 sizes

      const colorsMap = new Map<string, ApiTextureColor[]>();
      colorsMap.set('tex-1', [mockColors[0], mockColors[1]]); // 2 colors
      colorsMap.set('tex-2', [mockColors[0]]); // 1 color

      const namesMap = createTextureNamesMap(mockTextures);
      store.buildVariants(colorsMap, namesMap);

      // 2 textures x 3 colors total (2+1) x 2 sizes = 6 variants
      expect(usePanelCreatorStore.getState().variants.length).toBe(6);
    });
  });
});
