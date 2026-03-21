// Maps API responses to existing frontend types
import type { PanelProduct, Category, Review } from '../model/types';
import type { ApiDesign, ApiCategory, ApiReview } from '../../../shared/api/types';
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
    gallery: [d.image],
    description: d.description,
    specs: {},
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
