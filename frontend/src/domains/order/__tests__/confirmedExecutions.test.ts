import { describe, expect, it, beforeEach } from 'vitest';
import { useCartStore } from '../model/cartStore';

async function fetchRows() {
  const r = await fetch('https://wonderwowwall.ru/api/panel-variants');
  return (await r.json()) as Array<{id:string;panel_name:string;texture_name:string;image_paths:string[]}>;
}
describe('PDP → cart integration on live API', () => {
  beforeEach(() => useCartStore.getState().clearCart());
  it('два разных исполнения кожи дают две строки; повтор первого не растёт во второй', async () => {
    const rows = await fetchRows();
    const leather = rows.filter((r) => r.panel_name === 'ДЕМО 2' && r.texture_name === 'Кожа');
    expect(leather.length).toBe(3);
    for (const index of [1, 2, 1]) {
      const variant = leather[index];
      useCartStore.getState().addItemWithQuantity({
        id: `exec-${variant.id}-300x300`, productId: variant.id,
        variantId: variant.id, executionName: '', name: 'ДЕМО 2 — Кожа',
        image: variant.image_paths[0], price: 2090, area: 0.09,
        color: '', colorName: `Вариант ${index+1}`,
        textureId: '', textureName: 'Кожа', sizeKey: '300x300', size: '300×300 мм',
      }, 1);
    }
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.quantity)).toEqual([2, 1]);
    expect(new Set(items.map((i) => i.variantId)).size).toBe(2);
  });
  it('исполнения разных фактур дают две строки', async () => {
    const rows = await fetchRows();
    const leather = rows.filter((r) => r.panel_name === 'ДЕМО 2' && r.texture_name === 'Кожа');
    const textile = rows.filter((r) => r.panel_name === 'ДЕМО 2' && r.texture_name === 'Текстиль');
    expect(leather.length).toBeGreaterThan(0);
    expect(textile.length).toBeGreaterThan(0);
    for (const variant of [leather[0], textile[0]]) {
      useCartStore.getState().addItemWithQuantity({
        id: `exec-${variant.id}-300x300`, productId: variant.id,
        variantId: variant.id, executionName: '', name: 'ДЕМО 2',
        image: variant.image_paths[0], price: 2090, area: 0.09,
        color: '', colorName: 'Вариант',
        textureId: '', textureName: variant.texture_name, sizeKey: '300x300', size: '300×300 мм',
      }, 1);
    }
    expect(useCartStore.getState().items).toHaveLength(2);
  });
});
