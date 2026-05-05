import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../api/catalogApi', () => ({
  useFullConfig: vi.fn(),
}));
import { useFullConfig } from '../api/catalogApi';
import { useConfigColors } from '../api/useConfigColors';

const legacyColors = [
  { hex: '#ff0000', name: 'Red' },
  { hex: '#00ff00', name: 'Green' },
];

describe('useConfigColors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns legacy colors when config has no textures', () => {
    (useFullConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { textures: [] },
      isLoading: false,
    });

    const { result } = renderHook(() => useConfigColors('design-1', legacyColors));

    expect(result.current.colors).toEqual(legacyColors);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns texture colors from first texture when available', () => {
    const textureColors = [
      { hex: '#0000ff', name: 'Blue' },
      { hex: '#ffff00', name: 'Yellow' },
    ];

    (useFullConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        textures: [
          { colors: textureColors },
          { colors: [{ hex: '#000000', name: 'Black' }] },
        ],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useConfigColors('design-2', legacyColors));

    expect(result.current.colors).toEqual(textureColors);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns legacy colors when first texture has no colors', () => {
    (useFullConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        textures: [{ colors: [] }],
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useConfigColors('design-3', legacyColors));

    expect(result.current.colors).toEqual(legacyColors);
    expect(result.current.isLoading).toBe(false);
  });
});
