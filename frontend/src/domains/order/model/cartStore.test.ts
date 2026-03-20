import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore';

const reset = () => useCartStore.setState({ items: [], isOpen: false });

const mockItem = (overrides: Partial<{ id: string; name: string; price: number }> = {}) => ({
  id: overrides.id ?? 'item-1',
  name: overrides.name ?? 'Тропический лес',
  image: '/images/design-1.jpg',
  price: overrides.price ?? 2090,
  size: '30×30 см',
  color: 'Зелёный',
});

describe('cartStore', () => {
  beforeEach(() => {
    reset();
  });

  it('starts with empty cart', () => {
    const s = useCartStore.getState();
    expect(s.items).toEqual([]);
    expect(s.total()).toBe(0);
    expect(s.totalItems()).toBe(0);
  });

  it('addItem adds new item with quantity 1', () => {
    useCartStore.getState().addItem(mockItem());
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
    expect(items[0].name).toBe('Тропический лес');
  });

  it('addItem increments quantity for duplicate id', () => {
    useCartStore.getState().addItem(mockItem());
    useCartStore.getState().addItem(mockItem());
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('addItem handles multiple different items', () => {
    useCartStore.getState().addItem(mockItem({ id: 'a', price: 1000 }));
    useCartStore.getState().addItem(mockItem({ id: 'b', price: 2000 }));
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('removeItem removes by id', () => {
    useCartStore.getState().addItem(mockItem({ id: 'a' }));
    useCartStore.getState().addItem(mockItem({ id: 'b' }));
    useCartStore.getState().removeItem('a');
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('b');
  });

  it('updateQuantity sets quantity (min 1)', () => {
    useCartStore.getState().addItem(mockItem());
    useCartStore.getState().updateQuantity('item-1', 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);

    useCartStore.getState().updateQuantity('item-1', 0);
    expect(useCartStore.getState().items[0].quantity).toBe(1); // min 1
  });

  it('clearCart removes all items', () => {
    useCartStore.getState().addItem(mockItem({ id: 'a' }));
    useCartStore.getState().addItem(mockItem({ id: 'b' }));
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it('total() calculates sum of price * quantity', () => {
    useCartStore.getState().addItem(mockItem({ id: 'a', price: 1000 }));
    useCartStore.getState().addItem(mockItem({ id: 'b', price: 2000 }));
    useCartStore.getState().updateQuantity('a', 3);
    // 1000*3 + 2000*1 = 5000
    expect(useCartStore.getState().total()).toBe(5000);
  });

  it('totalItems() sums all quantities', () => {
    useCartStore.getState().addItem(mockItem({ id: 'a' }));
    useCartStore.getState().addItem(mockItem({ id: 'b' }));
    useCartStore.getState().updateQuantity('a', 3);
    // 3 + 1 = 4
    expect(useCartStore.getState().totalItems()).toBe(4);
  });

  it('setOpen toggles drawer state', () => {
    expect(useCartStore.getState().isOpen).toBe(false);
    useCartStore.getState().setOpen(true);
    expect(useCartStore.getState().isOpen).toBe(true);
    useCartStore.getState().setOpen(false);
    expect(useCartStore.getState().isOpen).toBe(false);
  });
});
