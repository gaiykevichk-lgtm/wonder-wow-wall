import { useState, useMemo } from 'react';
import { Card, Rate, Tag, Input, Select, Slider, Button } from 'antd';
import { SearchOutlined, FilterOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { products, categories } from '../model/data';
import { useCartStore } from '../../order/model/cartStore';
import type { PanelProduct } from '../model/types';

type SortKey = 'popular' | 'price-asc' | 'price-desc' | 'rating';
type ViewMode = 'grid' | 'list';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: 'easeOut' },
  }),
};

export default function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);

  const initialCategory = searchParams.get('category') || 'all';

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('popular');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    const params = new URLSearchParams(searchParams);
    if (key === 'all') {
      params.delete('category');
    } else {
      params.set('category', key);
    }
    setSearchParams(params);
  };

  const handleAddToCart = (e: React.MouseEvent, product: PanelProduct) => {
    e.stopPropagation();
    const firstSize = product.sizes[0];
    const firstColor = product.colors[0];
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      area: (firstSize.width * firstSize.height) / 1_000_000,
      color: firstColor.hex,
      colorName: firstColor.name,
      size: firstSize.label,
    });
  };

  const filtered = useMemo(() => {
    let list = [...products];

    if (activeCategory !== 'all') {
      list = list.filter((p) => p.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.categoryLabel.toLowerCase().includes(q)
      );
    }

    list = list.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);

    switch (sortKey) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
      default:
        list.sort((a, b) => b.reviews - a.reviews);
        break;
    }

    return list;
  }, [activeCategory, search, priceRange, sortKey]);

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#FFFFFF' }}>
      {/* Page Header */}
      <div
        style={{
          background: '#F5F5F5',
          padding: '48px 40px',
          borderBottom: '1px solid #E8E8E8',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Каталог дизайнов
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: '#6B7280' }}>
            {filtered.length} из {products.length} товаров
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px' }}>
        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            marginBottom: 24,
            padding: '20px 24px',
            background: '#F9F9F9',
            borderRadius: 12,
            border: '1px solid #E8E8E8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280' }}>
            <FilterOutlined />
            <span style={{ fontWeight: 500, fontSize: 14 }}>Фильтры</span>
          </div>

          <Input
            prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
            placeholder="Поиск по названию или материалу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: '1 1 220px',
              minWidth: 180,
              maxWidth: 320,
              borderRadius: 8,
              height: 38,
            }}
            allowClear
          />

          <Select
            value={sortKey}
            onChange={(val) => setSortKey(val as SortKey)}
            style={{ width: 180, borderRadius: 8 }}
            options={[
              { value: 'popular', label: 'По популярности' },
              { value: 'price-asc', label: 'Цена: по возрастанию' },
              { value: 'price-desc', label: 'Цена: по убыванию' },
              { value: 'rating', label: 'По рейтингу' },
            ]}
          />

          <div style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 280 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
              Цена: {priceRange[0].toLocaleString('ru-RU')} ₽ — {priceRange[1].toLocaleString('ru-RU')} ₽
            </div>
            <Slider
              range
              min={0}
              max={10000}
              step={100}
              value={priceRange}
              onChange={(val) => setPriceRange(val as [number, number])}
              tooltip={{ formatter: (v) => `${v?.toLocaleString('ru-RU')} ₽` }}
              styles={{
                track: { background: '#2D2D2D' },
                handle: { borderColor: '#2D2D2D' },
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <Button
              type="text"
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('grid')}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: viewMode === 'grid' ? '#2D2D2D' : 'transparent',
                color: viewMode === 'grid' ? '#FFFFFF' : '#6B7280',
                border: viewMode === 'grid' ? 'none' : '1px solid #E8E8E8',
              }}
            />
            <Button
              type="text"
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode('list')}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: viewMode === 'list' ? '#2D2D2D' : 'transparent',
                color: viewMode === 'list' ? '#FFFFFF' : '#6B7280',
                border: viewMode === 'list' ? 'none' : '1px solid #E8E8E8',
              }}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 32,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              style={{
                padding: '8px 18px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeCategory === cat.key ? 600 : 400,
                background: activeCategory === cat.key ? '#2D2D2D' : '#F3F4F6',
                color: activeCategory === cat.key ? '#FFFFFF' : '#4B5563',
                transition: 'all 0.2s',
              }}
            >
              {cat.label}
              {cat.count > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    opacity: 0.7,
                  }}
                >
                  ({cat.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Product Grid / List */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#9CA3AF',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: '#4B5563', margin: '0 0 8px' }}>
              Ничего не найдено
            </h3>
            <p style={{ fontSize: 15, margin: 0 }}>
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </div>
        ) : (
          <div
            style={
              viewMode === 'grid'
                ? {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 24,
                  }
                : {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }
            }
          >
            {filtered.map((product, i) =>
              viewMode === 'grid' ? (
                <GridCard
                  key={product.id}
                  product={product}
                  index={i}
                  hovered={hoveredCard === product.id}
                  onHover={setHoveredCard}
                  onAddToCart={handleAddToCart}
                  onNavigate={() => navigate(`/product/${product.id}`)}
                />
              ) : (
                <ListCard
                  key={product.id}
                  product={product}
                  index={i}
                  onAddToCart={handleAddToCart}
                  onNavigate={() => navigate(`/product/${product.id}`)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Grid Card ─────────────────────────────────────────────────────────────── */

interface GridCardProps {
  product: PanelProduct;
  index: number;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onAddToCart: (e: React.MouseEvent, product: PanelProduct) => void;
  onNavigate: () => void;
}

function GridCard({ product, index, hovered, onHover, onAddToCart, onNavigate }: GridCardProps) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
    >
      <Card
        hoverable
        onClick={onNavigate}
        onMouseEnter={() => onHover(product.id)}
        onMouseLeave={() => onHover(null)}
        bodyStyle={{ padding: '16px' }}
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid #E8E8E8',
          cursor: 'pointer',
          transition: 'box-shadow 0.25s',
          boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.05)',
        }}
        cover={
          <div style={{ position: 'relative', height: 220, overflow: 'hidden', background: '#F5F5F5' }}>
            <img
              src={product.image}
              alt={product.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.35s ease',
                transform: hovered ? 'scale(1.06)' : 'scale(1)',
              }}
            />

            {/* Badge */}
            {product.badge && (
              <Tag
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  background: '#4CAF50',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11,
                  padding: '2px 8px',
                }}
              >
                {product.badge}
              </Tag>
            )}

            {/* Add to cart overlay button */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                opacity: hovered ? 1 : 0,
                transform: hovered ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.25s, transform 0.25s',
              }}
            >
              <Button
                onClick={(e) => onAddToCart(e, product)}
                style={{
                  background: '#2D2D2D',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  height: 36,
                  padding: '0 14px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                В корзину
              </Button>
            </div>
          </div>
        }
      >
        {/* Category & Material */}
        <div
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 6,
          }}
        >
          {product.categoryLabel} · {product.material}
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#1A1A1A',
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          {product.name}
        </div>

        {/* Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Rate
            disabled
            allowHalf
            value={product.rating}
            style={{ fontSize: 12, color: '#F59E0B' }}
          />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>({product.reviews})</span>
        </div>

        {/* Price + Color dots */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>
              {product.price.toLocaleString('ru-RU')} ₽
            </span>
            <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 4 }}>
              {product.priceUnit}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {product.colors.slice(0, 4).map((c) => (
              <div
                key={c.hex}
                title={c.name}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c.hex,
                  border: '1.5px solid #E5E7EB',
                  flexShrink: 0,
                }}
              />
            ))}
            {product.colors.length > 4 && (
              <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: '14px' }}>
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ─── List Card ─────────────────────────────────────────────────────────────── */

