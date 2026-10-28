import type { SpaceInterior } from './spacesData';

export interface SpaceRender {
 sceneId: string;
 panelSlug: string;
 /** Моно — один id, комбо — ровно два. Старые записи могут нести `textureId`. */
 textureIds: string[];
 textureId?: string;
 mode: 'mono' | 'combined';
 image: string;
}
export interface CatalogBinding {
 panelSlug: string;
 textureId: string;
 groupId: string;
 finishImage: string;
}
export type PresentableInterior = SpaceInterior & {
 renders?: SpaceRender[];
 catalogBindings?: CatalogBinding[];
};

/** No family or first-variant fallback: only explicit content bindings. */
export function renderTextureIds(render: Pick<SpaceRender, 'textureId' | 'textureIds'> | { textureId?: string; textureIds?: string[] }): string[] {
 const ids = [...(render.textureIds || [])];
 if (render.textureId && !ids.includes(render.textureId)) ids.push(render.textureId);
 return ids.slice(0, 2);
}
export function resolveSpaceRender(interior: PresentableInterior, panelSlug: string, textureId: string, mode: SpaceRender['mode']) {
 return interior.renders?.find(r => r.sceneId === interior.id && r.panelSlug === panelSlug && r.mode === mode && r.image && (mode === 'mono'
  ? renderTextureIds(r).length === 1 && renderTextureIds(r)[0] === textureId
  : renderTextureIds(r).length === 2 && renderTextureIds(r).includes(textureId)));
}
export function resolveCatalogBinding(interior: { catalogBindings?: CatalogBinding[] }, panelSlug: string, textureId: string) {
 return interior.catalogBindings?.find(b => b.panelSlug === panelSlug && b.textureId === textureId && b.groupId && b.finishImage);
}
