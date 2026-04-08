import { useRef, useEffect, useCallback, useState } from 'react';
import { CloseCircleFilled } from '@ant-design/icons';
import type { Scene, PlacedPanel, MaskTool, Point, AccentZone, PlacementMode, EditorMode } from '../model/types';
import { wallMaskToImageData } from '../lib/maskUtils';

const touchDist = (a: React.Touch, b: React.Touch) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/** Cache of loaded design texture images keyed by URL. */
const designImageCache = new Map<string, HTMLImageElement>();

function getDesignImage(url: string): HTMLImageElement | null {
  return designImageCache.get(url) ?? null;
}

function loadDesignImage(url: string, onLoad: () => void): void {
  if (designImageCache.has(url)) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    designImageCache.set(url, img);
    onLoad();
  };
  img.src = url;
}

interface WallCanvasProps {
  scene: Scene;
  panels: PlacedPanel[];
  maskVisible: boolean;
  maskOpacity: number;
  maskTool: MaskTool | null;
  brushSize: number;
  zoom: number;
  panOffset: Point;
  placementMode: PlacementMode;
  hoverCell: Point | null;
  cellSizePx: { w: number; h: number } | null;
  onCanvasClick?: (x: number, y: number) => void;
  onMaskStroke?: (points: Point[]) => void;
  onPanChange?: (offset: Point) => void;
  onZoomChange?: (zoom: number) => void;
  onRemovePanel?: (id: string) => void;
  onHoverChange?: (point: Point | null) => void;
  onAccentZoneDraw?: (zone: AccentZone) => void;
  editorMode?: EditorMode;
  onCalibrationClick?: (point: Point) => void;
}

