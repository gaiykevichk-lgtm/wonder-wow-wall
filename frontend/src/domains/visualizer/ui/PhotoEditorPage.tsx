import { useCallback, useEffect, useState } from 'react';
import { Typography, message, Progress, Card } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisualizerStore } from '../model/visualizerStore';
import { useSubscriptionStore } from '../../subscription/model/subscriptionStore';
import { useCartStore } from '../../order/model/cartStore';
import { placedPanelsToCartItems } from '../model/adapters';
import { processUploadedImage } from '../lib/imageProcessing';
import { applyStrokeToMask, createEmptyMask } from '../lib/maskUtils';
import { placeSinglePanel } from '../lib/layoutEngine';
import { BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';
import { products } from '../../catalog/model/data';
import { PhotoUploader } from './PhotoUploader';
import { WallCanvas } from './WallCanvas';
import { MaskToolbar } from './MaskToolbar';
import { PanelPicker } from './PanelPicker';
import { PlacementControls } from './PlacementControls';
import { CostSummary } from './CostSummary';
import type { Point } from '../model/types';

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

  // Init first design
  useEffect(() => {
    if (!store.selectedDesignId && products.length > 0) {
      const first = products[0]!;
      store.setSelectedDesign(first.id, first.name, first.image);
      if (first.colors.length > 0) {
        store.setSelectedColor(first.colors[0]!.hex, first.colors[0]!.name);
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
      store.setScene({
        photo: { url: '', width: 0, height: 0 },
        wallMask: null,
        objectMask: null,
        calibration: null,
        segmentationStatus: 'uploading',
      });

      try {
        const { dataUrl, width, height } = await processUploadedImage(file);

        // Create mock wall mask (full wall for now — ML integration later)
        const wallMask = createEmptyMask(width, height, 255);

        store.setScene({
          photo: { url: dataUrl, width, height, file },
          wallMask,
          objectMask: { obstacles: [] },
          calibration: { method: 'manual', pixelsPerCm: width / 400 },
          segmentationStatus: 'ready',
        });

        message.success('Фото загружено! Разместите панели на стене.');
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Ошибка загрузки';
        message.error(errorMsg);
        store.setSegmentationStatus('error', errorMsg);
      } finally {
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

  // Save project
  const handleSave = useCallback(() => {
    message.info('Сохранение проектов будет доступно после авторизации');
  }, []);

  const { scene } = store;
  const isReady = scene?.segmentationStatus === 'ready';
  const isProcessing =
    scene?.segmentationStatus === 'uploading' ||
    scene?.segmentationStatus === 'processing';

  return (
    <div style={{ padding: '96px 24px 48px', maxWidth: 1440, margin: '0 auto' }}>
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 64,
            }}
          >
            <Progress type="circle" percent={uploading ? 50 : 80} />
            <Text style={{ fontSize: 16 }}>
              {uploading ? 'Загружаем фото...' : 'Распознаём стену...'}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      {isReady && scene && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
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
            style={{ borderRadius: 12, overflow: 'auto', maxHeight: 700 }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <WallCanvas
              scene={scene}
              panels={store.layout.panels}
              maskVisible={store.maskVisible}
              maskOpacity={store.maskOpacity}
              maskTool={editingMask ? store.maskTool : null}
              brushSize={store.brushSize}
              zoom={zoom}
              panOffset={panOffset}
              onCanvasClick={handleCanvasClick}
              onMaskStroke={handleMaskStroke}
              onZoomChange={setZoom}
              onPanChange={setPanOffset}
            />

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

            {/* Toggle mask editing */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setEditingMask(!editingMask)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: `1px solid ${editingMask ? '#4CAF50' : '#E5E7EB'}`,
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
                  store.reset();
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
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
              style={{ borderRadius: 12 }}
            >
              <PlacementControls
                mode={store.layout.placementMode}
                panelCount={store.layout.panels.length}
                onModeChange={store.setPlacementMode}
                onAutoFill={store.autoFill}
                onClearAll={store.clearPanels}
              />
            </Card>

            <CostSummary
              cost={store.cost}
              hasSubscription={hasSubscription()}
              onAddToCart={handleAddToCart}
              onSave={handleSave}
            />
          </div>
        </motion.div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 1024px) {
          [style*="grid-template-columns: 240px 1fr 280px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
