import { describe, it, expect } from 'vitest';
import { apiFullConfigToFullConfig } from '../api/adapters';
import type { ApiFullConfig } from '../../../shared/api/types';
import type { FullConfig, Texture, TextureColor } from '../model/types';

const makeApiConfig = (overrides?: Partial<ApiFullConfig>): ApiFullConfig => ({
  id: 'design-1',
  name: 'Тропический лес',
  slug: 'tropical-forest',
  preview_image: '/img/preview.jpg',
  description: 'Тест описание',
  price: 1200,
  textures: [
    {
      id: 'tex-1',
      name: 'Бетон',
      slug: 'concrete',
      swatch_image: '/img/concrete.jpg',
      colors: [
        { id: 'c1', name: 'Серый', hex: '#808080', swatch_image: '' },
        { id: 'c2', name: 'Белый', hex: '#FFFFFF', swatch_image: '/img/white.jpg' },
      ],
    },
    {
      id: 'tex-2',
      name: 'Дерево',
      slug: 'wood',
      swatch_image: '/img/wood.jpg',
      colors: [
        { id: 'c3', name: 'Дуб', hex: '#8B4513', swatch_image: '' },
      ],
    },
  ],
  variant_images: [
    { design_id: 'design-1', texture_id: 'tex-1', color_id: 'c1', image_path: '/img/d1-tex1-c1.jpg' },
    { design_id: 'design-1', texture_id: 'tex-2', color_id: 'c3', image_path: '/img/d1-tex2-c3.jpg' },
  ],
  ...overrides,
});

describe('apiFullConfigToFullConfig', () => {
  it('maps basic fields correctly', () => {
    const result = apiFullConfigToFullConfig(makeApiConfig());

    expect(result.designId).toBe('design-1');
    expect(result.designName).toBe('Тропический лес');
    expect(result.previewImage).toBe('/img/preview.jpg');
    expect(result.description).toBe('Тест описание');
    expect(result.price).toBe(1200);
  });

  it('maps textures with camelCase fields', () => {
    const result = apiFullConfigToFullConfig(makeApiConfig());

    expect(result.textures).toHaveLength(2);
    expect(result.textures[0].id).toBe('tex-1');
    expect(result.textures[0].name).toBe('Бетон');
    expect(result.textures[0].slug).toBe('concrete');
    expect(result.textures[0].swatchImage).toBe('/img/concrete.jpg');
  });

  it('maps texture colors with camelCase fields', () => {
    const result = apiFullConfigToFullConfig(makeApiConfig());
    const colors = result.textures[0].colors;

    expect(colors).toHaveLength(2);
    expect(colors[0].id).toBe('c1');
    expect(colors[0].name).toBe('Серый');
    expect(colors[0].hex).toBe('#808080');
    expect(colors[0].swatchImage).toBe('');
    expect(colors[1].swatchImage).toBe('/img/white.jpg');
  });

  it('maps variant images with camelCase fields', () => {
    const result = apiFullConfigToFullConfig(makeApiConfig());

    expect(result.variantImages).toHaveLength(2);
    expect(result.variantImages[0]).toEqual({
      designId: 'design-1',
      textureId: 'tex-1',
      colorId: 'c1',
      imagePath: '/img/d1-tex1-c1.jpg',
    });
  });

  it('handles empty textures and variant images', () => {
    const result = apiFullConfigToFullConfig(makeApiConfig({
      textures: [],
      variant_images: [],
    }));

    expect(result.textures).toEqual([]);
    expect(result.variantImages).toEqual([]);
  });

  it('uses DESIGN_OVERLAY_PRICE fallback when price is 0', () => {
    const result = apiFullConfigToFullConfig(makeApiConfig({ price: 0 }));
    expect(result.price).toBe(1200);
  });
});

describe('FullConfig types', () => {
  it('Texture has correct shape', () => {
    const texture: Texture = {
      id: 'tex-1',
      name: 'Бетон',
      slug: 'concrete',
      swatchImage: '/img/concrete.jpg',
      colors: [],
    };
    expect(texture.id).toBe('tex-1');
  });

  it('TextureColor has correct shape', () => {
    const color: TextureColor = {
      id: 'c1',
      name: 'Серый',
      hex: '#808080',
      swatchImage: '',
    };
    expect(color.hex).toBe('#808080');
  });

  it('FullConfig contains all required fields', () => {
    const config: FullConfig = {
      designId: 'd1',
      designName: 'Test',
      previewImage: '/img.jpg',
      description: 'desc',
      price: 1200,
      textures: [],
      variantImages: [],
    };
    expect(config.designId).toBe('d1');
    expect(config.textures).toEqual([]);
    expect(config.variantImages).toEqual([]);
  });
});
