import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Typography, message, Progress, Card, Modal } from 'antd';
import {
  SwapOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { PageMeta } from '../../../shared/ui/PageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualizerStore } from '../model/visualizerStore';
import { useSubscriptionStore } from '../../subscription/model/subscriptionStore';
import { useCartStore } from '../../order/model/cartStore';
import { placedPanelsToCartItems } from '../model/adapters';
import { processUploadedImage } from '../lib/imageProcessing';
import { applyStrokeToMask, createEmptyMask } from '../lib/maskUtils';
import { placeSinglePanel } from '../lib/layoutEngine';
import { segmentScene, isSegmentationSupported } from '../lib/segmentationService';
import { BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';
import { products } from '../../catalog/model/data';
import { PhotoUploader } from './PhotoUploader';
import { WallCanvas } from './WallCanvas';
import { KonvaCanvas } from './KonvaCanvas';
import { MaskToolbar } from './MaskToolbar';
import { PanelPicker } from './PanelPicker';
import { PlacementControls } from './PlacementControls';
import { CostSummary } from './CostSummary';
import { CalibrationOverlay } from './CalibrationOverlay';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { OnboardingTooltips } from './OnboardingTooltips';
import { useSearchParams } from 'react-router-dom';
import { computeWallBrightness } from '../lib/perspectiveEngine';
import type { Point, AccentZone, PerspectiveCorners } from '../model/types';

const { Title, Text } = Typography;

export default function PhotoEditorPage() {
  const store = useVisualizerStore();
  const hasSubscription = useSubscriptionStore((s) => s.hasSubscription);
  const addCartItem = useCartStore((s) => s.addItem);
  const setCartOpen = useCartStore((s) => s.setOpen);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [editingMask, setEditingMask] = useState(false);
  const [hoverCell, setHoverCell] = useState<Point | null>(null);
  const [beforeAfterOpen, setBeforeAfterOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [searchParams] = useSearchParams();

  // Zustand persist auto-rehydrates from localStorage on mount — no manual load needed

  // Init design from URL param or first product
  useEffect(() => {
    if (!store.selectedDesignId && products.length > 0) {
      const designIdParam = searchParams.get('designId');
      const target = (designIdParam && products.find((p) => p.id === designIdParam)) || products[0]!;
      store.setSelectedDesign(target.id, target.name, target.image);
      if (target.colors.length > 0) {
        store.setSelectedColor(target.colors[0]!.hex, target.colors[0]!.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalculate cost on panel changes
  useEffect(() => {
    store.recalculateCost(hasSubscription());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.layout.panels, hasSubscription]);

  // Handle photo upload
  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      store.setSegmentationProgress(0);
      store.setScene({
        photo: { url: '', width: 0, height: 0 },
        wallMask: null,
        objectMask: null,
        calibration: null,
        segmentationStatus: 'uploading',
      });

      try {
        const { dataUrl, width, height } = await processUploadedImage(file);
        const photo = { url: dataUrl, width, height, file };
        const calibration = { method: 'manual' as const, pixelsPerCm: width / 400 };

        const setReadyScene = (wallMask: import('../model/types').WallMask, obstacles: import('../model/types').Obstacle[] = []) => {
          store.setScene({
            photo,
            wallMask,
            objectMask: { obstacles },
            calibration,
            segmentationStatus: 'ready',
          });
        };

        store.setScene({ photo, wallMask: null, objectMask: null, calibration, segmentationStatus: 'loading-model' });
        setUploading(false);

        // Try ML segmentation if supported
        if (isSegmentationSupported()) {
          try {
            const result = await segmentScene(dataUrl, width, height, (p) => {
              store.setSegmentationStatus(p.status);
              store.setSegmentationProgress(p.percent);
            });

            setReadyScene(result.wallMask, result.obstacles);

            const obstacleMsg = result.obstacles.length > 0
              ? ` Обнаружено объектов: ${result.obstacles.length}.`
              : '';
            message.success(`Стена распознана!${obstacleMsg} Разместите панели.`);
          } catch {
            // ML failed — fallback to full mask (user corrects with brush)
            setReadyScene(createEmptyMask(width, height, 255));
            message.info('Не удалось распознать стену автоматически. Отметьте стену кистью.');
          }
        } else {
          // WASM not supported — fallback to full mask
          setReadyScene(createEmptyMask(width, height, 255));
          message.info('Автоматическое распознавание не поддерживается в этом браузере. Отметьте стену кистью.');
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Ошибка загрузки';
        message.error(errorMsg);
        store.setSegmentationStatus('error', errorMsg);
        setUploading(false);
      }
    },
    [store],
  );

  // Handle canvas click → place panel (manual mode)
  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      const { scene, layout, selectedSizeKey, selectedDesignId, selectedDesignName, selectedDesignImage, selectedColor, selectedColorName } = store;
      if (!scene?.wallMask || !selectedDesignId || layout.placementMode !== 'manual') return;

      const panel = placeSinglePanel(
        scene.wallMask,
        x,
        y,
        selectedSizeKey,
        scene.calibration,
        layout.panels,
        { id: selectedDesignId, name: selectedDesignName, image: selectedDesignImage },
        selectedColor,
        selectedColorName,
        scene.objectMask?.obstacles,
      );

      if (panel) {
        store.addPanel(panel);
      } else {
        message.warning('Нельзя разместить панель здесь');
      }
    },
    [store],
  );

  // Handle mask stroke
  const handleMaskStroke = useCallback(
    (points: Point[]) => {
      const { scene, maskTool, brushSize } = store;
      if (!scene?.wallMask) return;

      store.pushUndo(scene.wallMask);
      const newMask = applyStrokeToMask(scene.wallMask, points, brushSize, maskTool);
      store.updateWallMask(newMask);
    },
    [store],
  );

  // Add to cart
  const handleAddToCart = useCallback(() => {
    const items = placedPanelsToCartItems(
      store.layout.panels,
      BASE_PANEL_PRICES,
      DESIGN_OVERLAY_PRICE,
      hasSubscription(),
    );

    for (const item of items) {
      addCartItem(item);
    }

    setCartOpen(true);
    message.success(`Добавлено ${items.length} позиций в корзину`);
  }, [store.layout.panels, hasSubscription, addCartItem, setCartOpen]);

  // Remove panel
  const handleRemovePanel = useCallback(
    (id: string) => {
      store.removePanel(id);
    },
    [store],
  );

  // Accent zone drawn
  const handleAccentZoneDraw = useCallback(
    (zone: AccentZone) => {
      store.setAccentZone(zone);
    },
    [store],
  );

  // Calibration click — set start then end point
  const handleCalibrationClick = useCallback(
    (point: Point) => {
      if (!store.calibrationPoints.start) {
        store.setCalibrationPoint('start', point);
      } else if (!store.calibrationPoints.end) {
        store.setCalibrationPoint('end', point);
      } else {
        // Reset and start over
        store.resetCalibration();
        store.setCalibrationPoint('start', point);
      }
    },
    [store],
  );

  // Init default perspective corners from photo dimensions
  const handleTogglePerspective = useCallback(() => {
    if (store.editorMode === 'perspective') {
      store.setEditorMode('default');
      return;
    }
    if (!store.scene) return;
    // If no corners yet, init to slight inset of photo bounds
    if (!store.perspectiveCorners) {
      const w = store.scene.photo.width;
      const h = store.scene.photo.height;
      const inset = 0.05;
      const corners: PerspectiveCorners = [
        { x: w * inset, y: h * inset },
        { x: w * (1 - inset), y: h * inset },
        { x: w * (1 - inset), y: h * (1 - inset) },
        { x: w * inset, y: h * (1 - inset) },
      ];
      store.setPerspectiveCorners(corners);
    }
    store.setEditorMode('perspective');
  }, [store]);

  // Compute wall brightness when scene is ready
  useEffect(() => {
    const s = store.scene;
    if (!s?.wallMask || !s.photo.url || s.segmentationStatus !== 'ready') return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const brightness = computeWallBrightness(imageData, s.wallMask!);
      store.setWallBrightness(brightness);
    };
    img.src = s.photo.url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.scene?.wallMask, store.scene?.photo.url]);

  // Save project (API if auth'd, otherwise just confirm localStorage persist)
  const handleSave = useCallback(async () => {
    const payload = store.getProjectPayload();
    if (!payload) {
      message.warning('Нечего сохранять');
      return;
    }
    // For now, persist middleware handles localStorage auto-save.
    // When auth is available, this will call the API.
    message.success('Проект сохранён');
  }, [store]);

  // Export canvas as JPEG
  const handleExport = useCallback(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>('[data-testid="konva-canvas-container"] canvas') ??
      document.querySelector<HTMLCanvasElement>('[data-testid="wall-canvas"]');
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wow-wall-visualizer-${Date.now()}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        message.success('Изображение сохранено');
      },
      'image/jpeg',
      0.92,
    );
  }, []);

  // Before/After modal
  const handleBeforeAfter = useCallback(() => {
    if (!store.scene || store.layout.panels.length === 0) {
      message.warning('Сначала разместите панели на стене');
      return;
    }
    setBeforeAfterOpen(true);
  }, [store]);

  const [afterCanvasEl, setAfterCanvasEl] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!beforeAfterOpen) {
      setAfterCanvasEl(null);
      return;
    }
    const el =
      document.querySelector<HTMLCanvasElement>(
        '[data-testid="konva-canvas-container"] canvas',
      ) ??
      document.querySelector<HTMLCanvasElement>('[data-testid="wall-canvas"]');
    setAfterCanvasEl(el);
  }, [beforeAfterOpen]);

  // Fullscreen toggle — with fallback for sandboxed iframes
  const handleFullscreen = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      // Check if fullscreen API is available (may be blocked in sandboxed iframes)
      if (!document.fullscreenEnabled) {
        // Fallback: maximize the container visually via CSS
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.zIndex = '9999';
        container.style.background = '#000';
        setIsFullscreen(true);
        return;
      }
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        // Fallback on rejection too
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.zIndex = '9999';
        container.style.background = '#000';
        setIsFullscreen(true);
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    } else {
      // Exit CSS-fallback fullscreen
      container.style.position = '';
      container.style.inset = '';
      container.style.zIndex = '';
      container.style.background = '';
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen change (e.g. Esc key) and Escape for CSS fallback
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        const container = canvasContainerRef.current;
        if (container) {
          container.style.position = '';
          container.style.inset = '';
          container.style.zIndex = '';
          container.style.background = '';
        }
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [isFullscreen]);

  // Compute cell size in pixels for hover highlight
  const cellSizePx = useMemo(() => {
    if (!store.scene?.calibration) return null;
    const pxPerCm = store.scene.calibration.pixelsPerCm;
    const sizeKey = store.selectedSizeKey; // e.g. '30x30'
    const [wStr, hStr] = sizeKey.split('x');
    const wCm = Number(wStr);
    const hCm = Number(hStr);
    if (!wCm || !hCm) return null;
    return { w: wCm * pxPerCm, h: hCm * pxPerCm };
  }, [store.scene?.calibration, store.selectedSizeKey]);

  const useKonva = searchParams.get('canvas') === 'konva';

  const { scene, segmentationProgress } = store;
  const isReady = scene?.segmentationStatus === 'ready';
  const isProcessing =
    scene?.segmentationStatus === 'uploading' ||
    scene?.segmentationStatus === 'loading-model' ||
    scene?.segmentationStatus === 'segmenting' ||
    scene?.segmentationStatus === 'processing';

  const segmentationStatusText = (() => {
    switch (scene?.segmentationStatus) {
      case 'uploading': return 'Загружаем фото...';
      case 'loading-model': return 'Загружаем модель распознавания...';
      case 'segmenting': return 'Распознаём стену...';
      case 'processing': return 'Обрабатываем...';
      default: return '';
    }
  })();

  return (
    <div style={{ padding: '96px 24px 48px', maxWidth: 1440, margin: '0 auto' }}>
      <PageMeta title="Фото-редактор" />
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Фото-редактор стен
        </Title>
        <Text type="secondary">
          Загрузите фото стены и разместите панели Wonder Wow Wall
        </Text>
      </div>

      {/* Upload state */}
      {!scene && <PhotoUploader onUpload={handleUpload} loading={uploading} />}

      {/* Processing */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ease: [0.25, 0.1, 0.25, 1.0] }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 64,
            }}
          >
            <Progress
              type="circle"
              percent={scene?.segmentationStatus === 'uploading' ? 50 : segmentationProgress}
              strokeColor="#4CAF50"
            />
            <Text style={{ fontSize: 15, fontWeight: 400, color: '#6B7280' }}>
              {segmentationStatusText}
            </Text>
            {scene?.segmentationStatus === 'loading-model' && (
              <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
                Первая загрузка ~15 МБ. При повторных визитах — мгновенно.
              </Text>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      {isReady && scene && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
          className="visualizer-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: '240px 1fr 280px',
            gap: 16,
            minHeight: 600,
          }}
        >
          {/* Left: Design picker */}
          <Card
            size="small"
            title="Дизайн"
            style={{ borderRadius: 16, overflow: 'auto', maxHeight: 700 }}
          >
            <PanelPicker
              selectedDesignId={store.selectedDesignId}
              selectedSizeKey={store.selectedSizeKey}
              selectedColor={store.selectedColor}
              onDesignSelect={(id, name, image) => {
                store.setSelectedDesign(id, name, image);
                const product = products.find((p) => p.id === id);
                if (product?.colors[0]) {
                  store.setSelectedColor(
                    product.colors[0].hex,
                    product.colors[0].name,
                  );
                }
              }}
              onSizeSelect={store.setSelectedSize}
              onColorSelect={store.setSelectedColor}
            />
          </Card>

          {/* Center: Canvas + Mask toolbar */}
          <div ref={canvasContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: isFullscreen ? '#000' : undefined }}>
            {useKonva ? (
              <KonvaCanvas
                scene={scene}
                panels={store.layout.panels}
                maskVisible={store.maskVisible}
                maskOpacity={store.maskOpacity}
                maskTool={editingMask ? store.maskTool : null}
                brushSize={store.brushSize}
                zoom={zoom}
                panOffset={panOffset}
                placementMode={store.layout.placementMode}
                hoverCell={hoverCell}
                cellSizePx={cellSizePx}
                onCanvasClick={handleCanvasClick}
                onMaskStroke={handleMaskStroke}
                onZoomChange={setZoom}
                onPanChange={setPanOffset}
                onRemovePanel={handleRemovePanel}
                onPanelMove={store.movePanel}
                onHoverChange={setHoverCell}
                onAccentZoneDraw={handleAccentZoneDraw}
                editorMode={store.editorMode}
                calibrationPoints={store.calibrationPoints}
                onCalibrationClick={handleCalibrationClick}
                perspectiveCorners={store.perspectiveCorners}
                onPerspectiveCornersChange={store.setPerspectiveCorners}
                wallBrightness={store.wallBrightness}
              />
            ) : (
              <WallCanvas
                scene={scene}
                panels={store.layout.panels}
                maskVisible={store.maskVisible}
                maskOpacity={store.maskOpacity}
                maskTool={editingMask ? store.maskTool : null}
                brushSize={store.brushSize}
                zoom={zoom}
                panOffset={panOffset}
                placementMode={store.layout.placementMode}
                hoverCell={hoverCell}
                cellSizePx={cellSizePx}
                onCanvasClick={handleCanvasClick}
                onMaskStroke={handleMaskStroke}
                onZoomChange={setZoom}
                onPanChange={setPanOffset}
                onRemovePanel={handleRemovePanel}
                onHoverChange={setHoverCell}
                onAccentZoneDraw={handleAccentZoneDraw}
                editorMode={store.editorMode}
                onCalibrationClick={handleCalibrationClick}
              />
            )}

            {/* Mask toolbar */}
            {editingMask && (
              <MaskToolbar
                activeTool={store.maskTool}
                brushSize={store.brushSize}
                maskVisible={store.maskVisible}
                maskOpacity={store.maskOpacity}
                canUndo={store.undoStack.length > 0}
                onToolChange={store.setMaskTool}
                onBrushSizeChange={store.setBrushSize}
                onToggleMask={store.toggleMaskVisible}
                onOpacityChange={store.setMaskOpacity}
                onUndo={store.undo}
              />
            )}

            {/* Calibration overlay */}
            {store.editorMode === 'calibrating' && (
              <CalibrationOverlay
                points={store.calibrationPoints}
                onReferenceChange={store.setCalibrationReference}
                onApply={() => {
                  const ok = store.applyCalibration();
                  if (ok) {
                    message.success('Масштаб откалиброван');
                  } else {
                    message.warning('Точки слишком близко — отметьте объект заново');
                  }
                }}
                onCancel={() => {
                  store.resetCalibration();
                  store.setEditorMode('default');
                }}
              />
            )}

            {/* Toolbar buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                data-testid="mask-toolbar-trigger"
                onClick={() => setEditingMask(!editingMask)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: `1px solid ${editingMask ? '#4CAF50' : 'rgba(0,0,0,0.04)'}`,
                  background: editingMask ? 'rgba(76,175,80,0.08)' : '#FFF',
                  color: editingMask ? '#4CAF50' : '#6B7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {editingMask ? 'Завершить коррекцию' : 'Корректировать маску'}
              </button>
              <button
                onClick={() => {
                  if (store.editorMode === 'calibrating') {
                    store.resetCalibration();
                    store.setEditorMode('default');
                  } else {
                    store.setEditorMode('calibrating');
                    setEditingMask(false);
                  }
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: `1px solid ${store.editorMode === 'calibrating' ? '#4CAF50' : 'rgba(0,0,0,0.04)'}`,
                  background: store.editorMode === 'calibrating' ? 'rgba(76,175,80,0.08)' : '#FFF',
                  color: store.editorMode === 'calibrating' ? '#4CAF50' : '#6B7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Калибровать
              </button>
              {useKonva && (
                <button
                  onClick={() => {
                    handleTogglePerspective();
                    setEditingMask(false);
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: `1px solid ${store.editorMode === 'perspective' ? '#4CAF50' : 'rgba(0,0,0,0.04)'}`,
                    background: store.editorMode === 'perspective' ? 'rgba(76,175,80,0.08)' : '#FFF',
                    color: store.editorMode === 'perspective' ? '#4CAF50' : '#6B7280',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Перспектива
                </button>
              )}
              <button
                onClick={handleBeforeAfter}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.04)',
                  background: '#FFF',
                  color: '#6B7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <SwapOutlined /> До / После
              </button>
              <button
                onClick={handleFullscreen}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.04)',
                  background: '#FFF',
                  color: '#6B7280',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                {isFullscreen ? 'Выйти' : 'Полный экран'}
              </button>
              <button
                onClick={() => {
                  store.reset();
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.04)',
                  background: '#FFF',
                  color: '#6B7280',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Загрузить другое фото
              </button>
            </div>
          </div>

          {/* Right: Controls + Cost */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card
              size="small"
              title="Размещение"
              style={{ borderRadius: 16 }}
            >
              <PlacementControls
                mode={store.layout.placementMode}
                panelCount={store.layout.panels.length}
                onModeChange={store.setPlacementMode}
                onAutoFill={store.autoFill}
                onClearAll={store.clearPanels}
              />
            </Card>

            {/* Empty state when no panels placed */}
            {store.layout.panels.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px 16px',
                  gap: 8,
                }}
              >
                <PictureOutlined style={{ fontSize: 48, color: '#E5E7EB' }} />
                <span style={{ fontSize: 15, color: '#9CA3AF', textAlign: 'center' }}>
                  Выберите дизайн и разместите панели
                </span>
              </div>
            )}

            <CostSummary
              cost={store.cost}
              hasSubscription={hasSubscription()}
              onAddToCart={handleAddToCart}
              onSave={handleSave}
              onExport={handleExport}
            />
          </div>
        </motion.div>
      )}

      {/* Before/After comparison modal */}
      <Modal
        open={beforeAfterOpen}
        onCancel={() => setBeforeAfterOpen(false)}
        footer={null}
        width={900}
        centered
        destroyOnClose
        styles={{ content: { borderRadius: 16, padding: 0, overflow: 'hidden' } }}
      >
        {scene && (
          <div style={{ padding: 24 }}>
            <Typography.Title level={4} style={{ margin: '0 0 16px' }}>
              До / После
            </Typography.Title>
            <BeforeAfterSlider
              beforeSrc={scene.photo.url}
              afterCanvas={afterCanvasEl}
              width={850}
              height={scene.photo.width > 0 ? Math.round(850 * (scene.photo.height / scene.photo.width)) : 600}
            />
          </div>
        )}
      </Modal>

      {/* Onboarding tour */}
      <OnboardingTooltips isReady={isReady} />

    </div>
  );
}
