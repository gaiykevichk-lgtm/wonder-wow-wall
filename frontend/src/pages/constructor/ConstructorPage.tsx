import { useState, useRef, useCallback } from 'react';
import { Button, InputNumber, Select, Card, Tag, message, Tooltip } from 'antd';
import {
  ShoppingCartOutlined,
  UndoOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { products } from '../../shared/data/products';
import { useCartStore } from '../../shared/store/cartStore';

interface PlacedPanel {
  id: string;
  productId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  name: string;
  price: number;
  image: string;
}

const WALL_COLORS = [
  { label: 'Белая', value: '#F5F5F5' },
  { label: 'Светло-серая', value: '#E8E8E8' },
  { label: 'Бежевая', value: '#F5F0E8' },
  { label: 'Тёмная', value: '#2C2C2C' },
  { label: 'Голубая', value: '#E3F2FD' },
];

const SCALE = 0.2;

export default function ConstructorPage() {
  const [wallWidth, setWallWidth] = useState(4000);
  const [wallHeight, setWallHeight] = useState(2700);
  const [wallColor, setWallColor] = useState('#F5F5F5');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0].id);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(0);
  const [placedPanels, setPlacedPanels] = useState<PlacedPanel[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const wallRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const selectedColor = selectedProduct.colors[selectedColorIdx] || selectedProduct.colors[0];
  const selectedSize = selectedProduct.sizes[selectedSizeIdx] || selectedProduct.sizes[0];

  const wallPxWidth = wallWidth * SCALE;
  const wallPxHeight = wallHeight * SCALE;

  const totalPanelCount = placedPanels.length;
  const totalAreaCovered = placedPanels.reduce(
    (sum, p) => sum + (p.width * p.height) / 1_000_000,
    0
  );
  const wallArea = (wallWidth * wallHeight) / 1_000_000;
  const totalCost = placedPanels.reduce((sum, p) => {
    const areaSqm = (p.width * p.height) / 1_000_000;
    return sum + p.price * areaSqm;
  }, 0);

  const handleAddToWall = useCallback(() => {
    const panelWidthPx = selectedSize.width * SCALE;
    const panelHeightPx = selectedSize.height * SCALE;

    const newPanel: PlacedPanel = {
      id: `panel-${Date.now()}-${Math.random()}`,
      productId: selectedProduct.id,
      x: Math.min(20, wallPxWidth - panelWidthPx),
      y: Math.min(20, wallPxHeight - panelHeightPx),
      width: selectedSize.width,
      height: selectedSize.height,
      color: selectedColor.hex,
      name: selectedProduct.name,
      price: selectedProduct.price,
      image: selectedProduct.image,
    };

    setPlacedPanels((prev) => [...prev, newPanel]);
  }, [selectedProduct, selectedColor, selectedSize, wallPxWidth, wallPxHeight]);

  const handleDeletePanel = useCallback((id: string) => {
    setPlacedPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      const panel = placedPanels.find((p) => p.id === id);
      if (!panel || !wallRef.current) return;
      const rect = wallRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - panel.x;
      const offsetY = e.clientY - rect.top - panel.y;
      setDraggedId(id);
      setDragOffset({ x: offsetX, y: offsetY });
    },
    [placedPanels]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedId || !wallRef.current) return;
      const rect = wallRef.current.getBoundingClientRect();
      const panel = placedPanels.find((p) => p.id === draggedId);
      if (!panel) return;

      const panelWidthPx = panel.width * SCALE;
      const panelHeightPx = panel.height * SCALE;

      const newX = Math.max(
        0,
        Math.min(
          e.clientX - rect.left - dragOffset.x,
          wallPxWidth - panelWidthPx
        )
      );
      const newY = Math.max(
        0,
        Math.min(
          e.clientY - rect.top - dragOffset.y,
          wallPxHeight - panelHeightPx
        )
      );

      setPlacedPanels((prev) =>
        prev.map((p) => (p.id === draggedId ? { ...p, x: newX, y: newY } : p))
      );
    },
    [draggedId, dragOffset, placedPanels, wallPxWidth, wallPxHeight]
  );

  const handleMouseUp = useCallback(() => {
    setDraggedId(null);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (placedPanels.length === 0) {
      message.warning('Добавьте пластины на стену');
      return;
    }

    const groups = new Map<string, { panel: PlacedPanel; count: number; totalArea: number }>();

    for (const panel of placedPanels) {
      const sizeLabel = `${panel.width}×${panel.height} мм`;
      const key = `${panel.productId}__${panel.color}__${sizeLabel}`;
      const existing = groups.get(key);
      const areaSqm = (panel.width * panel.height) / 1_000_000;
      if (existing) {
        existing.count += 1;
        existing.totalArea += areaSqm;
      } else {
        groups.set(key, { panel, count: 1, totalArea: areaSqm });
      }
    }

    groups.forEach(({ panel, count, totalArea }, key) => {
      const sizeLabel = `${panel.width}×${panel.height} мм`;
      const product = products.find((p) => p.id === panel.productId);
      const colorObj = product?.colors.find((c) => c.hex === panel.color);
      const cartId = `constructor-${key}`;

      addItem({
        id: cartId,
        productId: panel.productId,
        name: panel.name,
        image: panel.image,
        price: panel.price,
        area: Math.round(totalArea * 100) / 100,
        color: panel.color,
        colorName: colorObj?.name || panel.color,
        size: sizeLabel,
      });
    });

    message.success('Пластины добавлены в корзину');
  }, [placedPanels, addItem]);

  const handleClear = useCallback(() => {
    setPlacedPanels([]);
  }, []);

  const gridLines = () => {
    const lines = [];
    const stepMm = 500;
    for (let x = stepMm; x < wallWidth; x += stepMm) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x * SCALE}
          y1={0}
          x2={x * SCALE}
          y2={wallPxHeight}
          stroke="#000"
          strokeWidth={1}
        />
      );
    }
    for (let y = stepMm; y < wallHeight; y += stepMm) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y * SCALE}
          x2={wallPxWidth}
          y2={y * SCALE}
          stroke="#000"
          strokeWidth={1}
        />
      );
    }
    return lines;
  };

  return (
    <div style={{ paddingTop: 72, background: '#F5F5F5', minHeight: '100vh' }}>
      {/* Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          padding: '32px',
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#1A1A1A',
            margin: 0,
            marginBottom: 8,
          }}
        >
          Конструктор стен
        </h1>
        <p style={{ color: '#6B7280', margin: 0, fontSize: 15 }}>
          Разместите пластины на виртуальной стене и рассчитайте стоимость покрытия
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 24,
          padding: '24px',
          maxWidth: 1400,
          margin: '0 auto',
        }}
        className="constructor-layout"
      >
        {/* LEFT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card 1 - Wall settings */}
          <Card
            style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
            styles={{ body: { padding: 20 } }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                fontWeight: 600,
                fontSize: 15,
                color: '#1A1A1A',
              }}
            >
              <ColumnWidthOutlined style={{ color: '#6B7280' }} />
              Параметры стены
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Ширина, мм</div>
                <InputNumber
                  min={1000}
                  max={10000}
                  step={100}
                  value={wallWidth}
                  onChange={(v) => setWallWidth(v ?? 4000)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Высота, мм</div>
                <InputNumber
                  min={1000}
                  max={5000}
                  step={100}
                  value={wallHeight}
                  onChange={(v) => setWallHeight(v ?? 2700)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: '#6B7280',
                  marginBottom: 8,
                }}
              >
                <BgColorsOutlined />
                Цвет стены
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {WALL_COLORS.map((c) => (
                  <Tooltip title={c.label} key={c.value}>
                    <div
                      onClick={() => setWallColor(c.value)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: c.value,
                        border:
                          wallColor === c.value
                            ? '2px solid #2D2D2D'
                            : '1px solid #D1D5DB',
                        cursor: 'pointer',
                        transition: 'border 0.15s',
                        boxSizing: 'border-box',
                      }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>
          </Card>

          {/* Card 2 - Panel selection */}
          <Card
            style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
            styles={{ body: { padding: 20 } }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: '#1A1A1A',
                marginBottom: 14,
              }}
            >
              Выберите пластину
            </div>

            <Select
              style={{ width: '100%', marginBottom: 14 }}
              value={selectedProductId}
              onChange={(v) => {
                setSelectedProductId(v);
                setSelectedColorIdx(0);
                setSelectedSizeIdx(0);
              }}
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} — ${p.price.toLocaleString('ru-RU')} ₽/м²`,
              }))}
            />

            {/* Preview image */}
            <div
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                height: 130,
                marginBottom: 14,
                background: '#F5F5F5',
              }}
            >
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Color selection */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                Цвет: {selectedColor.name}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedProduct.colors.map((c, idx) => (
                  <Tooltip title={c.name} key={c.hex + idx}>
                    <div
                      onClick={() => setSelectedColorIdx(idx)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: c.hex,
                        border:
                          selectedColorIdx === idx
                            ? '2px solid #2D2D2D'
                            : '1px solid #D1D5DB',
                        cursor: 'pointer',
                        transition: 'border 0.15s',
                        boxSizing: 'border-box',
                      }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Size selection */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Размер</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedProduct.sizes.map((s, idx) => (
                  <button
                    key={s.label}
                    onClick={() => setSelectedSizeIdx(idx)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #D1D5DB',
                      background: selectedSizeIdx === idx ? '#2D2D2D' : '#fff',
                      color: selectedSizeIdx === idx ? '#fff' : '#374151',
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              icon={<PlusOutlined />}
              onClick={handleAddToWall}
              style={{
                width: '100%',
                background: '#4CAF50',
                color: '#fff',
                border: 'none',
                height: 40,
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Добавить на стену
            </Button>
          </Card>

          {/* Card 3 - Cost summary */}
          <Card
            style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
            styles={{ body: { padding: 20 } }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: '#1A1A1A',
                marginBottom: 14,
              }}
            >
              Расчёт
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>Панелей:</span>
                <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{totalPanelCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>Площадь покрытия:</span>
                <span style={{ fontWeight: 500, color: '#1A1A1A' }}>
                  {totalAreaCovered.toFixed(2)} м²
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>Площадь стены:</span>
                <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{wallArea.toFixed(2)} м²</span>
              </div>
            </div>

            <div
              style={{
                background: '#F5F5F5',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <span style={{ color: '#6B7280', fontSize: 13 }}>Итого:</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>
                {Math.round(totalCost).toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart}
                style={{
                  flex: 1,
                  background: '#2D2D2D',
                  color: '#fff',
                  border: 'none',
                  height: 38,
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                В корзину
              </Button>
              <Button
                icon={<UndoOutlined />}
                onClick={handleClear}
                style={{
                  height: 38,
                  borderRadius: 8,
                  border: '1px solid #D1D5DB',
                  color: '#6B7280',
                  background: '#fff',
                }}
              >
                Очистить
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT - Wall canvas */}
        <div>
          <Card
            style={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
            styles={{ body: { padding: 20 } }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15, color: '#1A1A1A' }}>
                Визуализация стены
              </span>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                {wallWidth} × {wallHeight} мм (масштаб 1:5)
              </span>
            </div>

            <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
              <div
                ref={wallRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  position: 'relative',
                  width: wallPxWidth,
                  height: wallPxHeight,
                  background: wallColor,
                  borderRadius: 8,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                  border: '1px solid #E5E7EB',
                  cursor: draggedId ? 'grabbing' : 'default',
                  userSelect: 'none',
                }}
              >
                {/* Grid lines */}
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    opacity: 0.08,
                  }}
                >
                  {gridLines()}
                </svg>

                {/* Placed panels */}
                {placedPanels.map((panel) => (
                  <div
                    key={panel.id}
                    onMouseDown={(e) => handleMouseDown(e, panel.id)}
                    style={{
                      position: 'absolute',
                      left: panel.x,
                      top: panel.y,
                      width: panel.width * SCALE,
                      height: panel.height * SCALE,
                      backgroundImage: `url(${panel.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 2,
                      cursor: draggedId === panel.id ? 'grabbing' : 'grab',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                      overflow: 'visible',
                    }}
                  >
                    {/* Color tint overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: panel.color,
                        opacity: 0.25,
                        pointerEvents: 'none',
                        borderRadius: 2,
                      }}
                    />
                    {/* Delete button */}
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => handleDeletePanel(panel.id)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        padding: 0,
                        zIndex: 10,
                      }}
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
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: wallColor === '#2C2C2C' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                      fontSize: 15,
                      pointerEvents: 'none',
                    }}
                  >
                    Добавьте пластины на стену
                  </div>
                )}
              </div>
            </div>

            {/* Panel tags below wall */}
            {placedPanels.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {placedPanels.map((panel) => (
                  <motion.div
                    key={panel.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    style={{ display: 'inline-block' }}
                  >
                    <Tag
                      closable
                      onClose={() => handleDeletePanel(panel.id)}
                      style={{
                        borderRadius: 6,
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        border: '1px solid #E5E7EB',
                        background: '#fff',
                        color: '#374151',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: panel.color,
                          border: '1px solid rgba(0,0,0,0.15)',
                          marginRight: 2,
                          flexShrink: 0,
                        }}
                      />
                      {panel.name} · {panel.width}×{panel.height} мм
                    </Tag>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
