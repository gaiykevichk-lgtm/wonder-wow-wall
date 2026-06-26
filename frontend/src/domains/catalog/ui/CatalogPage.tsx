import { useState, useMemo } from 'react';
import type { ComponentProps } from 'react';
import { Input, Skeleton } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { products as mockProducts } from '../model/data';
import { useDesigns } from '../api/catalogApi';
import { apiDesignToProduct } from '../api/adapters';
import type { PanelProduct } from '../model/types';

const appleEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

const fadeUpVariants: ComponentProps<typeof motion.div>['variants'] = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.06, ease: appleEase },
  }),
};

const SIZE_TABS = [
  { key: 'all', label: 'Все формы' },
  { key: 'cat-30x30', label: '30×30 см' },
  { key: 'cat-30x60', label: '30×60 см' },
  { key: 'cat-60x60', label: '60×60 см' },
] as const;

export default function CatalogPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sizeTab, setSizeTab] = useState<string>('all');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const { data: designsData, isLoading } = useDesigns({ limit: 50 });

  const products = useMemo(() => {
    if (designsData?.items) {
      return designsData.items.map(apiDesignToProduct);
    }
    return mockProducts;
  }, [designsData]);

  const filtered = useMemo(() => {
    let result = products;
    if (sizeTab !== 'all') {
      result = result.filter((p) => p.category === sizeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [products, search, sizeTab]);

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#FFFFFF' }}>
      <PageMeta
        title="Каталог форм"
        description="Выберите форму панели Wonder Wow Wall. Волна, гексагон, треугольник и другие дизайнерские формы."
      />

      {/* Hero */}
      <div style={{ background: '#F5F5F5', padding: '100px 40px 80px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 600,
              color: '#2D2D2D',
              margin: 0,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
            }}
          >
            Всё начинается с чистого холста.
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              fontSize: 19,
              color: '#6B7280',
              lineHeight: 1.5,
              maxWidth: 480,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Мы убрали цвет и фактуры, чтобы Вы увидели главное — форму.
            Текстуру и Характер мы добавим на следующем шаге.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 40px 80px' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 48,
          }}
        >
          <Input
            prefix={<SearchOutlined style={{ color: '#6B7280' }} />}
            placeholder="Поиск по названию формы..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{
              maxWidth: 400,
              width: '100%',
              borderRadius: 12,
              height: 44,
              border: '1px solid rgba(0,0,0,0.08)',
              fontSize: 15,
            }}
          />
        </div>

        {/* Size Tabs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 40,
            flexWrap: 'wrap',
          }}
        >
          {SIZE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSizeTab(tab.key)}
              style={{
                padding: '8px 20px',
                borderRadius: 100,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                transition: 'all 0.3s ease',
                background: sizeTab === tab.key ? '#2D2D2D' : '#F0F0F0',
                color: sizeTab === tab.key ? '#FFFFFF' : '#6B7280',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="catalog-forms-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  background: '#F5F5F5',
                }}
              >
                <Skeleton.Image
                  style={{ width: '100%', height: 280 }}
                  active
                />
                <div style={{ padding: '20px 16px' }}>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '100px 20px',
              color: '#6B7280',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>
              &#x1F50D;
            </div>
            <h3
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: '#2D2D2D',
                margin: '0 0 8px',
              }}
            >
              Ничего не найдено
            </h3>
            <p style={{ fontSize: 15, margin: 0 }}>
              Попробуйте изменить поисковый запрос
            </p>
          </div>
        ) : (
          <div className="catalog-forms-grid">
            {filtered.map((product, i) => (
              <FormCard
                key={product.id}
                product={product}
                index={i}
                hovered={hoveredCard === product.id}
                onHover={setHoveredCard}
                onNavigate={() => navigate(`/product/${product.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Form Card ──────────────────────────────────────────────────────────── */

interface FormCardProps {
  product: PanelProduct;
  index: number;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onNavigate: () => void;
}

function FormCard({ product, index, hovered, onHover, onNavigate }: FormCardProps) {
  const imageSrc = product.previewImage || product.image;

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      onClick={onNavigate}
      onMouseEnter={() => onHover(product.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        cursor: 'pointer',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#FAFAFA',
        transition: 'box-shadow 0.5s cubic-bezier(0.25, 0.1, 0.25, 1.0), transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        boxShadow: hovered
          ? '0 8px 30px rgba(0,0,0,0.08)'
          : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-4px) scale(1.015)' : 'translateY(0) scale(1)',
      }}
    >
      {/* Image */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '1',
          overflow: 'hidden',
          background: '#F0F0F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imageSrc}
          alt={product.name}
          loading="lazy"
          style={{
            width: '75%',
            height: '75%',
            objectFit: 'contain',
            transition: 'transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
            transform: hovered ? 'scale(1.06)' : 'scale(1)',
          }}
        />

        {/* Badge */}
        {product.badge && (
          <span
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              background:
                product.badge === 'Новинка' ? '#4CAF50' : '#2D2D2D',
              color: '#FFFFFF',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 12,
              padding: '4px 12px',
              letterSpacing: '0.01em',
            }}
          >
            {product.badge}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '20px 20px 24px' }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#2D2D2D',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            marginBottom: 6,
          }}
        >
          {product.name}
        </div>
        <div
          style={{
            fontSize: 15,
            color: '#6B7280',
            fontWeight: 400,
          }}
        >
          от {product.price.toLocaleString('ru-RU')} ₽
        </div>
      </div>
    </motion.div>
  );
}
