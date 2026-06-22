/**
 * Phase Panel Creator Wizard — Step 2: Choose Textures.
 */

import React from 'react';
import { Button, Checkbox, Typography } from 'antd';
import { SelectAllOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { imageSrc } from '../../../../shared/lib/imageSrc';
import type { ApiTexture } from '../../api/texturesAdminApi';

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

interface StepTexturesProps {
  textures: ApiTexture[];
  selectedIds: Set<string>;
  onToggle: (textureId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function StepTextures({
  textures,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: StepTexturesProps) {
  const allSelected = textures.length > 0 && selectedIds.size === textures.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < textures.length;

  return (
    <div>
      {/* Header */}
      <motion.div variants={fadeUpVariants} custom={0} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Шаг 2: Выберите текстуры
        </Title>
        <Text type="secondary">
          Выберите материалы, для которых будете загружать изображения комбинаций.
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
          marginBottom: 24,
          flexWrap: 'wrap',
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
          Выбрать все ({selectedIds.size} из {textures.length})
        </Checkbox>
        <Button size="small" onClick={onSelectAll} icon={<SelectAllOutlined />}>
          Все
        </Button>
        <Button size="small" onClick={onDeselectAll} danger>
          Снять все
        </Button>
      </motion.div>

      {/* Texture grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        {textures.map((texture, i) => {
          const isSelected = selectedIds.has(texture.id);
          return (
            <motion.div
              key={texture.id}
              variants={fadeUpVariants}
              custom={2 + i}
              onClick={() => onToggle(texture.id)}
              style={{
                border: isSelected ? '2px solid #1890ff' : '2px solid transparent',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                background: isSelected ? '#e6f7ff' : '#fff',
                boxShadow: isSelected
                  ? '0 4px 12px rgba(24, 144, 255, 0.2)'
                  : '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {/* Checkbox indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: isSelected ? '#1890ff' : 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  zIndex: 1,
                  transition: 'background 0.2s',
                }}
              >
                {isSelected ? '✓' : ''}
              </div>

              {/* Swatch image */}
              <div style={{ position: 'relative', background: '#f5f5f5' }}>
                {texture.swatch_image ? (
                  <img
                    src={imageSrc(texture.swatch_image)}
                    alt={texture.name}
                    style={{
                      width: '100%',
                      height: 120,
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 120,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#e8e8e8',
                      color: '#999',
                      fontSize: 12,
                    }}
                  >
                    Нет swatch
                  </div>
                )}
              </div>

              {/* Name */}
              <div style={{ padding: '12px' }}>
                <div
                  style={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {texture.name}
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {texture.slug}
                </Text>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty state */}
      {textures.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Text type="secondary">Нет доступных текстур. Создайте их в разделе «Текстуры».</Text>
        </div>
      )}
    </div>
  );
}