export function WallCanvas({
  scene,
  panels,
  maskVisible,
  maskOpacity,
  maskTool,
  brushSize,
  zoom,
  panOffset,
  placementMode,
  hoverCell,
  cellSizePx,
  onCanvasClick,
  onMaskStroke,
  onPanChange,
  onZoomChange,
  onRemovePanel,
  onHoverChange,
  onAccentZoneDraw,
  editorMode = 'default',
  onCalibrationClick,
}: WallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const strokePointsRef = useRef<Point[]>([]);
  const isPaintingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef<Point>({ x: 0, y: 0 });
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  // Accent zone drawing state
  const isDrawingZoneRef = useRef(false);
  const zoneStartRef = useRef<Point>({ x: 0, y: 0 });
  const [zoneDragEnd, setZoneDragEnd] = useState<Point | null>(null);
  // Container size for aspect-ratio-correct rendering
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  // Force re-render when design images load
  const [designImgTick, setDesignImgTick] = useState(0);

  // Track container size for aspect-ratio-correct canvas display
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      if (width > 0 && height > 0) setContainerSize({ width, height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Load photo image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = scene.photo.url;
  }, [scene.photo.url]);

  // Load design images for placed panels
  useEffect(() => {
    const urls = new Set(panels.map((p) => p.designImage).filter(Boolean));
    for (const url of urls) {
      loadDesignImage(url, () => setDesignImgTick((t) => t + 1));
    }
  }, [panels]);

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    if (!canvas || !ctx || !img || !imageLoaded) return;

    canvas.width = scene.photo.width;
    canvas.height = scene.photo.height;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw photo
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw wall mask
    if (maskVisible && scene.wallMask) {
      const maskImageData = wallMaskToImageData(
        scene.wallMask,
        [76, 175, 80],
        maskOpacity,
      );
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = scene.wallMask.width;
      maskCanvas.height = scene.wallMask.height;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.putImageData(maskImageData, 0, 0);
      ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    }

    // Draw hover highlight in manual mode
    if (hoverCell && cellSizePx && placementMode === 'manual' && !maskTool) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.18)';
      ctx.fillRect(hoverCell.x, hoverCell.y, cellSizePx.w, cellSizePx.h);
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(hoverCell.x, hoverCell.y, cellSizePx.w, cellSizePx.h);
      ctx.setLineDash([]);
    }

    // Draw accent zone preview while dragging
    if (zoneDragEnd && isDrawingZoneRef.current) {
      const zx = Math.min(zoneStartRef.current.x, zoneDragEnd.x);
      const zy = Math.min(zoneStartRef.current.y, zoneDragEnd.y);
      const zw = Math.abs(zoneDragEnd.x - zoneStartRef.current.x);
      const zh = Math.abs(zoneDragEnd.y - zoneStartRef.current.y);
      ctx.fillStyle = 'rgba(76, 175, 80, 0.12)';
      ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(zx, zy, zw, zh);
      ctx.setLineDash([]);
    }

    // Draw panels
    for (const panel of panels) {
      ctx.globalAlpha = 0.85;

      // Draw design texture if loaded, otherwise solid color
      const designImg = panel.designImage ? getDesignImage(panel.designImage) : null;
      if (designImg) {
        ctx.drawImage(designImg, panel.x, panel.y, panel.renderWidth, panel.renderHeight);
        // Apply color tint overlay
        if (panel.color) {
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = panel.color;
          ctx.fillRect(panel.x, panel.y, panel.renderWidth, panel.renderHeight);
          ctx.globalAlpha = 0.85;
        }
      } else {
        ctx.fillStyle = panel.color || '#CCCCCC';
        ctx.fillRect(panel.x, panel.y, panel.renderWidth, panel.renderHeight);
      }

      // Panel border
      ctx.globalAlpha = 1;
      const isSelected = panel.id === selectedPanelId;
      ctx.strokeStyle = isSelected ? '#4CAF50' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(panel.x, panel.y, panel.renderWidth, panel.renderHeight);
    }

    ctx.restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, panels, maskVisible, maskOpacity, imageLoaded, hoverCell, cellSizePx, placementMode, maskTool, selectedPanelId, zoneDragEnd, designImgTick]);

  useEffect(() => {
    render();
  }, [render]);

  // Compute display size maintaining aspect ratio (fit within container)
  const displaySize = (() => {
    const photoW = scene.photo.width || 1;
    const photoH = scene.photo.height || 1;
    const sx = containerSize.width / photoW;
    const sy = containerSize.height / photoH;
    const s = Math.min(sx, sy, 1);
    return { width: photoW * s, height: photoH * s };
  })();

  // Get coordinates relative to image
  const getImageCoords = useCallback(
    (e: React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  // Find panel at image coordinates
  const findPanelAt = useCallback(
    (pt: Point): PlacedPanel | undefined =>
      [...panels].reverse().find(
        (p) => pt.x >= p.x && pt.x <= p.x + p.renderWidth && pt.y >= p.y && pt.y <= p.y + p.renderHeight,
      ),
    [panels],
  );

  // Snap point to grid cell for hover
  const snapToGrid = useCallback(
    (pt: Point): Point | null => {
      if (!cellSizePx) return null;
      return {
        x: Math.floor(pt.x / cellSizePx.w) * cellSizePx.w,
        y: Math.floor(pt.y / cellSizePx.h) * cellSizePx.h,
      };
    },
    [cellSizePx],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (maskTool) {
        isPaintingRef.current = true;
        const point = getImageCoords(e);
        strokePointsRef.current = [point];
        return;
      }

      // Accent zone drawing
      if (placementMode === 'accent' && !maskTool) {
        const point = getImageCoords(e);
        isDrawingZoneRef.current = true;
        zoneStartRef.current = point;
        return;
      }
    },
    [maskTool, getImageCoords, placementMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        onPanChange?.({ x: panOffset.x + dx, y: panOffset.y + dy });
        return;
      }

      if (isPaintingRef.current && maskTool) {
        const point = getImageCoords(e);
        strokePointsRef.current.push(point);
        return;
      }

      // Accent zone drag preview
      if (isDrawingZoneRef.current) {
        const point = getImageCoords(e);
        setZoneDragEnd(point);
        return;
      }

      // Hover highlight in manual mode
      if (placementMode === 'manual' && !maskTool) {
        const point = getImageCoords(e);
        const snapped = snapToGrid(point);
        onHoverChange?.(snapped);
      }
    },
    [maskTool, panOffset, onPanChange, getImageCoords, placementMode, snapToGrid, onHoverChange],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }

      if (isPaintingRef.current && maskTool) {
        isPaintingRef.current = false;
        if (strokePointsRef.current.length > 0) {
          onMaskStroke?.(strokePointsRef.current);
          strokePointsRef.current = [];
        }
        return;
      }

      // Finish accent zone drawing
      if (isDrawingZoneRef.current) {
        isDrawingZoneRef.current = false;
        setZoneDragEnd(null);
        const endPoint = getImageCoords(e);
        const zone: AccentZone = {
          topLeft: {
            x: Math.min(zoneStartRef.current.x, endPoint.x),
            y: Math.min(zoneStartRef.current.y, endPoint.y),
          },
          bottomRight: {
            x: Math.max(zoneStartRef.current.x, endPoint.x),
            y: Math.max(zoneStartRef.current.y, endPoint.y),
          },
        };
        if (
          zone.bottomRight.x - zone.topLeft.x > 10 &&
          zone.bottomRight.y - zone.topLeft.y > 10
        ) {
          onAccentZoneDraw?.(zone);
        }
        return;
      }

      // Calibration click
      if (editorMode === 'calibrating') {
        const point = getImageCoords(e);
        onCalibrationClick?.(point);
        return;
      }

      // Regular click — check if clicking on panel for selection, or place new panel
      if (!maskTool) {
        const point = getImageCoords(e);
        const clickedPanel = findPanelAt(point);
        if (clickedPanel) {
          setSelectedPanelId((prev) => (prev === clickedPanel.id ? null : clickedPanel.id));
        } else {
          setSelectedPanelId(null);
          if (placementMode === 'manual') {
            onCanvasClick?.(point.x, point.y);
          }
        }
      }
    },
    [maskTool, onCanvasClick, onMaskStroke, getImageCoords, findPanelAt, onAccentZoneDraw, placementMode, editorMode, onCalibrationClick],
  );

  const handleMouseLeave = useCallback(() => {
    onHoverChange?.(null);
  }, [onHoverChange]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.25, Math.min(4, zoom + delta));
      onZoomChange?.(newZoom);
    },
    [zoom, onZoomChange],
  );

  // ─── Touch handlers (pinch-to-zoom, touch pan, touch paint) ─────────
  const lastTouchDistRef = useRef(0);
  const lastTouchCenterRef = useRef<Point>({ x: 0, y: 0 });

  const getTouchImageCoords = useCallback(
    (touch: React.Touch): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch start
        lastTouchDistRef.current = touchDist(e.touches[0], e.touches[1]);
        lastTouchCenterRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        return;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (maskTool) {
          isPaintingRef.current = true;
          strokePointsRef.current = [getTouchImageCoords(touch)];
        } else {
          // Single touch → pan
          isPanningRef.current = true;
          lastPanRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    },
    [maskTool, getTouchImageCoords],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch zoom
        const dist = touchDist(e.touches[0], e.touches[1]);
        if (lastTouchDistRef.current > 0) {
          const scale = dist / lastTouchDistRef.current;
          const newZoom = Math.max(0.25, Math.min(4, zoom * scale));
          onZoomChange?.(newZoom);
        }
        lastTouchDistRef.current = dist;

        // Two-finger pan
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dx = cx - lastTouchCenterRef.current.x;
        const dy = cy - lastTouchCenterRef.current.y;
        lastTouchCenterRef.current = { x: cx, y: cy };
        onPanChange?.({ x: panOffset.x + dx, y: panOffset.y + dy });
        return;
      }
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (isPaintingRef.current && maskTool) {
          strokePointsRef.current.push(getTouchImageCoords(touch));
        } else if (isPanningRef.current) {
          const dx = touch.clientX - lastPanRef.current.x;
          const dy = touch.clientY - lastPanRef.current.y;
          lastPanRef.current = { x: touch.clientX, y: touch.clientY };
          onPanChange?.({ x: panOffset.x + dx, y: panOffset.y + dy });
        }
      }
    },
    [zoom, panOffset, onZoomChange, onPanChange, maskTool, getTouchImageCoords],
  );

  const handleTouchEnd = useCallback(
    () => {
      if (isPaintingRef.current && maskTool) {
        isPaintingRef.current = false;
        if (strokePointsRef.current.length > 0) {
          onMaskStroke?.(strokePointsRef.current);
          strokePointsRef.current = [];
        }
      }
      isPanningRef.current = false;
      lastTouchDistRef.current = 0;
    },
    [maskTool, onMaskStroke],
  );

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        background: '#F0F0F0',
        borderRadius: 12,
        cursor: maskTool
          ? 'crosshair'
          : isPanningRef.current
            ? 'grabbing'
            : 'default',
      }}
    >
      <canvas
        ref={canvasRef}
        data-testid="wall-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'block',
          width: displaySize.width,
          height: displaySize.height,
          transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
          transformOrigin: 'center',
          touchAction: 'none',
          margin: '0 auto',
        }}
      />
      {/* Delete button for selected panel */}
      {selectedPanelId && (() => {
        const panel = panels.find((p) => p.id === selectedPanelId);
        if (!panel || !canvasRef.current || !containerRef.current) return null;
        // Compute position relative to the container using both rects
        const containerRect = containerRef.current.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        // Canvas-to-screen scale (includes CSS zoom)
        const scaleX = canvasRect.width / canvasRef.current.width;
        const scaleY = canvasRect.height / canvasRef.current.height;
        // Panel corner in screen coords, offset by canvas position relative to container
        const btnX = (canvasRect.left - containerRect.left) + (panel.x + panel.renderWidth) * scaleX - 12;
        const btnY = (canvasRect.top - containerRect.top) + panel.y * scaleY - 12;
        return (
          <button
            data-testid="panel-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemovePanel?.(selectedPanelId);
              setSelectedPanelId(null);
            }}
            style={{
              position: 'absolute',
              left: btnX,
              top: btnY,
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: '#EF4444',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
              zIndex: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            <CloseCircleFilled />
          </button>
        );
      })()}
    </div>
  );
}
