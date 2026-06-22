/**
 * Phase Panel Creator Wizard — Step 4: Upload Images.
 */

import { useState } from 'react';
import {
  Button,
  ColorPicker,
  Empty,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import type { Color } from 'antd/es/color-picker';
import { imageSrc } from '../../../../shared/lib/imageSrc';
import { AdminFileUpload } from '../../../../shared/ui/AdminFileUpload';
import type { PanelSizeKey, VariantEntry } from '../../model/panelCreatorStore';
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

interface StepUploadProps {
  variants: VariantEntry[];
  designName: string;
  onSetVariantImage: (key: string, imagePath: string) => void;
  onSetVariantHex: (key: string, hex: string) => void;
  onClearVariantImage: (key: string) => void;
  onBatchApply: (keys: string[], imagePath: string) => void;
}

function getSizeLabel(sizeKey: PanelSizeKey): string {
  return PANEL_SIZES.find((s) => s.key === sizeKey)?.label ?? sizeKey;
}

function VariantCard({
  variant,
  onSetImage,
  onSetHex,
  onClearImage,
}: {
  variant: VariantEntry;
  onSetImage: (path: string) => void;
  onSetHex: (hex: string) => void;
  onClearImage: () => void;
}) {
  const hasImage = !!variant.imagePath;
  const isComplete = hasImage;

  return (
    <motion.div
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      style={{
        border: isComplete ? '2px solid #52c41a' : '2px dashed #d9d9d9',
        borderRadius: 8,
        padding: 12,
        background: isComplete ? '#f6ffed' : '#fafafa',
        position: 'relative',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          {variant.textureName}
        </Text>
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
          — {variant.colorName}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {getSizeLabel(variant.sizeKey)}
        </Text>
      </div>

      {/* Image area */}
      {hasImage ? (
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <img
            src={imageSrc(variant.imagePath!)}
            alt={`${variant.textureName} ${variant.colorName}`}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              borderRadius: 6,
              background: '#f0f0f0',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = '0.5';
            }}
          />
          {/* Status badge */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#52c41a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
            }}
          >
            ✓
          </div>
          {/* Delete button */}
          <Popconfirm
            title="Удалить изображение?"
            description="Можно будет загрузить заново."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={onClearImage}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 4,
              }}
            />
          </Popconfirm>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '1',
            border: '2px dashed #d9d9d9',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fafafa',
            marginBottom: 8,
          }}
        >
          <UploadOutlined style={{ fontSize: 24, color: '#999', marginBottom: 8 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Загрузите фото
          </Text>
        </div>
      )}

      {/* Color picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Цвет:
        </Text>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background: variant.hex || '#ccc',
            border: '1px solid rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}
        />
        <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>
          {variant.hex || '—'}
        </Text>
        <ColorPicker
          size="small"
          value={variant.hex || '#808080'}
          onChange={(_color: Color, hex: string) => onSetHex(hex)}
          showText
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {/* Upload button */}
      {!hasImage && (
        <AdminFileUpload
          purpose="MISC"
          hint="JPG/PNG"
          onUploaded={(asset) => onSetImage(asset.path)}
        />
      )}
    </motion.div>
  );
}

export function StepUpload({
  variants,
  designName,
  onSetVariantImage,
  onSetVariantHex,
  onClearVariantImage,
  onBatchApply,
}: StepUploadProps) {
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchTextureId, setBatchTextureId] = useState<string | null>(null);
  const [batchImagePath, setBatchImagePath] = useState<string | null>(null);

  // Progress
  const uploadedCount = variants.filter((v) => !!v.imagePath).length;
  const totalCount = variants.length;
  const progress = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  // Group variants that need batch apply
  const variantsNeedingImage = variants.filter((v) => !v.imagePath);
  const textureIdsNeedingImage = [...new Set(variantsNeedingImage.map((v) => v.textureId))];

  function openBatchModal(textureId: string) {
    setBatchTextureId(textureId);
    setBatchImagePath(null);
    setBatchModalVisible(true);
  }

  function handleBatchUpload(imagePath: string) {
    if (!batchTextureId) return;
    const keys = variants
      .filter((v) => v.textureId === batchTextureId && !v.imagePath)
      .map((v) => v.key);
    onBatchApply(keys, imagePath);
    setBatchModalVisible(false);
    message.success(`Фото применено к ${keys.length} вариантам`);
  }


  return (
    <div>
      {/* Header */}
      <motion.div variants={fadeUpVariants} custom={0} style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Шаг 4: Загрузите изображения
        </Title>
        <Text type="secondary">
          Загрузите фотографии для каждой комбинации (текстура × цвет × размер).
          Для дизайна: <strong>{designName}</strong>
        </Text>
      </motion.div>

      {/* Progress */}
      <motion.div
        variants={fadeUpVariants}
        custom={1}
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Progress
            percent={progress}
            status={progress === 100 ? 'success' : 'active'}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Text type="secondary">
            {uploadedCount} / {totalCount}
          </Text>
        </div>
      </motion.div>

      {/* Batch upload buttons */}
      {textureIdsNeedingImage.length > 0 && (
        <motion.div variants={fadeUpVariants} custom={2} style={{ marginBottom: 24 }}>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
            Быстрая загрузка для текстур без фото:
          </Text>
          <Space wrap>
            {textureIdsNeedingImage.map((textureId) => {
              const textureVariants = variants.filter(
                (v) => v.textureId === textureId && !v.imagePath,
              );
              const textureName = variants.find((v) => v.textureId === textureId)?.textureName;
              return (
                <Button
                  key={textureId}
                  icon={<UploadOutlined />}
                  onClick={() => openBatchModal(textureId)}
                >
                  {textureName} ({textureVariants.length})
                </Button>
              );
            })}
          </Space>
        </motion.div>
      )}

      {/* Variants grid */}
      {variants.length === 0 ? (
        <Empty description="Нет комбинаций для загрузки. Вернитесь на предыдущие шаги." />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {variants.map((variant) => (
            <VariantCard
              key={variant.key}
              variant={variant}
              onSetImage={(path) => onSetVariantImage(variant.key, path)}
              onSetHex={(hex) => onSetVariantHex(variant.key, hex)}
              onClearImage={() => onClearVariantImage(variant.key)}
            />
          ))}
        </div>
      )}

      {/* Batch upload modal */}
      <Modal
        title={`Загрузка фото для текстуры`}
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Загрузите одно фото — оно будет применено ко всем цветам и размерам
            этой текстуры. Каждому цвету можно задать свой цвет панели.
          </Text>
          {batchImagePath ? (
            <div>
              <img
                src={imageSrc(batchImagePath)}
                alt="Preview"
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  objectFit: 'cover',
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              />
              <Button
                type="primary"
                block
                onClick={() => handleBatchUpload(batchImagePath)}
              >
                Применить ко всем вариантам ({batchTextureId ? variants.filter((v) => v.textureId === batchTextureId && !v.imagePath).length : 0})
              </Button>
            </div>
          ) : (
            <AdminFileUpload
              purpose="MISC"
              hint="JPG/PNG"
              onUploaded={(asset) => setBatchImagePath(asset.path)}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
