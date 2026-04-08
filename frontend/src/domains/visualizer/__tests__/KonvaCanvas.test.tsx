import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KonvaCanvas } from '../ui/KonvaCanvas';
import { createEmptyMask } from '../lib/maskUtils';
import type { Scene, PlacedPanel } from '../model/types';

// Mock Konva — react-konva needs canvas/WebGL which jsdom doesn't have
vi.mock('react-konva', () => {
  const React = require('react');

  const Stage = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        getPointerPosition: () => ({ x: 100, y: 100 }),
        toDataURL: () => 'data:image/png;base64,mock',
      }));
      return React.createElement(
        'div',
        {
          'data-testid': 'konva-stage',
          onMouseDown: props.onMouseDown,
          onMouseMove: props.onMouseMove,
          onMouseUp: props.onMouseUp,
          onMouseLeave: props.onMouseLeave,
          onWheel: props.onWheel,
          style: props.style,
        },
        props.children,
      );
    },
  );
  Stage.displayName = 'Stage';

  const Layer = (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-layer' }, props.children);

  const Rect = (props: Record<string, unknown>) =>
    React.createElement('div', {
      'data-testid': `konva-rect-${props.x}-${props.y}`,
      onClick: props.onClick,
      onMouseEnter: props.onMouseEnter,
      onMouseLeave: props.onMouseLeave,
    });

  const Image = (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-image', style: { width: props.width, height: props.height } });

  const Circle = (props: Record<string, unknown>) =>
    React.createElement('div', {
      'data-testid': 'konva-circle',
      onClick: props.onClick,
    });

  const Group = (props: Record<string, unknown>) =>
    React.createElement('div', { 'data-testid': 'konva-group' }, props.children);

  return { Stage, Layer, Rect, Image, Circle, Group };
});

// Polyfill ResizeObserver for jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill ImageData and canvas 2d context for jsdom
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

// Mock canvas getContext for maskToCanvas
const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
  const el = origCreateElement(tag, options);
  if (tag === 'canvas') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (el as any).getContext = () => ({
      putImageData: vi.fn(),
      getImageData: vi.fn(() => new ImageData(1, 1)),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
    });
  }
  return el;
});

function createTestScene(width = 400, height = 300): Scene {
  return {
    photo: { url: 'data:image/png;base64,test', width, height },
    wallMask: createEmptyMask(width, height, 255),
    objectMask: { obstacles: [] },
    calibration: { method: 'manual', pixelsPerCm: 5 },
    segmentationStatus: 'ready',
  };
}

function createTestPanel(overrides: Partial<PlacedPanel> = {}): PlacedPanel {
  return {
    id: 'p1',
    designId: 'd1',
    designName: 'Test Design',
    designImage: 'test.jpg',
    sizeKey: '30x30',
    color: '#CCCCCC',
    colorName: 'Gray',
    x: 50,
    y: 50,
    renderWidth: 150,
    renderHeight: 150,
    ...overrides,
  };
}

const defaultProps = {
  scene: createTestScene(),
  panels: [] as PlacedPanel[],
  maskVisible: true,
  maskOpacity: 0.3,
  maskTool: null,
  brushSize: 20,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  placementMode: 'manual' as const,
  hoverCell: null,
  cellSizePx: { w: 150, h: 150 },
};

describe('KonvaCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders container with correct test id', () => {
    render(<KonvaCanvas {...defaultProps} />);
    expect(screen.getByTestId('konva-canvas-container')).toBeInTheDocument();
  });

  it('renders Konva stage', () => {
    render(<KonvaCanvas {...defaultProps} />);
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('renders multiple layers', () => {
    render(<KonvaCanvas {...defaultProps} />);
    const layers = screen.getAllByTestId('konva-layer');
    // photo, mask, UI overlays, panels = 4 layers minimum
    expect(layers.length).toBeGreaterThanOrEqual(4);
  });

  it('renders panels as groups', () => {
    const panels = [createTestPanel(), createTestPanel({ id: 'p2', x: 200, y: 200 })];
    render(<KonvaCanvas {...defaultProps} panels={panels} />);
    const groups = screen.getAllByTestId('konva-group');
    expect(groups.length).toBe(2);
  });

  it('shows delete button when panel is selected', () => {
    const panel = createTestPanel();
    const onRemovePanel = vi.fn();
    render(
      <KonvaCanvas {...defaultProps} panels={[panel]} onRemovePanel={onRemovePanel} />,
    );

    // Click on the panel rect to select it
    const panelRect = screen.getByTestId(`konva-rect-${panel.x}-${panel.y}`);
    fireEvent.click(panelRect);

    // HTML delete button should appear
    expect(screen.getByTestId('panel-delete-btn')).toBeInTheDocument();
  });

  it('calls onRemovePanel when delete button clicked', () => {
    const panel = createTestPanel();
    const onRemovePanel = vi.fn();
    render(
      <KonvaCanvas {...defaultProps} panels={[panel]} onRemovePanel={onRemovePanel} />,
    );

    // Select panel
    const panelRect = screen.getByTestId(`konva-rect-${panel.x}-${panel.y}`);
    fireEvent.click(panelRect);

    // Click delete
    fireEvent.click(screen.getByTestId('panel-delete-btn'));
    expect(onRemovePanel).toHaveBeenCalledWith('p1');
  });

  it('deselects panel when clicking the same panel again', () => {
    const panel = createTestPanel();
    render(<KonvaCanvas {...defaultProps} panels={[panel]} />);

    const panelRect = screen.getByTestId(`konva-rect-${panel.x}-${panel.y}`);

    // Select
    fireEvent.click(panelRect);
    expect(screen.getByTestId('panel-delete-btn')).toBeInTheDocument();

    // Deselect
    fireEvent.click(panelRect);
    expect(screen.queryByTestId('panel-delete-btn')).not.toBeInTheDocument();
  });

  it('applies crosshair cursor when mask tool is active', () => {
    render(<KonvaCanvas {...defaultProps} maskTool="brush" />);
    const container = screen.getByTestId('konva-canvas-container');
    expect(container.style.cursor).toBe('crosshair');
  });

  it('applies crosshair cursor in accent placement mode', () => {
    render(<KonvaCanvas {...defaultProps} placementMode="accent" />);
    const container = screen.getByTestId('konva-canvas-container');
    expect(container.style.cursor).toBe('crosshair');
  });

  it('applies default cursor when no mask tool and manual mode', () => {
    render(<KonvaCanvas {...defaultProps} />);
    const container = screen.getByTestId('konva-canvas-container');
    expect(container.style.cursor).toBe('default');
  });

  it('renders hover cell overlay when hoverCell is provided', () => {
    render(
      <KonvaCanvas
        {...defaultProps}
        hoverCell={{ x: 0, y: 0 }}
        cellSizePx={{ w: 150, h: 150 }}
      />,
    );
    // The hover rect should exist
    expect(screen.getByTestId('konva-rect-0-0')).toBeInTheDocument();
  });

  it('renders with border-radius 12 container', () => {
    render(<KonvaCanvas {...defaultProps} />);
    const container = screen.getByTestId('konva-canvas-container');
    expect(container.style.borderRadius).toBe('12px');
  });
});
