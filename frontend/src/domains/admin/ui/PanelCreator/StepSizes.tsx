/**
 * Phase Panel Creator Wizard — Step 3: Choose Panel Sizes.
 */

import React from 'react';
import { Checkbox, Typography } from 'antd';
import { motion } from 'framer-motion';
import type { PanelSizeKey } from '../../model/panelCreatorStore';
import { PANEL_SIZES } from '../../model/panelCreatorStore';

const { Title, Text } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

// SVG icons for each size
function SizeIcon({ width, height, selected }: { width: number; height: number; selected: boolean }) {
  const scale = 2;
  const scaledWidth = Math.min(width * scale, 60);
  const scaledHeight = Math.min(height * scale, 60);

  return (
    <svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${scaledWidth} ${scaledHeight}`}
      fill={selected ? '#1890ff' : '#d9d9d9'}
      style={{ transition: 'fill 0.2s' }}
    >
      <rect
        x={2}
        y={2}
        width={scaledWidth - 4}
        height={scaledHeight - 4}
        rx={4}
        stroke={selected ? '#1890ff' : '#d9d9d9'}
        strokeWidth={2}
        fill="none"
      />
    </svg>
  );
}

interface StepSizesProps {
  selectedSizes: Set<PanelSizeKey>;
  onToggle: (sizeKey: PanelSizeKey) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function StepSizes({
  selectedSizes,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: StepSizesProps) {
  const allSelected = selectedSizes.size === PANEL_SIZES.length;
  const someSelected = selectedSizes.size > 0 && selectedSizes.size < PANEL_SIZES.length;

  return (
    <div>
      {/* Header */}
      <motion.div variants={fadeUpVariants} custom={0} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Шаг 3: Выберите размеры панелей
        </Title>
        <Text type="secondary">
          Для каких размеров панелей загружать изображения? Каждая комбинация
          (текстура × цвет × размер) получит своё фото.
        </Text>
      </motion.div>

      {/* Controls */}
      <motion.div
        variants={fadeUpVariants}
        custom={1}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 32,
        }}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(e) => {
            if (e.target.checked) {
              onSelectAll();
            } else {
              onDeselectAll();
            }
          }}
        >
          Выбрать все размеры
        </Checkbox>
      </motion.div>

      {/* Size cards */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {PANEL_SIZES.map((size, i) => {
          const isSelected = selectedSizes.has(size.key);
          return (
            <motion.div
              key={size.key}
              variants={fadeUpVariants}
              custom={2 + i}
              onClick={() => onToggle(size.key)}
              style={{
                width: 200,
                padding: 24,
                border: isSelected ? '2px solid #1890ff' : '2px solid #e8e8e8',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                background: isSelected ? '#e6f7ff' : '#fff',
                boxShadow: isSelected
                  ? '0 4px 16px rgba(24, 144, 255, 0.2)'
                  : '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {/* Size visualization */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SizeIcon width={size.width} height={size.height} selected={isSelected} />
              </div>

              {/* Size label */}
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    color: isSelected ? '#1890ff' : '#333',
                    marginBottom: 4,
                  }}
                >
                  {size.label}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {size.width}×{size.height} мм
                </Text>
              </div>

              {/* Checkbox indicator */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `2px solid ${isSelected ? '#1890ff' : '#d9d9d9'}`,
                  background: isSelected ? '#1890ff' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
              >
                {isSelected ? '✓' : ''}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <motion.div variants={fadeUpVariants} custom={5} style={{ marginTop: 32 }}>
        <Text type="secondary">
          Выбрано: {selectedSizes.size} из {PANEL_SIZES.length} размеров
        </Text>
      </motion.div>
    </div>
  );
}
