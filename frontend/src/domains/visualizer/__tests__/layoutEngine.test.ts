import { describe, it, expect } from 'vitest';
import {
  getPanelSizeConfig,
  panelSizeInPixels,
  canPlacePanel,
  snapToGrid,
  autoFillWall,
  placeSinglePanel,
} from '../lib/layoutEngine';
import { createEmptyMask } from '../lib/maskUtils';

describe('layoutEngine', () => {
  describe('getPanelSizeConfig', () => {
    it('returns correct config for 30x30', () => {
      const config = getPanelSizeConfig('30x30');
      expect(config.widthCm).toBe(30);
      expect(config.heightCm).toBe(30);
      expect(config.widthCells).toBe(1);
      expect(config.heightCells).toBe(1);
    });

    it('returns correct config for 60x60', () => {
      const config = getPanelSizeConfig('60x60');
      expect(config.widthCm).toBe(60);
      expect(config.heightCm).toBe(60);
    });

    it('throws for unknown size', () => {
      expect(() => getPanelSizeConfig('99x99' as never)).toThrow();
    });
  });

  describe('panelSizeInPixels', () => {
    it('uses default 5 px/cm without calibration', () => {
      const { widthPx, heightPx } = panelSizeInPixels('30x30', null);
      expect(widthPx).toBe(150); // 30cm * 5px/cm
      expect(heightPx).toBe(150);
    });

    it('uses calibration pixelsPerCm', () => {
      const { widthPx, heightPx } = panelSizeInPixels('30x30', {
        method: 'manual',
        pixelsPerCm: 10,
      });
      expect(widthPx).toBe(300);
      expect(heightPx).toBe(300);
    });

    it('handles 30x60 size', () => {
      const { widthPx, heightPx } = panelSizeInPixels('30x60', null);
      expect(widthPx).toBe(150);
      expect(heightPx).toBe(300);
    });
  });

  describe('canPlacePanel', () => {
    it('allows placement on full wall mask', () => {
      const mask = createEmptyMask(500, 500, 255);
      expect(canPlacePanel(mask, 0, 0, 100, 100, [])).toBe(true);
    });

    it('rejects placement outside bounds', () => {
      const mask = createEmptyMask(500, 500, 255);
      expect(canPlacePanel(mask, 450, 0, 100, 100, [])).toBe(false);
      expect(canPlacePanel(mask, -10, 0, 100, 100, [])).toBe(false);
    });

    it('rejects placement on empty mask', () => {
      const mask = createEmptyMask(500, 500, 0);
      expect(canPlacePanel(mask, 0, 0, 100, 100, [])).toBe(false);
    });

    it('rejects placement overlapping existing panel', () => {
      const mask = createEmptyMask(500, 500, 255);
      const existing = [
        {
          id: 'p1',
          designId: 'd1',
          designName: 'Test',
          designImage: '',
          sizeKey: '30x30' as const,
          color: '#FFF',
          colorName: 'White',
          x: 50,
          y: 50,
          renderWidth: 100,
          renderHeight: 100,
        },
      ];
      // Overlapping position
      expect(canPlacePanel(mask, 60, 60, 100, 100, existing)).toBe(false);
      // Non-overlapping position
      expect(canPlacePanel(mask, 200, 200, 100, 100, existing)).toBe(true);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to nearest grid point', () => {
      expect(snapToGrid(105, 205, 100, 100)).toEqual({ x: 100, y: 200 });
      expect(snapToGrid(155, 255, 100, 100)).toEqual({ x: 200, y: 300 });
    });

    it('snaps 0,0 correctly', () => {
      expect(snapToGrid(0, 0, 50, 50)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('autoFillWall', () => {
    it('fills entire wall mask with panels', () => {
      const mask = createEmptyMask(300, 300, 255);
      const panels = autoFillWall({
        mask,
        sizeKey: '30x30',
        calibration: { method: 'manual', pixelsPerCm: 1 },
        designId: 'd1',
        designName: 'Test',
        designImage: 'test.jpg',
        color: '#FFF',
        colorName: 'White',
      });

      // 300px / 30px = 10 panels per row, 10 rows = 100 panels
      expect(panels.length).toBe(100);
    });

    it('fills only accent zone when provided', () => {
      const mask = createEmptyMask(300, 300, 255);
      const panels = autoFillWall({
        mask,
        sizeKey: '30x30',
        calibration: { method: 'manual', pixelsPerCm: 1 },
        designId: 'd1',
        designName: 'Test',
        designImage: 'test.jpg',
        color: '#FFF',
        colorName: 'White',
        accentZone: {
          topLeft: { x: 0, y: 0 },
          bottomRight: { x: 90, y: 90 },
        },
      });

      // 90px / 30px = 3 panels per row, 3 rows = 9 panels
      expect(panels.length).toBe(9);
    });

    it('skips cells with no wall coverage', () => {
      const mask = createEmptyMask(300, 300, 0); // no wall
      const panels = autoFillWall({
        mask,
        sizeKey: '30x30',
        calibration: { method: 'manual', pixelsPerCm: 1 },
        designId: 'd1',
        designName: 'Test',
        designImage: 'test.jpg',
        color: '#FFF',
        colorName: 'White',
      });

      expect(panels.length).toBe(0);
    });

    it('generates unique IDs for each panel', () => {
      const mask = createEmptyMask(100, 100, 255);
      const panels = autoFillWall({
        mask,
        sizeKey: '30x30',
        calibration: { method: 'manual', pixelsPerCm: 1 },
        designId: 'd1',
        designName: 'Test',
        designImage: 'test.jpg',
        color: '#FFF',
        colorName: 'White',
      });

      const ids = new Set(panels.map((p) => p.id));
      expect(ids.size).toBe(panels.length);
    });
  });

  describe('placeSinglePanel', () => {
    it('places panel at valid position', () => {
      const mask = createEmptyMask(500, 500, 255);
      const panel = placeSinglePanel(
        mask,
        100,
        100,
        '30x30',
        { method: 'manual', pixelsPerCm: 1 },
        [],
        { id: 'd1', name: 'Test', image: 'test.jpg' },
        '#FFF',
        'White',
      );

      expect(panel).not.toBeNull();
      expect(panel!.designId).toBe('d1');
      expect(panel!.sizeKey).toBe('30x30');
      expect(panel!.renderWidth).toBe(30);
      expect(panel!.renderHeight).toBe(30);
    });

    it('returns null for invalid position', () => {
      const mask = createEmptyMask(500, 500, 0); // no wall
      const panel = placeSinglePanel(
        mask,
        100,
        100,
        '30x30',
        null,
        [],
        { id: 'd1', name: 'Test', image: 'test.jpg' },
        '#FFF',
        'White',
      );

      expect(panel).toBeNull();
    });
  });
});
