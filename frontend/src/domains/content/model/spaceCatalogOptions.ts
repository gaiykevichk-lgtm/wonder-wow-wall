import type { ApiPanelVariant, ApiPublicPanel, ApiPublicTexture } from "../../catalog/api/catalogApi";
import type { SpaceInterior } from "./spacesData";

export interface SpaceCatalogPanel extends ApiPublicPanel {
  finishes: ApiPanelVariant[];
}

/** Only real, active catalog rows. Legacy demo links are never presented as products. */
export function spaceCatalogOptions(
  interior: SpaceInterior,
  panels: ApiPublicPanel[],
  variants: ApiPanelVariant[],
  textures: ApiPublicTexture[],
): SpaceCatalogPanel[] {
  const [width, height] = interior.panelSize.split("x").map(Number);
  const activeTextureIds = new Set(textures.map(t => t.id));
  return panels.filter(panel => panel.is_active)
    .map(panel => ({
      ...panel,
      finishes: variants.filter(variant => variant.is_active && variant.panel_id === panel.id &&
        activeTextureIds.has(variant.texture_id) && variant.image_paths.some(Boolean)),
    }))
    .filter(panel => panel.finishes.length > 0)
    .sort((a, b) => Number(b.width_mm === width && b.height_mm === height) - Number(a.width_mm === width && a.height_mm === height));
}
