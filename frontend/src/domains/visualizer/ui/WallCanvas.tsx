import { useRef, useEffect, useCallback, useState } from 'react';
import type { Scene, PlacedPanel, MaskTool, Point } from '../model/types';
import { wallMaskToImageData } from '../lib/maskUtils';

interface WallCanvasProps {
  scene: Scene;
  panels: PlacedPanel[];
  maskVisible: boolean;
  maskOpacity: number;
  maskTool: MaskTool | null;
  brushSize: number;
  zoom: number;
  panOffset: Point;
  onCanvasClick?: (x: number, y: number) => void;
  onMaskStroke?: (points: Point[]) => void;
  onPanChange?: (offset: Point) => void;
  onZoomChange?: (zoom: number) => void;
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
  onCanvasClick,
  onMaskStroke,
  onPanChange,
  onZoomChange,
}: WallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const strokePointsRef = useRef<Point[]>([]);
  const isPaintingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef<Point>({ x: 0, y: 0 });

  // Load photo image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = scene.photo.url;
  }, [scene.photo.url]);

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

    // Draw panels
    for (const panel of panels) {
      ctx.fillStyle = panel.color || '#CCCCCC';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(panel.x, panel.y, panel.renderWidth, panel.renderHeight);

      // Panel border
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(panel.x, panel.y, panel.renderWidth, panel.renderHeight);

      // Design label
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(
        panel.designName.slice(0, 15),
        panel.x + 4,
        panel.y + panel.renderHeight - 4,
      );
    }

    ctx.restore();
  }, [scene, panels, maskVisible, maskOpacity, imageLoaded]);

  useEffect(() => {
    render();
  }, [render]);

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        // Middle click or Alt+click → pan
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (maskTool) {
        isPaintingRef.current = true;
        const point = getImageCoords(e);
        strokePointsRef.current = [point];
      }
    },
    [maskTool, getImageCoords],
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
      }
    },
    [maskTool, panOffset, onPanChange, getImageCoords],
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

      // Regular click → place panel
      if (!maskTool) {
        const point = getImageCoords(e);
        onCanvasClick?.(point.x, point.y);
      }
    },
    [maskTool, onCanvasClick, onMaskStroke, getImageCoords],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.25, Math.min(4, zoom + delta));
      onZoomChange?.(newZoom);
    },
    [zoom, onZoomChange],
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
        onWheel={handleWheel}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
          transformOrigin: 'center',
        }}
      />
      {/* Brush cursor preview when mask tool is active */}
      {maskTool && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            width: brushSize * 2,
            height: brushSize * 2,
            borderRadius: '50%',
            border: `2px solid ${maskTool === 'brush' ? '#4CAF50' : '#EF4444'}`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
}
