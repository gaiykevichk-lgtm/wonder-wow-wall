import { useState, useRef, useCallback, useMemo } from 'react';
import { Button, Card, Select, Tag, message, Tooltip, Radio, Segmented } from 'antd';
import {
  ShoppingCartOutlined,
  UndoOutlined,
  PlusOutlined,
  DeleteOutlined,
  ColumnWidthOutlined,
  BgColorsOutlined,
  AppstoreOutlined,
  DragOutlined,
  InfoCircleOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { products } from '../../catalog/model/data';
import { PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';
import { useSubscriptionStore } from '../../subscription/model/subscriptionStore';
import { useCartStore } from '../../order/model/cartStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlacedPanel {
  id: string;
  designId: string;
  designName: string;
  designImage: string;
  col: number;
  row: number;
  widthCells: number;
  heightCells: number;
  sizeMm: string;
  color: string;
  colorName: string;
}

type PanelSizeKey = '30x30' | '30x60' | '60x60';

type WallMode = 'grid' | 'interior';

interface InteriorPreset {
  id: string;
  room: string;
  image: string;
  caption: string;
  productName: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CELL_SIZE_MM = 300; // 30 cm grid cell
const CELL_PX = 60; // pixels per cell on screen
const GAP_PX = 2;

const BLUE = '#0071e3';
const DARK = '#1d1d1f';
const GRAY = '#86868b';
const LIGHT_BG = '#F5F5F7';

const EASE_APPLE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

const WALL_COLORS = [
  { label: 'Белая', value: '#F5F5F7' },
  { label: 'Светло-серая', value: '#E8E8E8' },
  { label: 'Бежевая', value: '#F5E6D3' },
  { label: 'Тёмная', value: '#2C2C2C' },
  { label: 'Голубая', value: '#E3F2FD' },
];

const SIZE_OPTIONS: { key: PanelSizeKey; label: string; wCells: number; hCells: number; widthMm: number; heightMm: number }[] = [
  { key: '30x30', label: '30×30 см', wCells: 1, hCells: 1, widthMm: 300, heightMm: 300 },
  { key: '30x60', label: '30×60 см', wCells: 1, hCells: 2, widthMm: 300, heightMm: 600 },
  { key: '60x60', label: '60×60 см', wCells: 2, hCells: 2, widthMm: 600, heightMm: 600 },
];

const FONT = 'Inter, sans-serif';

// ─── Interior Presets ────────────────────────────────────────────────────────

const INTERIOR_PRESETS: InteriorPreset[] = products.flatMap((product) =>
  (product.usageExamples || []).map((ex, idx) => ({
    id: `${product.id}-${idx}`,
    room: ex.room,
    image: ex.image,
    caption: ex.caption,
    productName: product.name,
  }))
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPanelPrice(sizeKey: string): number {
  const baseKey = sizeKey === '30x30' ? '300x300' : sizeKey === '30x60' ? '300x600' : '600x600';
  return (BASE_PANEL_PRICES[baseKey] || 0) + DESIGN_OVERLAY_PRICE;
}

function cellsOverlap(
  a: { col: number; row: number; widthCells: number; heightCells: number },
  b: { col: number; row: number; widthCells: number; heightCells: number }
): boolean {
  return !(
    a.col + a.widthCells <= b.col ||
    b.col + b.widthCells <= a.col ||
    a.row + a.heightCells <= b.row ||
    b.row + b.heightCells <= a.row
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ConstructorPage() {
  // Wall settings
  const [wallCols, setWallCols] = useState(13);
  const [wallRows, setWallRows] = useState(9);
  const [wallColor, setWallColor] = useState(LIGHT_BG);

  // Wall mode & presets
  const [wallMode, setWallMode] = useState<WallMode>('grid');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Panel selection
  const [selectedDesignId, setSelectedDesignId] = useState(products[0].id);
  const [selectedSizeKey, setSelectedSizeKey] = useState<PanelSizeKey>('30x30');
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);

  // Placed panels
  const [placedPanels, setPlacedPanels] = useState<PlacedPanel[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ col: number; row: number } | null>(null);

  const wallRef = useRef<HTMLDivElement>(null);
  const presetScrollRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();
  const hasSub = useSubscriptionStore((s) => s.hasSubscription);
  const activePlan = useSubscriptionStore((s) => s.getActivePlan);
  const openSubModal = useSubscriptionStore((s) => s.openModal);

  const selectedDesign = products.find((p) => p.id === selectedDesignId) || products[0];
  const selectedColor = selectedDesign.colors[selectedColorIdx] || selectedDesign.colors[0];
  const selectedSize = SIZE_OPTIONS.find((s) => s.key === selectedSizeKey)!;
  const selectedPreset = selectedPresetId ? INTERIOR_PRESETS.find((p) => p.id === selectedPresetId) || null : null;

  const wallWidthMm = wallCols * CELL_SIZE_MM;
  const wallHeightMm = wallRows * CELL_SIZE_MM;
  const wallWidthPx = wallCols * (CELL_PX + GAP_PX) + GAP_PX;
  const wallHeightPx = wallRows * (CELL_PX + GAP_PX) + GAP_PX;

  const isInteriorMode = wallMode === 'interior' && selectedPreset !== null;

  // ─── Calculations ──────────────────────────────────────────────────────────

  const isSubscriber = hasSub();

  const costs = useMemo(() => {
    const panelCount = placedPanels.length;
    let totalBase = 0;
    let totalOverlay = 0;

    for (const p of placedPanels) {
      const baseKey = p.sizeMm === '30×30 см' ? '300x300' : p.sizeMm === '30×60 см' ? '300x600' : '600x600';
      totalBase += BASE_PANEL_PRICES[baseKey] || 0;
      totalOverlay += isSubscriber ? 0 : DESIGN_OVERLAY_PRICE;
    }

    const totalArea = placedPanels.reduce((sum, p) => {
      const w = p.widthCells * CELL_SIZE_MM;
      const h = p.heightCells * CELL_SIZE_MM;
      return sum + (w * h) / 1_000_000;
    }, 0);

    const wallArea = (wallWidthMm * wallHeightMm) / 1_000_000;

    return { panelCount, totalBase, totalOverlay, total: totalBase + totalOverlay, totalArea, wallArea };
  }, [placedPanels, wallWidthMm, wallHeightMm, isSubscriber]);

  // ─── Grid occupancy ────────────────────────────────────────────────────────

  const canPlace = useCallback(
    (col: number, row: number, wCells: number, hCells: number, excludeId?: string): boolean => {
      if (col < 0 || row < 0 || col + wCells > wallCols || row + hCells > wallRows) return false;
      for (const p of placedPanels) {
        if (p.id === excludeId) continue;
        if (cellsOverlap({ col, row, widthCells: wCells, heightCells: hCells }, p)) return false;
      }
      return true;
    },
    [placedPanels, wallCols, wallRows]
  );

  // ─── Preset selection ─────────────────────────────────────────────────────

  const handleSelectPreset = useCallback((presetId: string | null) => {
    setSelectedPresetId(presetId);
    if (presetId) {
      setWallMode('interior');
    } else {
      setWallMode('grid');
    }
  }, []);

  const handleModeChange = useCallback((value: string | number) => {
    const mode = value as WallMode;
    setWallMode(mode);
    if (mode === 'grid') {
      setSelectedPresetId(null);
    } else if (mode === 'interior' && !selectedPresetId && INTERIOR_PRESETS.length > 0) {
      setSelectedPresetId(INTERIOR_PRESETS[0].id);
    }
  }, [selectedPresetId]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleAddToWall = useCallback(() => {
    const { wCells, hCells } = selectedSize;
    for (let r = 0; r <= wallRows - hCells; r++) {
      for (let c = 0; c <= wallCols - wCells; c++) {
        if (canPlace(c, r, wCells, hCells)) {
          const panel: PlacedPanel = {
            id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            designId: selectedDesign.id,
            designName: selectedDesign.name,
            designImage: selectedDesign.image,
            col: c,
            row: r,
            widthCells: wCells,
            heightCells: hCells,
            sizeMm: selectedSize.label,
            color: selectedColor.hex,
            colorName: selectedColor.name,
          };
          setPlacedPanels((prev) => [...prev, panel]);
          return;
        }
      }
    }
    message.warning('Нет свободного места на стене для этого размера');
  }, [selectedDesign, selectedColor, selectedSize, wallCols, wallRows, canPlace]);

  const handleClickCell = useCallback(
    (col: number, row: number) => {
      const { wCells, hCells } = selectedSize;
      if (!canPlace(col, row, wCells, hCells)) {
        message.warning('Невозможно разместить панель здесь');
        return;
      }
      const panel: PlacedPanel = {
        id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        designId: selectedDesign.id,
        designName: selectedDesign.name,
        designImage: selectedDesign.image,
        col,
        row,
        widthCells: wCells,
        heightCells: hCells,
        sizeMm: selectedSize.label,
        color: selectedColor.hex,
        colorName: selectedColor.name,
      };
      setPlacedPanels((prev) => [...prev, panel]);
    },
    [selectedDesign, selectedColor, selectedSize, canPlace]
  );

  const handleDeletePanel = useCallback((id: string) => {
    setPlacedPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    setPlacedPanels([]);
  }, []);

  const handleFillWall = useCallback(() => {
    const { wCells, hCells } = selectedSize;
    const newPanels: PlacedPanel[] = [];
    const allPanels = [...placedPanels];

    for (let r = 0; r <= wallRows - hCells; r++) {
      for (let c = 0; c <= wallCols - wCells; c++) {
        const canPlaceHere = !allPanels.some((p) =>
          cellsOverlap({ col: c, row: r, widthCells: wCells, heightCells: hCells }, p)
        );
        if (canPlaceHere) {
          const panel: PlacedPanel = {
            id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${c}-${r}`,
            designId: selectedDesign.id,
            designName: selectedDesign.name,
            designImage: selectedDesign.image,
            col: c,
            row: r,
            widthCells: wCells,
            heightCells: hCells,
            sizeMm: selectedSize.label,
            color: selectedColor.hex,
            colorName: selectedColor.name,
          };
          newPanels.push(panel);
          allPanels.push(panel);
        }
      }
    }

    if (newPanels.length === 0) {
      message.info('Нет свободного места');
      return;
    }

    setPlacedPanels(allPanels);
    message.success(`Добавлено ${newPanels.length} панелей`);
  }, [selectedDesign, selectedColor, selectedSize, placedPanels, wallCols, wallRows]);

  const handleAddToCart = useCallback(() => {
    if (placedPanels.length === 0) {
      message.warning('Добавьте панели на стену');
      return;
    }

    const groups = new Map<string, { panel: PlacedPanel; count: number }>();
    for (const panel of placedPanels) {
      const key = `${panel.designId}__${panel.sizeMm}__${panel.color}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { panel, count: 1 });
      }
    }

    groups.forEach(({ panel, count }) => {
      const sizeKey = panel.sizeMm === '30×30 см' ? '300x300' : panel.sizeMm === '30×60 см' ? '300x600' : '600x600';
      const unitPrice = (BASE_PANEL_PRICES[sizeKey] || 0) + DESIGN_OVERLAY_PRICE;
      const w = panel.widthCells * CELL_SIZE_MM;
      const h = panel.heightCells * CELL_SIZE_MM;
      const areaPerPanel = (w * h) / 1_000_000;

      addItem({
        id: `constructor-${panel.designId}-${panel.sizeMm}-${panel.color}`,
        productId: panel.designId,
        name: `${panel.designName} (накладка)`,
        image: panel.designImage,
        price: unitPrice,
        area: Math.round(areaPerPanel * count * 100) / 100,
        color: panel.color,
        colorName: panel.colorName,
        size: panel.sizeMm,
      });
    });

    message.success('Проект добавлен в корзину');
  }, [placedPanels, addItem]);

  // ─── Drag & drop ───────────────────────────────────────────────────────────

  const handlePanelMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedId(id);
  }, []);

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent): { col: number; row: number } | null => {
      if (!wallRef.current) return null;
      const rect = wallRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.floor((x - GAP_PX) / (CELL_PX + GAP_PX));
      const row = Math.floor((y - GAP_PX) / (CELL_PX + GAP_PX));
      if (col < 0 || row < 0 || col >= wallCols || row >= wallRows) return null;
      return { col, row };
    },
    [wallCols, wallRows]
  );

  const handleWallMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const cell = getCellFromEvent(e);
      setHoveredCell(cell);

      if (!draggedId || !cell) return;
      const panel = placedPanels.find((p) => p.id === draggedId);
      if (!panel) return;

      if (canPlace(cell.col, cell.row, panel.widthCells, panel.heightCells, draggedId)) {
        setPlacedPanels((prev) =>
          prev.map((p) => (p.id === draggedId ? { ...p, col: cell.col, row: cell.row } : p))
        );
      }
    },
    [draggedId, placedPanels, getCellFromEvent, canPlace]
  );

  const handleWallMouseUp = useCallback(() => {
    setDraggedId(null);
  }, []);

  const handleWallClick = useCallback(
    (e: React.MouseEvent) => {
      if (draggedId) return;
      const cell = getCellFromEvent(e);
      if (cell) handleClickCell(cell.col, cell.row);
    },
    [draggedId, getCellFromEvent, handleClickCell]
  );

  // ─── Preview ghost ─────────────────────────────────────────────────────────

  const ghostVisible = useMemo(() => {
    if (!hoveredCell || draggedId) return null;
    const { wCells, hCells } = selectedSize;
    if (canPlace(hoveredCell.col, hoveredCell.row, wCells, hCells)) {
      return { col: hoveredCell.col, row: hoveredCell.row, wCells, hCells };
    }
    return null;
  }, [hoveredCell, draggedId, selectedSize, canPlace]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingTop: 72, background: LIGHT_BG, minHeight: '100vh', fontFamily: FONT }}>
      {/* Page Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.04)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: DARK, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Конструктор стен
          </h1>
          <p style={{ color: GRAY, margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            Разместите панели на виртуальной стене. Кликайте на ячейки или используйте кнопку «Добавить».
            Все дизайны накладок — {DESIGN_OVERLAY_PRICE.toLocaleString('ru-RU')} ₽/шт.
          </p>
        </div>
      </div>

      {/* ─── PRESET SELECTOR (full width) ─────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid rgba(0,0,0,0.04)',
          padding: '20px 0 20px',
        }}
      >
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: DARK }}>Пресеты интерьеров</span>
              <span style={{ fontSize: 12, color: GRAY }}>
                Выберите комнату для реалистичного превью
              </span>
            </div>
            <Segmented
              value={wallMode}
              onChange={handleModeChange}
              options={[
                { label: 'Сетка', value: 'grid' },
                { label: 'Интерьер', value: 'interior' },
              ]}
              style={{
                borderRadius: 980,
                padding: 2,
                background: 'rgba(0,0,0,0.04)',
              }}
            />
          </div>

          <div
            ref={presetScrollRef}
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              overflowY: 'hidden',
              paddingBottom: 8,
              scrollbarWidth: 'thin',
              scrollBehavior: 'smooth',
            }}
          >
            {/* "No background" option */}
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE_APPLE }}
              onClick={() => handleSelectPreset(null)}
              style={{
                minWidth: 160,
                width: 160,
                height: 100,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #F5F5F7 0%, #E8E8E8 100%)',
                border: wallMode === 'grid' ? `2px solid ${BLUE}` : '2px solid rgba(0,0,0,0.06)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                flexShrink: 0,
                transition: 'border-color 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                transform: wallMode === 'grid' ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <AppstoreOutlined style={{ fontSize: 22, color: wallMode === 'grid' ? BLUE : GRAY }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: wallMode === 'grid' ? BLUE : DARK }}>
                Без фона
              </span>
            </motion.div>

            {/* Preset cards */}
            {INTERIOR_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <motion.div
                  key={preset.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_APPLE }}
                  onClick={() => handleSelectPreset(preset.id)}
                  style={{
                    minWidth: 160,
                    width: 160,
                    height: 100,
                    borderRadius: 16,
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: isSelected ? `2px solid ${BLUE}` : '2px solid rgba(0,0,0,0.06)',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    transition: 'border-color 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    boxShadow: isSelected ? `0 0 0 1px ${BLUE}, 0 4px 16px rgba(0,113,227,0.15)` : '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <img
                    src={preset.image}
                    alt={preset.room}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  {/* Gradient overlay at bottom */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 44,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Room label */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 10,
                      right: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
                      {preset.room}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3, marginTop: 1 }}>
                      {preset.productName}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT (sidebar + wall) ────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 20,
          padding: '20px 24px',
          maxWidth: 1400,
          margin: '0 auto',
        }}
        className="constructor-layout"
      >
        {/* ─── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Wall settings */}
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.04)',
              backdropFilter: 'blur(20px)',
              background: 'rgba(255,255,255,0.85)',
            }}
            styles={{ body: { padding: 18 } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontWeight: 600, fontSize: 14, color: DARK }}>
              <ColumnWidthOutlined style={{ color: GRAY }} />
              Параметры стены
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>Ширина (ячейки × 30см)</div>
                <Select
                  value={wallCols}
                  onChange={(v) => { setWallCols(v); setPlacedPanels([]); }}
                  style={{ width: '100%' }}
                  options={[
                    { value: 6, label: '1.8 м (6)' },
                    { value: 8, label: '2.4 м (8)' },
                    { value: 10, label: '3.0 м (10)' },
                    { value: 13, label: '3.9 м (13)' },
                    { value: 16, label: '4.8 м (16)' },
                    { value: 20, label: '6.0 м (20)' },
                  ]}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>Высота (ячейки × 30см)</div>
                <Select
                  value={wallRows}
                  onChange={(v) => { setWallRows(v); setPlacedPanels([]); }}
                  style={{ width: '100%' }}
                  options={[
                    { value: 5, label: '1.5 м (5)' },
                    { value: 7, label: '2.1 м (7)' },
                    { value: 9, label: '2.7 м (9)' },
                    { value: 10, label: '3.0 м (10)' },
                    { value: 12, label: '3.6 м (12)' },
                  ]}
                />
              </div>
            </div>

            {/* Wall color — only in grid mode */}
            <AnimatePresence>
              {!isInteriorMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE_APPLE }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: GRAY, marginBottom: 6 }}>
                    <BgColorsOutlined /> Цвет стены
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {WALL_COLORS.map((c) => (
                      <Tooltip title={c.label} key={c.value}>
                        <div
                          onClick={() => setWallColor(c.value)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: c.value,
                            border: wallColor === c.value ? `2px solid ${DARK}` : '1px solid #D1D5DB',
                            cursor: 'pointer',
                            transition: 'border 0.15s',
                            boxSizing: 'border-box',
                          }}
                        />
                      </Tooltip>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interior preset info */}
            <AnimatePresence>
              {isInteriorMode && selectedPreset && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE_APPLE }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      background: `linear-gradient(135deg, rgba(0,113,227,0.06) 0%, rgba(0,113,227,0.02) 100%)`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12,
                      color: DARK,
                      lineHeight: 1.5,
                      border: `1px solid rgba(0,113,227,0.1)`,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2, color: BLUE }}>
                      {selectedPreset.room} — {selectedPreset.productName}
                    </div>
                    <div style={{ color: GRAY }}>{selectedPreset.caption}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Design selection */}
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.04)',
              backdropFilter: 'blur(20px)',
              background: 'rgba(255,255,255,0.85)',
            }}
            styles={{ body: { padding: 18 } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600, fontSize: 14, color: DARK }}>
              <AppstoreOutlined style={{ color: GRAY }} />
              Дизайн накладки
            </div>

            <Select
              style={{ width: '100%', marginBottom: 12 }}
              value={selectedDesignId}
              onChange={(v) => { setSelectedDesignId(v); setSelectedColorIdx(0); }}
              options={products.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />

            {/* Preview */}
            <div style={{ borderRadius: 12, overflow: 'hidden', height: 120, marginBottom: 12, background: '#eee', position: 'relative' }}>
              <img
                src={selectedDesign.image}
                alt={selectedDesign.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(10px)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Накладка: {DESIGN_OVERLAY_PRICE.toLocaleString('ru-RU')} ₽
              </div>
            </div>

            {/* Color */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>
                Оттенок: {selectedColor.name}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {selectedDesign.colors.map((c, idx) => (
                  <Tooltip title={c.name} key={c.hex + idx}>
                    <div
                      onClick={() => setSelectedColorIdx(idx)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: c.hex,
                        border: selectedColorIdx === idx ? `2px solid ${DARK}` : '1px solid #D1D5DB',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s, transform 0.2s',
                        transform: selectedColorIdx === idx ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Size */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>Размер панели</div>
              <Radio.Group
                value={selectedSizeKey}
                onChange={(e) => setSelectedSizeKey(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="small"
                options={SIZE_OPTIONS.map((s) => ({ label: s.label, value: s.key }))}
              />
            </div>

            {/* Price breakdown for selected size */}
            <div
              style={{
                background: LIGHT_BG,
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 12,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: GRAY, marginBottom: 3 }}>
                <span>Панель ({selectedSize.label}):</span>
                <span>{BASE_PANEL_PRICES[`${selectedSize.widthMm}x${selectedSize.heightMm}`]?.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: GRAY, marginBottom: 3 }}>
                <span>Накладка (дизайн):</span>
                <span>{DESIGN_OVERLAY_PRICE.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: DARK, borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 4, marginTop: 2 }}>
                <span>Итого за 1 шт:</span>
                <span>{getPanelPrice(selectedSizeKey).toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                icon={<PlusOutlined />}
                onClick={handleAddToWall}
                style={{
                  flex: 1,
                  background: BLUE,
                  color: '#fff',
                  border: 'none',
                  height: 38,
                  borderRadius: 980,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Добавить
              </Button>
              <Tooltip title="Заполнить всю стену выбранным дизайном">
                <Button
                  icon={<AppstoreOutlined />}
                  onClick={handleFillWall}
                  style={{
                    height: 38,
                    borderRadius: 980,
                    border: '1px solid #D1D5DB',
                    fontWeight: 500,
                    fontSize: 13,
                  }}
                >
                  Заполнить
                </Button>
              </Tooltip>
            </div>
          </Card>

          {/* Cost summary */}
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.04)',
              backdropFilter: 'blur(20px)',
              background: 'rgba(255,255,255,0.85)',
            }}
            styles={{ body: { padding: 18 } }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: DARK, marginBottom: 12 }}>
              Расчёт стоимости
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: GRAY }}>Панелей:</span>
                <span style={{ fontWeight: 500, color: DARK }}>{costs.panelCount} шт</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: GRAY }}>Покрытие:</span>
                <span style={{ fontWeight: 500, color: DARK }}>{costs.totalArea.toFixed(2)} м²</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: GRAY }}>Площадь стены:</span>
                <span style={{ fontWeight: 500, color: DARK }}>{costs.wallArea.toFixed(2)} м²</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: GRAY }}>
                <span>├ Базовые панели:</span>
                <span>{costs.totalBase.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: isSubscriber ? BLUE : GRAY }}>
                <span>└ Накладки (дизайн):</span>
                <span>{isSubscriber ? '0 ₽ (подписка)' : `${costs.totalOverlay.toLocaleString('ru-RU')} ₽`}</span>
              </div>
            </div>

            <div
              style={{
                background: DARK,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Итого:</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>
                {costs.total.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart}
                style={{
                  flex: 1,
                  background: BLUE,
                  color: '#fff',
                  border: 'none',
                  height: 38,
                  borderRadius: 980,
                  fontWeight: 600,
                }}
              >
                В корзину
              </Button>
              <Button
                icon={<UndoOutlined />}
                onClick={handleClear}
                style={{ height: 38, borderRadius: 980, border: '1px solid #D1D5DB', color: GRAY }}
              >
                Очистить
              </Button>
            </div>
          </Card>

          {/* Subscription banner or info */}
          {isSubscriber ? (
            <div
              style={{
                padding: '12px 14px',
                background: LIGHT_BG,
                borderRadius: 12,
                fontSize: 12,
                color: '#2E7D32',
                lineHeight: 1.6,
                border: '1px solid #C8E6C9',
              }}
            >
              <CrownOutlined style={{ marginRight: 6, fontSize: 14 }} />
              <strong>Подписка «{activePlan()?.name}»</strong> — накладки включены в план! Вы платите только за базовые панели.
              {activePlan()?.overlaysPerMonth ? ` Осталось ${activePlan()!.overlaysPerMonth} накладок в этом месяце.` : ' Безлимитные накладки.'}
            </div>
          ) : (
            <div
              onClick={() => openSubModal()}
              style={{
                padding: '12px 14px',
                background: '#FFF8E1',
                borderRadius: 12,
                fontSize: 12,
                color: '#F57F17',
                lineHeight: 1.6,
                cursor: 'pointer',
                border: '1px solid #FFE082',
                transition: 'background 0.2s',
              }}
            >
              <InfoCircleOutlined style={{ marginRight: 6 }} />
              <strong>Оформите подписку</strong> — и накладки будут бесплатны! Планы от {(4900).toLocaleString('ru-RU')} ₽/мес.
              <span style={{ textDecoration: 'underline', marginLeft: 4 }}>Подробнее</span>
            </div>
          )}
        </div>

        {/* ─── RIGHT - Wall Canvas ──────────────────────────────────────────── */}
        <div>
          <Card
            style={{
              borderRadius: 20,
              border: '1px solid rgba(0,0,0,0.04)',
              backdropFilter: 'blur(20px)',
              background: 'rgba(255,255,255,0.85)',
            }}
            styles={{ body: { padding: 18 } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14, color: DARK }}>Визуализация стены</span>
                <span style={{ fontSize: 12, color: GRAY, marginLeft: 10 }}>
                  {(wallWidthMm / 1000).toFixed(1)} × {(wallHeightMm / 1000).toFixed(1)} м · ячейка 30×30 см
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isInteriorMode && (
                  <Tag
                    color="blue"
                    style={{ margin: 0, borderRadius: 980, fontSize: 11, fontWeight: 500 }}
                  >
                    Интерьер: {selectedPreset?.room}
                  </Tag>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: GRAY }}>
                  <DragOutlined /> Перетаскивайте · Кликните для размещения
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', overflowY: 'auto', paddingBottom: 4 }}>
              <div
                ref={wallRef}
                onMouseMove={handleWallMouseMove}
                onMouseUp={handleWallMouseUp}
                onMouseLeave={() => { setDraggedId(null); setHoveredCell(null); }}
                onClick={handleWallClick}
                style={{
                  position: 'relative',
                  width: wallWidthPx,
                  height: wallHeightPx,
                  background: isInteriorMode && selectedPreset
                    ? `url(${selectedPreset.image})`
                    : wallColor,
                  backgroundSize: isInteriorMode ? 'cover' : undefined,
                  backgroundPosition: isInteriorMode ? 'center' : undefined,
                  borderRadius: 10,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                  cursor: draggedId ? 'grabbing' : 'pointer',
                  userSelect: 'none',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${wallCols}, ${CELL_PX}px)`,
                  gridTemplateRows: `repeat(${wallRows}, ${CELL_PX}px)`,
                  gap: `${GAP_PX}px`,
                  padding: `${GAP_PX}px`,
                  overflow: 'hidden',
                }}
              >
                {/* Grid cells */}
                {Array.from({ length: wallRows * wallCols }).map((_, idx) => {
                  const col = idx % wallCols;
                  const row = Math.floor(idx / wallCols);
                  const isOccupied = placedPanels.some((p) =>
                    col >= p.col && col < p.col + p.widthCells &&
                    row >= p.row && row < p.row + p.heightCells
                  );

                  const gridCellBg = isInteriorMode
                    ? (isOccupied ? 'transparent' : 'rgba(255,255,255,0.04)')
                    : (isOccupied ? 'transparent' : (wallColor === '#2C2C2C' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'));

                  return (
                    <div
                      key={`cell-${col}-${row}`}
                      style={{
                        width: CELL_PX,
                        height: CELL_PX,
                        background: gridCellBg,
                        borderRadius: 2,
                        pointerEvents: 'none',
                        border: isInteriorMode && !isOccupied ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  );
                })}

                {/* Ghost preview */}
                {ghostVisible && (
                  <div
                    style={{
                      position: 'absolute',
                      left: GAP_PX + ghostVisible.col * (CELL_PX + GAP_PX),
                      top: GAP_PX + ghostVisible.row * (CELL_PX + GAP_PX),
                      width: ghostVisible.wCells * CELL_PX + (ghostVisible.wCells - 1) * GAP_PX,
                      height: ghostVisible.hCells * CELL_PX + (ghostVisible.hCells - 1) * GAP_PX,
                      background: `url(${selectedDesign.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      opacity: 0.4,
                      borderRadius: 4,
                      border: `2px dashed ${BLUE}`,
                      pointerEvents: 'none',
                      zIndex: 5,
                    }}
                  />
                )}

                {/* Placed panels */}
                {placedPanels.map((panel) => (
                  <div
                    key={panel.id}
                    onMouseDown={(e) => handlePanelMouseDown(e, panel.id)}
                    style={{
                      position: 'absolute',
                      left: GAP_PX + panel.col * (CELL_PX + GAP_PX),
                      top: GAP_PX + panel.row * (CELL_PX + GAP_PX),
                      width: panel.widthCells * CELL_PX + (panel.widthCells - 1) * GAP_PX,
                      height: panel.heightCells * CELL_PX + (panel.heightCells - 1) * GAP_PX,
                      backgroundImage: `url(${panel.designImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: 3,
                      cursor: draggedId === panel.id ? 'grabbing' : 'grab',
                      boxShadow: draggedId === panel.id
                        ? '0 8px 24px rgba(0,0,0,0.30)'
                        : isInteriorMode
                          ? '0 2px 8px rgba(0,0,0,0.20)'
                          : '0 1px 4px rgba(0,0,0,0.10)',
                      zIndex: draggedId === panel.id ? 20 : 10,
                      transition: draggedId === panel.id ? 'none' : 'box-shadow 0.15s',
                      overflow: 'visible',
                    }}
                  >
                    {/* Color tint overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: panel.color,
                        opacity: isInteriorMode ? 0.15 : 0.2,
                        borderRadius: 3,
                        pointerEvents: 'none',
                      }}
                    />
                    {/* Interior mode: subtle border for panel visibility */}
                    {isInteriorMode && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 3,
                          border: '1px solid rgba(255,255,255,0.3)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {/* Size label */}
                    {panel.widthCells >= 2 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          left: 4,
                          fontSize: 9,
                          color: '#fff',
                          background: 'rgba(0,0,0,0.5)',
                          backdropFilter: 'blur(4px)',
                          borderRadius: 3,
                          padding: '1px 4px',
                          pointerEvents: 'none',
                        }}
                      >
                        {panel.sizeMm}
                      </div>
                    )}
                    {/* Delete button */}
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); handleDeletePanel(panel.id); }}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'rgba(220,38,38,0.85)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        padding: 0,
                        zIndex: 30,
                        opacity: 0.7,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Empty state */}
                {placedPanels.length === 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isInteriorMode
                        ? 'rgba(255,255,255,0.6)'
                        : wallColor === '#2C2C2C'
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(0,0,0,0.15)',
                      fontSize: 14,
                      pointerEvents: 'none',
                      gap: 8,
                      textShadow: isInteriorMode ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
                    }}
                  >
                    <AppstoreOutlined style={{ fontSize: 32 }} />
                    Кликните на ячейку или нажмите «Добавить»
                  </div>
                )}
              </div>
            </div>

            {/* Panel legend below wall */}
            {placedPanels.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>
                  Размещённые панели ({costs.panelCount} шт)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <AnimatePresence>
                    {(() => {
                      const groups = new Map<string, { name: string; size: string; color: string; colorName: string; count: number; image: string }>();
                      for (const p of placedPanels) {
                        const key = `${p.designId}__${p.sizeMm}__${p.color}`;
                        const g = groups.get(key);
                        if (g) { g.count++; } else {
                          groups.set(key, { name: p.designName, size: p.sizeMm, color: p.color, colorName: p.colorName, count: 1, image: p.designImage });
                        }
                      }
                      return Array.from(groups.entries()).map(([key, g]) => (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.15, ease: EASE_APPLE }}
                        >
                          <Tag
                            style={{
                              borderRadius: 8,
                              padding: '4px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12,
                              border: '1px solid rgba(0,0,0,0.04)',
                              background: '#fff',
                              color: '#374151',
                            }}
                          >
                            <span style={{
                              display: 'inline-block',
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: g.color,
                              border: '1px solid rgba(0,0,0,0.15)',
                              flexShrink: 0,
                            }} />
                            {g.name} · {g.size} × {g.count} шт
                          </Tag>
                        </motion.div>
                      ));
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .constructor-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
