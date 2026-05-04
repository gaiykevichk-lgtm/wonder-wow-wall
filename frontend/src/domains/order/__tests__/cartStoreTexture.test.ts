import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../model/cartStore';

const reset = () => useCartStore.setState({ items: [], isOpen: false });

describe('cartStore — texture fields (Phase 5)', () => {
  beforeEach(reset);

  it('addItem normalizes missing texture fields to empty strings', () => {
    useCartStore.getState().addItem({
      id: 'item-1',
      productId: 'design-1',
      name: 'Test',
      image: '/img.jpg',
      price: 2090,
      area: 1,
      color: '#808080',
      colorName: 'Серый',
      size: '30×30 см',
    });

    const item = useCartStore.getState().items[0];
    expect(item.colorId).toBe('');
    expect(item.textureName).toBe('');
    expect(item.textureId).toBe('');
    expect(item.sizeKey).toBe('');
  });

  it('addItem preserves texture fields when provided', () => {
    useCartStore.getState().addItem({
      id: 'item-tex',
      productId: 'design-1',
      name: 'Test',
      image: '/img.jpg',
      price: 2090,
      area: 1,
      color: '#808080',
      colorName: 'Серый',
      colorId: 'color-1',
      textureName: 'Бетон',
      textureId: 'tex-1',
      sizeKey: '300x300',
      size: '30×30 см',
    });

    const item = useCartStore.getState().items[0];
    expect(item.colorId).toBe('color-1');
    expect(item.textureName).toBe('Бетон');
    expect(item.textureId).toBe('tex-1');
    expect(item.sizeKey).toBe('300x300');
  });

  it('same design, different sizes create separate cart items', () => {
    const base = {
      productId: 'design-1',
      name: 'Test',
      image: '/img.jpg',
      price: 2090,
      area: 1,
      color: '#808080',
      colorName: 'Серый',
      colorId: 'c1',
      textureName: 'Бетон',
      textureId: 'tex-1',
    };

    useCartStore.getState().addItem({
      ...base,
      id: 'design-1-tex-1-c1-300x300',
      sizeKey: '300x300',
      size: '30×30 см',
    });
    useCartStore.getState().addItem({
      ...base,
      id: 'design-1-tex-1-c1-300x600',
      sizeKey: '300x600',
      size: '30×60 см',
    });

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].sizeKey).toBe('300x300');
    expect(items[1].sizeKey).toBe('300x600');
  });

  it('addItemWithQuantity normalizes texture fields', () => {
    useCartStore.getState().addItemWithQuantity(
      {
        id: 'item-batch',
        productId: 'design-1',
        name: 'Test',
        image: '/img.jpg',
        price: 2090,
        area: 1,
        color: '#808080',
        colorName: 'Серый',
        size: '30×30 см',
      },
      5,
    );

    const item = useCartStore.getState().items[0];
    expect(item.quantity).toBe(5);
    expect(item.textureId).toBe('');
    expect(item.textureName).toBe('');
  });
});
