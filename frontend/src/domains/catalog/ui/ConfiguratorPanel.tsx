import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { ShoppingCartOutlined, HeartOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import TextureSelector from './TextureSelector';
import ColorSelector from './ColorSelector';
import SizeSelector from './SizeSelector';
import type { FullConfig, Texture, TextureColor } from '../model/types';
import { useCartStore } from '../../order/model/cartStore';
import { PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';

interface Props {
  config: FullConfig;
  designId: string;
  designImage: string;
  onVariantImageChange: (imagePath: string | null) => void;
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#E8E8ED', borderRadius: 8, padding: 4 }}>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: value <= 1 ? 'transparent' : '#fff', cursor: 'pointer', fontSize: 18, color: '#2D2D2D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 400, lineHeight: 1, transition: 'background 0.2s' }}
      >−</button>
      <span style={{ width: 40, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#2D2D2D' }}>{value}</span>
      <button
        onClick={() => onChange(Math.min(100, value + 1))}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, color: '#2D2D2D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 400, lineHeight: 1, transition: 'background 0.2s' }}
      >+</button>
    </div>
  );
}

export default function ConfiguratorPanel({ config, designId, designImage, onVariantImageChange }: Props) {
  const { addItemWithQuantity, setOpen: setCartOpen } = useCartStore();

  const [textureId, setTextureId] = useState('');
  const [colorId, setColorId] = useState('');
  const [sizeKey, setSizeKey] = useState('300x300');
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);

  const hasTextures = config.textures.length > 0;

  const activeTexture: Texture | undefined = useMemo(
    () => config.textures.find((t) => t.id === textureId),
    [config.textures, textureId],
  );

  const activeColor: TextureColor | undefined = useMemo(
    () => activeTexture?.colors.find((c) => c.id === colorId),
    [activeTexture, colorId],
  );

  useEffect(() => {
    if (config.textures.length > 0 && !config.textures.find((t) => t.id === textureId)) {
      setTextureId(config.textures[0].id);
    }
  }, [config.textures, textureId]);

  useEffect(() => {
    if (activeTexture && activeTexture.colors.length > 0) {
      if (!activeTexture.colors.find((c) => c.id === colorId)) {
        setColorId(activeTexture.colors[0].id);
      }
    }
  }, [activeTexture, colorId]);

  const variantImageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const vi of config.variantImages) {
      map.set(`${vi.textureId}:${vi.colorId}`, vi.imagePath);
    }
    return map;
  }, [config.variantImages]);

  useEffect(() => {
    if (!textureId || !colorId) {
      onVariantImageChange(null);
      return;
    }
    const path = variantImageMap.get(`${textureId}:${colorId}`) ?? null;
    onVariantImageChange(path);
  }, [textureId, colorId, variantImageMap, onVariantImageChange]);

  const unitPrice = useMemo(() => {
    return (BASE_PANEL_PRICES[sizeKey] ?? 0) + (config.price || DESIGN_OVERLAY_PRICE);
  }, [sizeKey, config.price]);

  const totalPrice = unitPrice * quantity;

  const sizeLabel = useMemo(() => {
    const s = PANEL_SIZES.find((ps) => `${ps.width}x${ps.height}` === sizeKey);
    return s?.label ?? sizeKey;
  }, [sizeKey]);

  const handleTextureChange = useCallback((id: string) => {
    setTextureId(id);
  }, []);

  const handleColorChange = useCallback((id: string) => {
    setColorId(id);
  }, []);

  const handleAddToCart = useCallback(() => {
    addItemWithQuantity(
      {
        id: `${designId}-${textureId || 'default'}-${colorId || 'default'}-${sizeKey}`,
        productId: designId,
        name: config.designName,
        image: designImage,
        price: unitPrice,
        area: quantity,
        color: activeColor?.hex ?? '',
        colorName: activeColor?.name ?? '',
        colorId: colorId,
        textureName: activeTexture?.name ?? '',
        textureId: textureId,
        sizeKey: sizeKey,
        size: sizeLabel,
      },
      quantity,
    );
    message.success('Товар добавлен в корзину');
    setCartOpen(true);
  }, [designId, config.designName, designImage, textureId, colorId, sizeKey, unitPrice, quantity, activeColor, activeTexture, sizeLabel, addItemWithQuantity, setCartOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {hasTextures && (
        <>
          <TextureSelector textures={config.textures} activeId={textureId} onChange={handleTextureChange} />
          {activeTexture && activeTexture.colors.length > 0 && (
            <ColorSelector colors={activeTexture.colors} activeId={colorId} onChange={handleColorChange} />
          )}
        </>
      )}

      <SizeSelector activeSizeKey={sizeKey} onChange={setSizeKey} designPrice={config.price || DESIGN_OVERLAY_PRICE} />

      {/* Quantity + Price */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F5F5', borderRadius: 16, padding: '20px 24px' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 8 }}>Количество</div>
          <Stepper value={quantity} onChange={setQuantity} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>Итого</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.02em' }}>
            {totalPrice.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 12 }}>
        <motion.button
          onClick={handleAddToCart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#4CAF50',
            color: '#fff',
            border: 'none',
            height: 54,
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          <ShoppingCartOutlined style={{ fontSize: 18 }} /> В корзину
        </motion.button>
        <motion.button
          onClick={() => setLiked((v) => !v)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 54,
            height: 54,
            borderRadius: 12,
            border: '1.5px solid #E8E8ED',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            color: liked ? '#FF3B30' : '#2D2D2D',
          }}
        >
          {liked ? '♥' : <HeartOutlined />}
        </motion.button>
      </div>
    </div>
  );
}
