import { describe, it, expect } from 'vitest';
import {
  getPanelSizeConfig,
  panelSizeInPixels,
  canPlacePanel,
  overlapsObstacle,
  snapToGrid,
  autoFillWall,
  placeSinglePanel,
} from '../lib/layoutEngine';
import type { Obstacle } from '../model/types';
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

    it('returns null when placement overlaps obstacle', () => {
      const mask = createEmptyMask(500, 500, 255);
      const obstacles: Obstacle[] = [
        {
          type: 'door',
          label: 'Дверь',
          polygon: [
            { x: 80, y: 80 },
            { x: 180, y: 80 },
            { x: 180, y: 280 },
            { x: 80, y: 280 },
          ],
          boundingBox: { x: 80, y: 80, width: 100, height: 200 },
          confidence: 0.9,
        },
      ];

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
        obstacles,
      );

      expect(panel).toBeNull();
    });
  });

  describe('overlapsObstacle', () => {
    const obstacles: Obstacle[] = [
      {
        type: 'door',
        label: 'Дверь',
        polygon: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 300 },
          { x: 100, y: 300 },
        ],
        boundingBox: { x: 100, y: 100, width: 100, height: 200 },
        confidence: 0.9,
      },
    ];

    it('returns true when rect overlaps obstacle', () => {
      expect(overlapsObstacle(150, 150, 100, 100, obstacles)).toBe(true);
    });

    it('returns false when rect does not overlap', () => {
      expect(overlapsObstacle(0, 0, 50, 50, obstacles)).toBe(false);
      expect(overlapsObstacle(250, 250, 50, 50, obstacles)).toBe(false);
    });

    it('returns false for empty obstacles array', () => {
      expect(overlapsObstacle(100, 100, 50, 50, [])).toBe(false);
    });

    it('detects edge overlap', () => {
      // Rect ends exactly at obstacle start — no overlap
      expect(overlapsObstacle(0, 0, 100, 100, obstacles)).toBe(false);
      // Rect overlaps by 1 pixel
      expect(overlapsObstacle(0, 0, 101, 101, obstacles)).toBe(true);
    });
  });

  describe('autoFillWall with obstacles', () => {
    it('skips cells that overlap with obstacles', () => {
      const mask = createEmptyMask(300, 300, 255);
      const obstacles: Obstacle[] = [
        {
          type: 'window',
          label: 'Окно',
          polygon: [
            { x: 0, y: 0 },
            { x: 90, y: 0 },
            { x: 90, y: 90 },
            { x: 0, y: 90 },
          ],
          boundingBox: { x: 0, y: 0, width: 90, height: 90 },
          confidence: 0.8,
        },
      ];

      const panelsWithout = autoFillWall({
        mask,
        sizeKey: '30x30',
        calibration: { method: 'manual', pixelsPerCm: 1 },
        designId: 'd1',
        designName: 'Test',
        designImage: 'test.jpg',
        color: '#FFF',
        colorName: 'White',
      });

      const panelsWith = autoFillWall({
        mask,
        sizeKey: '30x30',
        calibration: { method: 'manual', pixelsPerCm: 1 },
        designId: 'd1',
        designName: 'Test',
        designImage: 'test.jpg',
        color: '#FFF',
        colorName: 'White',
        obstacles,
      });

      // With obstacles should have fewer panels
      expect(panelsWith.length).toBeLessThan(panelsWithout.length);
      // The 3x3 grid cells (0,0)-(89,89) overlap the obstacle — 9 fewer panels
      expect(panelsWithout.length - panelsWith.length).toBe(9);
    });

    it('places panels on partial wall mask (not fully white)', () => {
      // Create mask where only top-left 150x150 is wall
      const mask = createEmptyMask(300, 300, 0);
      for (let y = 0; y < 150; y++) {
        for (let x = 0; x < 150; x++) {
          mask.data[y * 300 + x] = 255;
        }
      }

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

      // 150/30 = 5 panels per row, 5 rows = 25
      expect(panels.length).toBe(25);
      // All panels should be within the wall area
      for (const p of panels) {
        expect(p.x + p.renderWidth).toBeLessThanOrEqual(150);
        expect(p.y + p.renderHeight).toBeLessThanOrEqual(150);
      }
    });
  });
});
