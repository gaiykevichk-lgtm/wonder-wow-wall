import { useState, useMemo } from 'react';
import { Input, Radio, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { products } from '../../catalog/model/data';
import type { PanelSizeKey } from '../model/types';

const { Text } = Typography;

interface PanelPickerProps {
  selectedDesignId: string;
  selectedSizeKey: PanelSizeKey;
  selectedColor: string;
  onDesignSelect: (id: string, name: string, image: string) => void;
  onSizeSelect: (key: PanelSizeKey) => void;
  onColorSelect: (hex: string, name: string) => void;
}

export function PanelPicker({
  selectedDesignId,
  selectedSizeKey,
  selectedColor,
  onDesignSelect,
  onSizeSelect,
  onColorSelect,
}: PanelPickerProps) {
  const [search, setSearch] = useState('');

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const selectedProduct = products.find((p) => p.id === selectedDesignId);

  return (
    <div
      data-testid="panel-picker"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
      }}
    >
      {/* Search */}
      <Input
        prefix={<SearchOutlined style={{ color: '#86868b' }} />}
        placeholder="Найти дизайн..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ borderRadius: 8 }}
      />

      {/* Design thumbnails */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
          overflowY: 'auto',
          flex: 1,
          maxHeight: 300,
        }}
      >
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            data-testid={`design-${product.id}`}
            onClick={() => onDesignSelect(product.id, product.name, product.image)}
            style={{
              cursor: 'pointer',
              borderRadius: 8,
              border: `2px solid ${selectedDesignId === product.id ? '#0071e3' : 'rgba(0,0,0,0.04)'}`,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                paddingBottom: '100%',
                background: `url(${product.image}) center/cover`,
                backgroundColor: '#F5F5F7',
              }}
            />
            <Text
              style={{
                display: 'block',
                padding: '4px 6px',
                fontSize: 11,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product.name}
            </Text>
            {selectedDesignId === product.id && (
              <Tag
                color="#0071e3"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  margin: 0,
                  fontSize: 10,
                  padding: '0 4px',
                  borderRadius: 4,
                }}
              >
                Выбран
              </Tag>
            )}
          </div>
        ))}
      </div>

      {/* Size selector */}
      <div>
        <Text
          strong
          style={{ display: 'block', marginBottom: 8, fontSize: 13 }}
        >
          Размер панели
        </Text>
        <Radio.Group
          value={selectedSizeKey}
          onChange={(e) => onSizeSelect(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <Radio value="30x30">30×30 см</Radio>
          <Radio value="30x60">30×60 см</Radio>
          <Radio value="60x60">60×60 см</Radio>
        </Radio.Group>
      </div>

      {/* Color selector */}
      {selectedProduct && selectedProduct.colors.length > 0 && (
        <div>
          <Text
            strong
            style={{ display: 'block', marginBottom: 8, fontSize: 13 }}
          >
            Цвет
          </Text>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {selectedProduct.colors.map((c) => (
              <div
                key={c.hex}
                data-testid={`color-${c.hex}`}
                onClick={() => onColorSelect(c.hex, c.name)}
                title={c.name}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c.hex,
                  border: `2px solid ${selectedColor === c.hex ? '#0071e3' : 'rgba(0,0,0,0.04)'}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