interface ListCardProps {
  product: PanelProduct;
  index: number;
  onAddToCart: (e: React.MouseEvent, product: PanelProduct) => void;
  onNavigate: () => void;
}

function ListCard({ product, index, onAddToCart, onNavigate }: ListCardProps) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
    >
      <div
        onClick={onNavigate}
        style={{
          display: 'flex',
          gap: 20,
          background: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'box-shadow 0.25s',
          padding: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', width: 140, flexShrink: 0 }}>
          <img
            src={product.image}
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              minHeight: 140,
            }}
          />
          {product.badge && (
            <Tag
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                background: '#4CAF50',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 8px',
              }}
            >
              {product.badge}
            </Tag>
          )}
        </div>

        {/* Info */}
        <div
          style={{
            flex: 1,
            padding: '16px 0 16px 4px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {product.categoryLabel} · {product.material}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
            {product.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Rate disabled allowHalf value={product.rating} style={{ fontSize: 12, color: '#F59E0B' }} />
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>({product.reviews})</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {product.colors.map((c) => (
              <div
                key={c.hex}
                title={c.name}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c.hex,
                  border: '1.5px solid #E5E7EB',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Price + CTA */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 12,
            padding: '16px 20px',
            flexShrink: 0,
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
              {product.price.toLocaleString('ru-RU')} ₽
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{product.priceUnit}</div>
          </div>
          <Button
            onClick={(e) => onAddToCart(e, product)}
            style={{
              background: '#2D2D2D',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              height: 38,
              padding: '0 18px',
              whiteSpace: 'nowrap',
            }}
          >
            В корзину
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
