// Maps API responses to existing frontend types
import type { PanelProduct, Category, Review, FullConfig } from '../model/types';
import type { ApiDesign, ApiCategory, ApiReview, ApiFullConfig } from '../../../shared/api/types';
import { DESIGN_OVERLAY_PRICE, PANEL_SIZES } from '../../../shared/config/constants';

export function apiDesignToProduct(d: ApiDesign): PanelProduct {
  return {
    id: d.id,
    name: d.name,
    category: d.category_id,
    categoryLabel: d.style,
    style: d.style,
    material: `Дизайн-накладка`,
    price: d.price || DESIGN_OVERLAY_PRICE,
    priceUnit: '/шт',
    image: d.image,
    previewImage: d.preview_image || '',
    gallery: [d.image],
    description: d.description,
    specs: {
      'Толщина накладки': '3 мм',
      'Материал': 'Полимер с УФ-печатью',
      'Класс': d.is_popular ? 'Премиум' : d.is_new ? 'Стандарт' : 'Базовый',
      'Уход': 'Влажная уборка',
      'Монтаж': 'Магнитное крепление',
    },
    colors: d.colors.map((c) => ({ hex: c.hex, name: c.name })),
    sizes: PANEL_SIZES.map((s) => ({
      width: s.width,
      height: s.height,
      label: s.label,
    })),
    rating: d.rating,
    reviews: d.reviews_count,
    badge: d.is_new ? 'Новинка' : d.is_popular ? 'Популярное' : undefined,
    inStock: true,
    room: [],
  };
}

export function apiFullConfigToFullConfig(fc: ApiFullConfig): FullConfig {
  return {
    designId: fc.id,
    designName: fc.name,
    previewImage: fc.preview_image,
    description: fc.description,
    price: fc.price || DESIGN_OVERLAY_PRICE,
    textures: fc.textures.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      swatchImage: t.swatch_image,
      colors: t.colors.map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
        swatchImage: c.swatch_image,
      })),
    })),
    variantImages: fc.variant_images.map((v) => ({
      designId: v.design_id,
      textureId: v.texture_id,
      colorId: v.color_id,
      imagePath: v.image_path,
    })),
  };
}

export function apiCategoryToCategory(c: ApiCategory): Category {
  return {
    key: c.slug,
    label: c.name,
    image: c.image,
    count: c.count,
  };
}

export function apiReviewToReview(r: ApiReview): Review {
  return {
    id: r.id,
    author: r.user_name,
    rating: r.rating,
    text: r.text,
    date: r.created_at,
  };
}
