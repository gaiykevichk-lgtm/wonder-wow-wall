import { describe, it, expect } from 'vitest';
import { resolveSpaceRender, resolveCatalogBinding, type PresentableInterior } from '../model/spacePresentation';
const scene = { id: 'scene', renders: [{ sceneId: 'scene', panelSlug: 'panel', textureId: 'oak', mode: 'mono', image: '/verified.jpg' }], catalogBindings: [{ panelSlug: 'panel', textureId: 'oak', groupId: 'wood', finishImage: '/oak.jpg' }] } as PresentableInterior;
describe('Exact scene presentation', () => {
 it('resolves the exact render tuple', () => expect(resolveSpaceRender(scene, 'panel', 'oak', 'mono')?.image).toBe('/verified.jpg'));
 it('never substitutes another mode, panel, texture or room', () => {
  expect(resolveSpaceRender(scene, 'panel', 'oak', 'combined')).toBeUndefined();
  expect(resolveSpaceRender(scene, 'other', 'oak', 'mono')).toBeUndefined();
  expect(resolveSpaceRender(scene, 'panel', 'birch', 'mono')).toBeUndefined();
  expect(resolveSpaceRender({ ...scene, id: 'other' }, 'panel', 'oak', 'mono')).toBeUndefined();
 });
 it('binds exact catalog finish without family fallback', () => {
  expect(resolveCatalogBinding(scene, 'panel', 'oak')?.finishImage).toBe('/oak.jpg');
  expect(resolveCatalogBinding(scene, 'panel', 'birch')).toBeUndefined();
 });
});
