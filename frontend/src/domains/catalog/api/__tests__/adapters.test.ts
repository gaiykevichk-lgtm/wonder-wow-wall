import { describe, it, expect } from 'vitest';
import { apiDesignToProduct, apiCategoryToCategory, apiReviewToReview } from '../adapters';
import type { ApiDesign, ApiCategory, ApiReview } from '../../../../shared/api/types';
import { DESIGN_OVERLAY_PRICE, PANEL_SIZES } from '../../../../shared/config/constants';

describe('Catalog API Adapters', () => {
  describe('apiDesignToProduct', () => {
    const apiDesign: ApiDesign = {
      id: 'design-1',
      name: 'Дубовая классика',
      slug: 'dubovaya-klassika',
      category_id: 'wood',
      style: 'Классика',
      image: 'https://example.com/img.jpg',
      description: 'Beautiful oak design',
      price: 1200,
      colors: [
        { hex: '#8B4513', name: 'Дуб' },
        { hex: '#D2B48C', name: 'Светлый дуб' },
      ],
      rating: 4.5,
      reviews_count: 23,
      is_new: true,
      is_popular: false,
    };

    it('maps id, name, category, style', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.id).toBe('design-1');
      expect(result.name).toBe('Дубовая классика');
      expect(result.category).toBe('wood');
      expect(result.style).toBe('Классика');
    });

    it('maps price from API or falls back to DESIGN_OVERLAY_PRICE', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.price).toBe(1200);

      const noPriceDesign = { ...apiDesign, price: 0 };
      const result2 = apiDesignToProduct(noPriceDesign);
      expect(result2.price).toBe(DESIGN_OVERLAY_PRICE);
    });

    it('maps colors array', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.colors).toHaveLength(2);
      expect(result.colors[0]).toEqual({ hex: '#8B4513', name: 'Дуб' });
    });

    it('maps rating and reviews', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.rating).toBe(4.5);
      expect(result.reviews).toBe(23);
    });

    it('maps badge based on is_new and is_popular', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.badge).toBe('Новинка');

      const popularDesign = { ...apiDesign, is_new: false, is_popular: true };
      expect(apiDesignToProduct(popularDesign).badge).toBe('Популярное');

      const normalDesign = { ...apiDesign, is_new: false, is_popular: false };
      expect(apiDesignToProduct(normalDesign).badge).toBeUndefined();
    });

    it('generates sizes from PANEL_SIZES constant', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.sizes).toHaveLength(PANEL_SIZES.length);
      expect(result.sizes[0]).toHaveProperty('width');
      expect(result.sizes[0]).toHaveProperty('height');
      expect(result.sizes[0]).toHaveProperty('label');
    });

    it('sets inStock to true and priceUnit', () => {
      const result = apiDesignToProduct(apiDesign);
      expect(result.inStock).toBe(true);
      expect(result.priceUnit).toBe('/шт');
    });
  });

  describe('apiCategoryToCategory', () => {
    it('maps API category to frontend Category', () => {
      const apiCat: ApiCategory = {
        id: 'cat-1',
        name: 'Дерево',
        slug: 'wood',
        image: 'https://example.com/wood.jpg',
        count: 5,
      };

      const result = apiCategoryToCategory(apiCat);
      expect(result.key).toBe('wood'); // uses slug
      expect(result.label).toBe('Дерево');
      expect(result.image).toBe('https://example.com/wood.jpg');
      expect(result.count).toBe(5);
    });
  });

  describe('apiReviewToReview', () => {
    it('maps API review to frontend Review', () => {
      const apiReview: ApiReview = {
        id: 'rev-1',
        design_id: 'design-1',
        user_name: 'Иван',
        rating: 5,
        text: 'Отличный дизайн!',
        created_at: '2024-01-15T10:00:00',
      };

      const result = apiReviewToReview(apiReview);
      expect(result.id).toBe('rev-1');
      expect(result.author).toBe('Иван');
      expect(result.rating).toBe(5);
      expect(result.text).toBe('Отличный дизайн!');
      expect(result.date).toBe('2024-01-15T10:00:00');
    });
  });
});
