import { useMemo } from 'react';
import { useFullConfig } from './catalogApi';

interface SimpleColor {
  hex: string;
  name: string;
}

export function useConfigColors(designId: string, legacyColors: SimpleColor[]) {
  const { data: config, isLoading } = useFullConfig(designId);

  const colors = useMemo<SimpleColor[]>(() => {
    if (config && config.textures.length > 0) {
      const firstTexture = config.textures[0];
      if (firstTexture.colors.length > 0) {
        return firstTexture.colors.map((c) => ({ hex: c.hex, name: c.name }));
      }
    }
    return legacyColors;
  }, [config, legacyColors]);

  return { colors, isLoading };
}
