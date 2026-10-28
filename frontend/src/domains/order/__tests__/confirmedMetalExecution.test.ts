import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { useCartStore } from '../model/cartStore';
const rows = [{"id": "0cb56496-c139-5f97-9c93-36582993afa5", "panel_id": "faa8c134-4bbd-46a8-9bf7-e3254a83e3ea", "panel_name": "ДЕМО 2", "panel_size": "30×30 см", "texture_id": "3026ccf0-bbed-46d6-ab38-388c18f7fd61", "texture_name": "Металл", "color_id": null, "color_hex": "", "image_paths": ["PANEL_PHOTO/5f9719af-daa1-4ed6-8979-9f8295ad654a.png"], "design_image_paths": [], "is_active": true}, {"id": "b4ccb211-71f6-4459-84cd-48dd11d18eef", "panel_id": "faa8c134-4bbd-46a8-9bf7-e3254a83e3ea", "panel_name": "ДЕМО 2", "panel_size": "30×30 см", "texture_id": "3026ccf0-bbed-46d6-ab38-388c18f7fd61", "texture_name": "Металл", "color_id": null, "color_hex": "", "image_paths": ["PANEL_PHOTO/b402d1cf-d302-4f5b-b2b0-23c0c6cbdefe.png"], "design_image_paths": [], "is_active": true}];
it('реальные исполнения металла: первое, второе, первое — две строки 2 и 1', () => {
 const source = readFileSync('src/domains/catalog/ui/CatalogPanelPage.tsx','utf8');
 const start = source.indexOf('function getTextureGroups(');
 const end = source.indexOf('interface InteriorImage', start);
 const fn = source.slice(start,end).replace('variants: ApiPanelVariant[]', 'variants').replace('): TextureGroup[]', ')').replace('new Map<string, ApiPanelVariant[]>()','new Map()').replace('new Map<string, string>()','new Map()');
 const groups = new Function(fn + '; return getTextureGroups;')()(rows);
 const group = groups[0];
 expect(group.images).toHaveLength(2);
 useCartStore.getState().clearCart();
 for (const index of [0,1,0]) {
  const selectedVariant = group.variants[Math.min(index,group.variants.length-1)];
  const image = group.images[Math.min(index,group.images.length-1)];
  expect(selectedVariant.image_paths).toContain(image);
  useCartStore.getState().addItemWithQuantity({
   id: `exec-${selectedVariant.id}-300x300`, productId: selectedVariant.panel_id,
   variantId: selectedVariant.id, executionName: selectedVariant.name || '',
   name: selectedVariant.panel_name, image, price: 2400, area: 0.09,
   color: '',colorName: `Вариант ${index+1}`,textureId:selectedVariant.texture_id,
   textureName:selectedVariant.texture_name,sizeKey:'300x300',size:'300×300 мм'
  },1);
 }
 const items=useCartStore.getState().items;
 expect(items).toHaveLength(2);
 expect(items.map(i=>i.quantity)).toEqual([2,1]);
 expect(items[0].variantId).not.toBe(items[1].variantId);
 expect(items[0].image).not.toBe(items[1].image);
 useCartStore.getState().clearCart();
});
