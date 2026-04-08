import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Group } from 'react-konva';
import { CloseCircleFilled } from '@ant-design/icons';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Scene, PlacedPanel, MaskTool, Point, AccentZone, PlacementMode, EditorMode, CalibrationPoints, PerspectiveCorners as PerspectiveCornersType } from '../model/types';
import { wallMaskToImageData } from '../lib/maskUtils';
import { createPerspective, transformRect, quadToFlatPoints, computeBrightnessAdjustment } from '../lib/perspectiveEngine';
import { PerspectiveCorners } from './PerspectiveCorners';

/** Cache of loaded design texture images keyed by URL. */
const konvaDesignImageCache = new Map<string, HTMLImageElement>();

interface KonvaCanvasProps {
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
  onPanelMove?: (id: string, x: number, y: number) => void;
  onHoverChange?: (point: Point | null) => void;
  onAccentZoneDraw?: (zone: AccentZone) => void;
  editorMode?: EditorMode;
  calibrationPoints?: CalibrationPoints;
  onCalibrationClick?: (point: Point) => void;
  perspectiveCorners?: PerspectiveCornersType | null;
  onPerspectiveCornersChange?: (corners: PerspectiveCornersType) => void;
  wallBrightness?: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

/** Convert WallMask → offscreen canvas for Konva Image rendering (full opacity). */
function maskToCanvas(
  mask: { data: Uint8Array; width: number; height: number },
): HTMLCanvasElement {
  const imageData = wallMaskToImageData(mask, [76, 175, 80], 1);
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function KonvaCanvas({
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
  onPanelMove,
  onHoverChange,
  onAccentZoneDraw,
  editorMode = 'default',
  calibrationPoints,
  onCalibrationClick,
  perspectiveCorners,
  onPerspectiveCornersChange,
  wallBrightness = 128,
}: KonvaCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });

  // Painting state
  const isPaintingRef = useRef(false);
  const strokePointsRef = useRef<Point[]>([]);

  // Accent zone state
  const isDrawingZoneRef = useRef(false);
  const zoneStartRef = useRef<Point>({ x: 0, y: 0 });
  const [zoneDragEnd, setZoneDragEnd] = useState<Point | null>(null);

  // Pinch state
  const lastTouchDistRef = useRef(0);

