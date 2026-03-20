import { useCallback, useState } from 'react';
import { Button, Typography, message } from 'antd';
import {
  CameraOutlined,
  CloudUploadOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;

interface PhotoUploaderProps {
  onUpload: (file: File) => void;
  loading?: boolean;
}

export function PhotoUploader({ onUpload, loading }: PhotoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/') && !file.name.match(/\.heic$/i)) {
        message.error('Выберите изображение (JPEG, PNG, WebP)');
        return;
      }
      onUpload(file);
    },
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 64,
        border: `2px dashed ${dragActive ? '#4CAF50' : '#E5E7EB'}`,
        borderRadius: 16,
        background: dragActive ? 'rgba(76, 175, 80, 0.04)' : '#FAFAFA',
        cursor: 'pointer',
        transition: 'all 0.3s',
        minHeight: 400,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: dragActive
            ? 'rgba(76, 175, 80, 0.1)'
            : 'rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s',
        }}
      >
        <CameraOutlined
          style={{
            fontSize: 36,
            color: dragActive ? '#4CAF50' : '#9CA3AF',
          }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <Title level={4} style={{ margin: 0, color: '#2D2D2D' }}>
          Загрузите фото стены
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Перетащите файл сюда или нажмите кнопку ниже
        </Text>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleInputChange}
            style={{ display: 'none' }}
            data-testid="file-input"
          />
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            size="large"
            loading={loading}
            onClick={(e) => {
              const input = (e.currentTarget as HTMLElement)
                .closest('label')
                ?.querySelector('input');
              input?.click();
            }}
            style={{
              background: '#2D2D2D',
              borderColor: '#2D2D2D',
              borderRadius: 10,
              height: 48,
              paddingInline: 32,
              fontWeight: 600,
            }}
          >
            Выбрать файл
          </Button>
        </label>

        <label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          <Button
            icon={<PictureOutlined />}
            size="large"
            onClick={(e) => {
              const input = (e.currentTarget as HTMLElement)
                .closest('label')
                ?.querySelector('input');
              input?.click();
            }}
            className="mobile-camera-btn"
            style={{
              borderRadius: 10,
              height: 48,
              paddingInline: 24,
            }}
          >
            Камера
          </Button>
        </label>
      </div>

      <Text type="secondary" style={{ fontSize: 12 }}>
        JPEG, PNG, WebP, HEIC. Максимум 20 МБ. Минимум 800×600 px.
      </Text>

      <div
        style={{
          marginTop: 16,
          padding: '16px 24px',
          background: 'rgba(76, 175, 80, 0.06)',
          borderRadius: 12,
          border: '1px solid rgba(76, 175, 80, 0.15)',
          maxWidth: 400,
        }}
      >
        <Text style={{ fontSize: 13, color: '#6B7280' }}>
          <strong style={{ color: '#2D2D2D' }}>Советы для лучшего результата:</strong>
          <br />
          — Фотографируйте стену фронтально
          <br />
          — Обеспечьте хорошее освещение
          <br />
          — Захватите всю стену целиком
        </Text>
      </div>
    </motion.div>
  );
}
