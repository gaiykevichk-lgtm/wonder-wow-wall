import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Rate, Tag, InputNumber, Breadcrumb, message } from 'antd';
import {
  ShoppingCartOutlined,
  HeartOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { products } from '../../shared/data/products';
import { useCartStore } from '../../shared/store/cartStore';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, setOpen: setCartOpen } = useCartStore();

  const product = products.find((p) => p.id === id);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div
        style={{
          paddingTop: 72,
          background: '#FFFFFF',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
          Товар не найден
        </h2>
        <Button
          onClick={() => navigate('/catalog')}
          style={{
            background: '#2D2D2D',
            color: '#FFFFFF',
            border: 'none',
            height: 44,
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Вернуться в каталог
        </Button>
      </div>
    );
  }

  const gallery = [product.image, ...product.gallery];

  const totalPrice = product.price * quantity;

  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  const handleAddToCart = () => {
    addItem({
      id: `${product.id}-${selectedColor}-${selectedSize}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price * quantity,
      area: quantity,
      color: product.colors[selectedColor].hex,
      colorName: product.colors[selectedColor].name,
      size: product.sizes[selectedSize].label,
    });
    message.success('Товар добавлен в корзину');
    setCartOpen(true);
  };

  return (
    <div
      style={{
        paddingTop: 72,
        background: '#FFFFFF',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '24px 24px 64px',
        }}
      >
        {/* Breadcrumb + Back */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigate(-1)}
            style={{
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
              color: '#1A1A1A',
              height: 36,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              fontWeight: 500,
            }}
          >
            Назад
          </Button>
          <Breadcrumb
            items={[
              {
                title: (
                  <span
                    style={{ cursor: 'pointer', color: '#6B7280' }}
                    onClick={() => navigate('/')}
                  >
                    Главная
                  </span>
                ),
              },
              {
                title: (
                  <span
                    style={{ cursor: 'pointer', color: '#6B7280' }}
                    onClick={() => navigate('/catalog')}
                  >
                    Каталог
                  </span>
                ),
              },
              {
                title: (
                  <span style={{ color: '#1A1A1A', fontWeight: 500 }}>
                    {product.name}
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* Main 2-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'start',
          }}
          className="product-layout"
        >
          {/* LEFT — Image gallery */}
          <div>
            <div style={{ position: 'relative' }}>
              <motion.img
                key={selectedImage}
                src={gallery[selectedImage]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                style={{
                  width: '100%',
                  height: 480,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  display: 'block',
                }}
              />
              {product.badge && (
                <Tag
                  style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    background: '#4CAF50',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    padding: '3px 10px',
                  }}
                >
                  {product.badge}
                </Tag>
              )}
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 12,
                  flexWrap: 'wrap',
                }}
              >
                {gallery.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border:
                        selectedImage === idx
                          ? '2px solid #2D2D2D'
                          : '2px solid transparent',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Product info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Category / material */}
            <div style={{ color: '#6B7280', fontSize: 13, fontWeight: 500 }}>
              {product.categoryLabel} · {product.material}
            </div>

            {/* Product name */}
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: '#1A1A1A',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {product.name}
            </h1>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Rate
                disabled
                defaultValue={product.rating}
                allowHalf
                style={{ fontSize: 16, color: '#FBBF24' }}
              />
              <span style={{ fontSize: 14, color: '#6B7280' }}>
                {product.rating} ({product.reviews} отзывов)
              </span>
            </div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{ fontSize: 36, fontWeight: 800, color: '#1A1A1A' }}
              >
                {product.price.toLocaleString('ru-RU')} ₽
              </span>
              <span style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 400 }}>
                {product.priceUnit}
              </span>
            </div>

            {/* In stock */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#4CAF50',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <CheckCircleOutlined />
              <span>В наличии</span>
            </div>

            {/* Description */}
            <p
              style={{
                fontSize: 15,
                color: '#4B5563',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {product.description}
            </p>

            {/* Color selection */}
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: 10,
                }}
              >
                Цвет
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.colors.map((color, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedColor(idx)}
                    title={color.name}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: color.hex,
                      cursor: 'pointer',
                      border:
                        selectedColor === idx
                          ? '3px solid #2D2D2D'
                          : '3px solid transparent',
                      outline:
                        selectedColor === idx
                          ? '1px solid #E5E7EB'
                          : '1px solid #D1D5DB',
                      outlineOffset: 2,
                      transition: 'border 0.15s, outline 0.15s',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: '#6B7280',
                  fontWeight: 500,
                }}
              >
                {product.colors[selectedColor].name}
              </div>
            </div>

            {/* Size selection */}
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: 10,
                }}
              >
                Размер
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.sizes.map((size, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSize(idx)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1.5px solid',
                      borderColor:
                        selectedSize === idx ? '#2D2D2D' : '#D1D5DB',
                      background:
                        selectedSize === idx ? '#2D2D2D' : '#FFFFFF',
                      color: selectedSize === idx ? '#FFFFFF' : '#374151',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    }}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity & price calc */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 0',
                borderTop: '1px solid #F3F4F6',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#6B7280',
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  Количество (м²)
                </div>
                <InputNumber
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={(val) => setQuantity(val ?? 1)}
                  style={{
                    width: 100,
                    borderRadius: 8,
                    border: '1.5px solid #D1D5DB',
                  }}
                />
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 13,
                    color: '#6B7280',
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Итого
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#1A1A1A',
                  }}
                >
                  {totalPrice.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                icon={<ShoppingCartOutlined />}
                onClick={handleAddToCart}
                style={{
                  flex: 1,
                  background: '#2D2D2D',
                  color: '#FFFFFF',
                  border: 'none',
                  height: 52,
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                Добавить в корзину
              </Button>
              <Button
                icon={<HeartOutlined />}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  border: '1.5px solid #E5E7EB',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151',
                  fontSize: 18,
                  padding: 0,
                  flexShrink: 0,
                }}
              />
              <Button
                icon={<ShareAltOutlined />}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  border: '1.5px solid #E5E7EB',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151',
                  fontSize: 18,
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            </div>
          </div>
        </div>

        {/* Specs table */}
        <div
          style={{
            marginTop: 56,
            borderRadius: 12,
            border: '1px solid #F0F0F0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #F0F0F0',
              background: '#FAFAFA',
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#1A1A1A',
                margin: 0,
              }}
            >
              Характеристики
            </h2>
          </div>
          {Object.entries(product.specs).map(([key, value], idx, arr) => (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '200px 1fr',
                padding: '14px 24px',
                borderBottom:
                  idx < arr.length - 1 ? '1px solid #F5F5F5' : 'none',
                background: '#FFFFFF',
              }}
            >
              <span style={{ fontSize: 14, color: '#6B7280' }}>{key}</span>
              <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 600 }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#1A1A1A',
                marginBottom: 24,
              }}
            >
              Похожие дизайны
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 24,
              }}
            >
              {relatedProducts.map((related) => (
                <motion.div
                  key={related.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => navigate(`/product/${related.id}`)}
                  style={{
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: '#FFFFFF',
                  }}
                >
                  <img
                    src={related.image}
                    alt={related.name}
                    style={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div style={{ padding: '14px 16px 16px' }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#1A1A1A',
                        marginBottom: 6,
                      }}
                    >
                      {related.name}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#1A1A1A',
                      }}
                    >
                      {related.price.toLocaleString('ru-RU')} ₽
                      <span
                        style={{
                          fontSize: 13,
                          color: '#9CA3AF',
                          fontWeight: 400,
                          marginLeft: 4,
                        }}
                      >
                        {related.priceUnit}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