  // ─── Resize observer ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]!.contentRect;
      if (width > 0 && height > 0) {
        setStageSize({ width, height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─── Load photo ─────────────────────────────────────────────────────
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setPhotoImage(img);
    img.src = scene.photo.url;
  }, [scene.photo.url]);

  // ─── Load design images for panels ──────────────────────────────────
  const [panelImages, setPanelImages] = useState<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    const urls = new Set(panels.map((p) => p.designImage).filter(Boolean));
    let updated = false;
    for (const url of urls) {
      if (konvaDesignImageCache.has(url)) continue;
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        konvaDesignImageCache.set(url, img);
        setPanelImages(new Map(konvaDesignImageCache));
      };
      img.src = url;
      updated = true;
    }
    if (!updated && konvaDesignImageCache.size > 0) {
      setPanelImages(new Map(konvaDesignImageCache));
    }
  }, [panels]);

  // ─── Mask canvas (offscreen) ────────────────────────────────────────
  const maskCanvas = useMemo(() => {
    if (!scene.wallMask) return null;
    return maskToCanvas(scene.wallMask);
  }, [scene.wallMask]);

  // ─── Compute scale to fit photo in stage ────────────────────────────
  const fitScale = useMemo(() => {
    if (!photoImage) return 1;
    const sx = stageSize.width / scene.photo.width;
    const sy = stageSize.height / scene.photo.height;
    return Math.min(sx, sy, 1);
  }, [photoImage, stageSize, scene.photo.width, scene.photo.height]);

  // ─── Get image coords from stage pointer position ───────────────────
  const getImageCoords = useCallback(
    (stage: Konva.Stage): Point => {
      const pos = stage.getPointerPosition();
      if (!pos) return { x: 0, y: 0 };
      const scale = fitScale * zoom;
      return {
        x: (pos.x - panOffset.x) / scale,
        y: (pos.y - panOffset.y) / scale,
      };
    },
    [fitScale, zoom, panOffset],
  );

  // ─── Snap to grid for hover ─────────────────────────────────────────
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

  // ─── Stage event handlers ───────────────────────────────────────────

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
      onZoomChange?.(newZoom);
    },
    [zoom, onZoomChange],
  );

  const handleStageMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // Mask painting
      if (maskTool) {
        isPaintingRef.current = true;
        const point = getImageCoords(stage);
        strokePointsRef.current = [point];
        return;
      }

      // Accent zone drawing
      if (placementMode === 'accent') {
        const point = getImageCoords(stage);
        isDrawingZoneRef.current = true;
        zoneStartRef.current = point;
        return;
      }
    },
    [maskTool, placementMode, getImageCoords],
  );

  const handleStageMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      const point = getImageCoords(stage);

      // Update brush cursor position when mask tool is active
      if (maskTool) {
        setCursorPos(point);
      }

      // Mask painting
      if (isPaintingRef.current && maskTool) {
        strokePointsRef.current.push(point);
        return;
      }

      // Accent zone preview
      if (isDrawingZoneRef.current) {
        setZoneDragEnd(point);
        return;
      }

      // Hover highlight in manual mode
      if (placementMode === 'manual' && !maskTool) {
        const snapped = snapToGrid(point);
        onHoverChange?.(snapped);
      }
    },
    [maskTool, placementMode, getImageCoords, snapToGrid, onHoverChange],
  );

  const handleStageMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;

      // Finish mask painting
      if (isPaintingRef.current && maskTool) {
        isPaintingRef.current = false;
        if (strokePointsRef.current.length > 0) {
          onMaskStroke?.(strokePointsRef.current);
          strokePointsRef.current = [];
        }
        return;
      }

      // Finish accent zone
      if (isDrawingZoneRef.current) {
        isDrawingZoneRef.current = false;
        setZoneDragEnd(null);
        const endPoint = getImageCoords(stage);
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
        if (zone.bottomRight.x - zone.topLeft.x > 10 && zone.bottomRight.y - zone.topLeft.y > 10) {
          onAccentZoneDraw?.(zone);
        }
        return;
      }

      // Calibration click
      if (editorMode === 'calibrating') {
        const point = getImageCoords(stage);
        onCalibrationClick?.(point);
        return;
      }

      // Click on empty stage → deselect; place panel only in manual mode
      if (!maskTool && e.target === stage) {
        const point = getImageCoords(stage);
        setSelectedPanelId(null);
        if (placementMode === 'manual') {
          onCanvasClick?.(point.x, point.y);
        }
      }
    },
    [maskTool, placementMode, editorMode, onMaskStroke, onCanvasClick, getImageCoords, onAccentZoneDraw, onCalibrationClick],
  );

  const handleStageMouseLeave = useCallback(() => {
    onHoverChange?.(null);
  }, [onHoverChange]);

  // ─── Touch handlers ─────────────────────────────────────────────────

  const handleTouchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches;
      if (touches.length === 2) {
        lastTouchDistRef.current = Math.hypot(
          touches[0]!.clientX - touches[1]!.clientX,
          touches[0]!.clientY - touches[1]!.clientY,
        );
        return;
      }
      if (touches.length === 1 && maskTool) {
        const stage = e.target.getStage();
        if (!stage) return;
        isPaintingRef.current = true;
        strokePointsRef.current = [getImageCoords(stage)];
      }
    },
    [maskTool, getImageCoords],
  );

  const handleTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      e.evt.preventDefault();
      const touches = e.evt.touches;
      if (touches.length === 2 && lastTouchDistRef.current > 0) {
        const dist = Math.hypot(
          touches[0]!.clientX - touches[1]!.clientX,
          touches[0]!.clientY - touches[1]!.clientY,
        );
        const scale = dist / lastTouchDistRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));
        onZoomChange?.(newZoom);
        lastTouchDistRef.current = dist;
        return;
      }
      if (touches.length === 1 && isPaintingRef.current && maskTool) {
        const stage = e.target.getStage();
        if (!stage) return;
        strokePointsRef.current.push(getImageCoords(stage));
      }
    },
    [zoom, onZoomChange, maskTool, getImageCoords],
  );

  const handleTouchEnd = useCallback(() => {
    if (isPaintingRef.current && maskTool) {
      isPaintingRef.current = false;
      if (strokePointsRef.current.length > 0) {
        onMaskStroke?.(strokePointsRef.current);
        strokePointsRef.current = [];
      }
    }
    lastTouchDistRef.current = 0;
  }, [maskTool, onMaskStroke]);

  // ─── Panel handlers ─────────────────────────────────────────────────

  const handlePanelClick = useCallback((panelId: string) => {
    setSelectedPanelId((prev) => (prev === panelId ? null : panelId));
  }, []);

  const handlePanelDragEnd = useCallback(
    (panelId: string, e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      // Node position is in image-coordinate space (Stage handles scale transform)
      const newX = node.x();
      const newY = node.y();
      onPanelMove?.(panelId, newX, newY);
    },
    [onPanelMove],
  );

  // ─── Stage drag (pan) ───────────────────────────────────────────────

  const handleStageDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const stage = e.target;
      if (stage !== stageRef.current) return;
      onPanChange?.({ x: stage.x(), y: stage.y() });
    },
    [onPanChange],
  );

  // ─── Cursor ─────────────────────────────────────────────────────────

  const cursor = maskTool
    ? 'crosshair'
    : editorMode === 'calibrating'
      ? 'crosshair'
      : placementMode === 'accent'
        ? 'crosshair'
        : 'default';

  // ─── Accent zone rect ──────────────────────────────────────────────

  const accentZoneRect = useMemo(() => {
    if (!zoneDragEnd || !isDrawingZoneRef.current) return null;
    const start = zoneStartRef.current;
    return {
      x: Math.min(start.x, zoneDragEnd.x),
      y: Math.min(start.y, zoneDragEnd.y),
      width: Math.abs(zoneDragEnd.x - start.x),
      height: Math.abs(zoneDragEnd.y - start.y),
    };
  }, [zoneDragEnd]);

  // ─── Perspective transform ──────────────────────────────────────────
  const perspectiveTransform = useMemo(() => {
    if (!perspectiveCorners) return null;
    return createPerspective(perspectiveCorners, {
      w: scene.photo.width,
      h: scene.photo.height,
    });
  }, [perspectiveCorners, scene.photo.width, scene.photo.height]);

  const brightnessAdj = useMemo(
    () => computeBrightnessAdjustment(wallBrightness),
    [wallBrightness],
  );

  const scale = fitScale * zoom;
  const isPanMode = !maskTool && placementMode !== 'accent' && editorMode === 'default';

  return (
    <div
      ref={containerRef}
      data-testid="konva-canvas-container"
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        background: '#F0F0F0',
        borderRadius: 12,
        cursor,
        minHeight: 400,
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        x={panOffset.x}
        y={panOffset.y}
        draggable={isPanMode}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDragEnd={handleStageDragEnd}
        style={{ touchAction: 'none' }}
      >
        {/* Layer 1: Photo */}
        <Layer>
          {photoImage && (
            <KonvaImage
              image={photoImage}
              width={scene.photo.width}
              height={scene.photo.height}
            />
          )}
        </Layer>

        {/* Layer 2: Mask overlay */}
        <Layer visible={maskVisible}>
          {maskCanvas && (
            <KonvaImage
              image={maskCanvas}
              width={scene.photo.width}
              height={scene.photo.height}
              opacity={maskOpacity}
            />
          )}
        </Layer>

        {/* Layer 3: UI overlays (hover cell, accent zone) */}
        <Layer>
          {/* Hover cell highlight (manual mode) */}
          {hoverCell && cellSizePx && placementMode === 'manual' && !maskTool && (
            <Rect
              x={hoverCell.x}
              y={hoverCell.y}
              width={cellSizePx.w}
              height={cellSizePx.h}
              fill="rgba(76, 175, 80, 0.18)"
              stroke="rgba(76, 175, 80, 0.5)"
              strokeWidth={2 / scale}
              dash={[6 / scale, 4 / scale]}
            />
          )}

          {/* Accent zone preview */}
          {accentZoneRect && (
            <Rect
              x={accentZoneRect.x}
              y={accentZoneRect.y}
              width={accentZoneRect.width}
              height={accentZoneRect.height}
              fill="rgba(76, 175, 80, 0.08)"
              stroke="#4CAF50"
              strokeWidth={2 / scale}
              dash={[8 / scale, 4 / scale]}
            />
          )}
        </Layer>

        {/* Layer 4: Panels */}
        <Layer>
          {panels.map((panel) => {
            const isSelected = panel.id === selectedPanelId;
            const isHovered = panel.id === hoveredPanelId;
            const strokeColor = isSelected || isHovered ? '#4CAF50' : '#E5E7EB';
            const strokeW = (isSelected ? 3 : isHovered ? 2 : 1) / scale;
            const shadowCol = isSelected || isHovered ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.04)';
            const shadowB = (isSelected || isHovered ? 12 : 3) / scale;
            const shadowOY = (isSelected || isHovered ? 4 : 1) / scale;

            const panelHandlers = {
              onClick: () => handlePanelClick(panel.id),
              onTap: () => handlePanelClick(panel.id),
              onMouseEnter: () => {
                setHoveredPanelId(panel.id);
                const container = containerRef.current;
                if (container) container.style.cursor = 'pointer';
              },
              onMouseLeave: () => {
                setHoveredPanelId(null);
                const container = containerRef.current;
                if (container) container.style.cursor = cursor;
              },
            };

            // With perspective: render as quadrilateral via <Line closed>
            if (perspectiveTransform) {
              const quad = transformRect(perspectiveTransform, {
                x: panel.x,
                y: panel.y,
                width: panel.renderWidth,
                height: panel.renderHeight,
              });
              const flatPts = quadToFlatPoints(quad);
              return (
                <Group key={panel.id}>
                  <Line
                    points={flatPts}
                    closed
                    fill={panel.color || '#CCCCCC'}
                    opacity={0.85 + brightnessAdj}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    shadowColor={shadowCol}
                    shadowBlur={shadowB}
                    shadowOffsetY={shadowOY}
                    {...panelHandlers}
                  />
                </Group>
              );
            }

            // Without perspective: render as Rect (default)
            const designImg = panel.designImage ? panelImages.get(panel.designImage) : null;
            return (
              <Group key={panel.id}>
                {designImg ? (
                  <>
                    <KonvaImage
                      image={designImg}
                      x={panel.x}
                      y={panel.y}
                      width={panel.renderWidth}
                      height={panel.renderHeight}
                      opacity={0.85 + brightnessAdj}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      shadowColor={shadowCol}
                      shadowBlur={shadowB}
                      shadowOffsetY={shadowOY}
                      {...panelHandlers}
                      draggable={placementMode === 'manual' && !maskTool && !perspectiveCorners}
                      onDragEnd={(e) => handlePanelDragEnd(panel.id, e)}
                    />
                    {/* Color tint overlay */}
                    {panel.color && (
                      <Rect
                        x={panel.x}
                        y={panel.y}
                        width={panel.renderWidth}
                        height={panel.renderHeight}
                        fill={panel.color}
                        opacity={0.25}
                        listening={false}
                      />
                    )}
                  </>
                ) : (
                  <Rect
                    x={panel.x}
                    y={panel.y}
                    width={panel.renderWidth}
                    height={panel.renderHeight}
                    fill={panel.color || '#CCCCCC'}
                    opacity={0.85 + brightnessAdj}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    shadowColor={shadowCol}
                    shadowBlur={shadowB}
                    shadowOffsetY={shadowOY}
                    {...panelHandlers}
                    draggable={placementMode === 'manual' && !maskTool && !perspectiveCorners}
                    onDragEnd={(e) => handlePanelDragEnd(panel.id, e)}
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Layer 5: Brush cursor */}
        {maskTool && (
          <Layer listening={false}>
            <Circle
              x={cursorPos.x}
              y={cursorPos.y}
              radius={brushSize}
              stroke={maskTool === 'brush' ? '#4CAF50' : '#EF4444'}
              strokeWidth={2 / scale}
              opacity={0.5}
            />
          </Layer>
        )}

        {/* Layer 6: Calibration points */}
        {editorMode === 'calibrating' && calibrationPoints && (
          <Layer listening={false}>
            {calibrationPoints.start && (
              <Circle
                x={calibrationPoints.start.x}
                y={calibrationPoints.start.y}
                radius={8 / scale}
                fill="#4CAF50"
                stroke="#FFFFFF"
                strokeWidth={2 / scale}
              />
            )}
            {calibrationPoints.end && (
              <Circle
                x={calibrationPoints.end.x}
                y={calibrationPoints.end.y}
                radius={8 / scale}
                fill="#4CAF50"
                stroke="#FFFFFF"
                strokeWidth={2 / scale}
              />
            )}
            {calibrationPoints.start && calibrationPoints.end && (
              <Line
                points={[
                  calibrationPoints.start.x, calibrationPoints.start.y,
                  calibrationPoints.end.x, calibrationPoints.end.y,
                ]}
                stroke="#4CAF50"
                strokeWidth={2 / scale}
                dash={[4 / scale, 4 / scale]}
              />
            )}
          </Layer>
        )}

        {/* Layer 7: Perspective corners */}
        {editorMode === 'perspective' && perspectiveCorners && onPerspectiveCornersChange && (
          <Layer>
            <PerspectiveCorners
              corners={perspectiveCorners}
              scale={scale}
              onCornersChange={onPerspectiveCornersChange}
            />
          </Layer>
        )}
      </Stage>

      {/* HTML delete button overlay (more accessible than Konva circle) */}
      {selectedPanelId && (() => {
        const panel = panels.find((p) => p.id === selectedPanelId);
        if (!panel || !stageRef.current) return null;
        const btnX = (panel.x + panel.renderWidth) * scale + panOffset.x - 12;
        const btnY = panel.y * scale + panOffset.y - 12;
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
