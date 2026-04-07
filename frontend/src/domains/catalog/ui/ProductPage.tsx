import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Skeleton } from 'antd';
import { ShoppingCartOutlined, HeartOutlined, LeftOutlined } from '@ant-design/icons';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { products as mockProducts } from '../model/data';
import { useDesign, useDesigns } from '../api/catalogApi';
import { apiDesignToProduct } from '../api/adapters';
import { useCartStore } from '../../order/model/cartStore';

const ease = [0.25, 0.1, 0.25, 1.0] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease, delay },
  }),
};

/* ─── Stepper ─────────────────────────────────────────────── */
function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#E8E8ED', borderRadius: 980, padding: 4 }}>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: value <= 1 ? 'transparent' : '#fff', cursor: 'pointer', fontSize: 18, color: '#1d1d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 400, lineHeight: 1, transition: 'background 0.2s' }}
      >−</button>
      <span style={{ width: 40, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#1d1d1f' }}>{value}</span>
      <button
        onClick={() => onChange(Math.min(100, value + 1))}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, color: '#1d1d1f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 400, lineHeight: 1, transition: 'background 0.2s' }}
      >+</button>
    </div>
  );
}

/* ─── Feature tile ────────────────────────────────────────── */
function FeatureTile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      style={{ background: '#F5F5F7', borderRadius: 24, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontSize: 21, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</div>
      <div style={{ fontSize: 15, color: '#86868b', lineHeight: 1.6 }}>{body}</div>
    </motion.div>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, setOpen: setCartOpen } = useCartStore();

  const { data: apiDesign, isLoading, isError } = useDesign(id || '');
  const { data: allDesigns } = useDesigns();

  const product = useMemo(() => {
    if (apiDesign) return apiDesignToProduct(apiDesign);
    return mockProducts.find((p) => p.id === id);
  }, [apiDesign, id]);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [liked, setLiked] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => {
    setStickyVisible(y > 480);
  });

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    if (allDesigns?.items) {
      return allDesigns.items
        .filter((d) => d.category_id === product.category && d.id !== product.id)
        .slice(0, 3)
        .map(apiDesignToProduct);
    }
    return mockProducts
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 3);
  }, [allDesigns, product]);

  /* ─── Loading ─── */
  if (isLoading && !isError && !product) {
    return (
      <div style={{ paddingTop: 72, background: '#fff', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
          <Skeleton.Image style={{ width: '100%', height: 560, borderRadius: 28 }} active />
          <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 32 }} />
        </div>
      </div>
    );
  }

  /* ─── Not found ─── */
  if (!product) {
    return (
      <div style={{ paddingTop: 72, background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontSize: 64 }}>🔍</div>
        <h2 style={{ fontSize: 28, fontWeight: 600, color: '#1d1d1f', margin: 0 }}>Товар не найден</h2>
        <button
          onClick={() => navigate('/catalog')}
          style={{ background: '#0071e3', color: '#fff', border: 'none', height: 50, borderRadius: 980, fontWeight: 600, fontSize: 16, padding: '0 28px', cursor: 'pointer' }}
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const gallery = [product.image, ...product.gallery];
  const totalPrice = (product.price * quantity).toLocaleString('ru-RU');

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

  const features = [
    {
      icon: '✦',
      title: 'Премиальные материалы',
      body: `${product.specs['Материал'] ?? 'Полимер с УФ-печатью'} — насыщенный цвет и реалистичная фактура, которые не выцветают годами.`,
    },
    {
      icon: '🧲',
      title: 'Магнитный монтаж',
      body: `${product.specs['Монтаж'] ?? 'Магнитное крепление'} — никаких инструментов. Снимается и меняется за секунды.`,
    },
    {
      icon: '📐',
      title: 'Точный размер',
      body: `${product.sizes.length} вариантов размера под любое помещение. Толщина накладки — ${product.specs['Толщина накладки'] ?? '3 мм'}.`,
    },
  ];

  return (
    <div style={{ paddingTop: 72, background: '#fff', minHeight: '100vh' }}>

      {/* ── Sticky buy bar ──────────────────────────────── */}
      <AnimatePresence>
        {stickyVisible && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            style={{
              position: 'fixed',
              top: 52,
              left: 0,
              right: 0,
              zIndex: 900,
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ maxWidth: 1080, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f' }}>{product.name}</div>
                <div style={{ fontSize: 13, color: '#86868b' }}>{product.price.toLocaleString('ru-RU')} ₽{product.priceUnit}</div>
              </div>
              <button
                onClick={handleAddToCart}
                style={{ background: '#0071e3', color: '#fff', border: 'none', height: 40, borderRadius: 980, fontWeight: 600, fontSize: 14, padding: '0 22px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Добавить в корзину
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Breadcrumb ───────────────────────────────────── */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#0071e3', fontSize: 14, fontWeight: 500, padding: 0 }}
          >
            <LeftOutlined style={{ fontSize: 11 }} /> Назад
          </button>
          <span style={{ color: '#d2d2d7', fontSize: 14 }}>·</span>
          <span style={{ color: '#86868b', fontSize: 14, cursor: 'pointer' }} onClick={() => navigate('/catalog')}>Каталог</span>
          <span style={{ color: '#d2d2d7', fontSize: 14 }}>·</span>
          <span style={{ color: '#1d1d1f', fontSize: 14, fontWeight: 500 }}>{product.name}</span>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section ref={heroRef} style={{ textAlign: 'center', padding: '56px 24px 0', maxWidth: 780, margin: '0 auto' }}>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0}
          style={{ fontSize: 13, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}
        >
          {product.categoryLabel} · {product.material}
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0.1}
          style={{ fontSize: 'clamp(48px, 8vw, 80px)', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.03em', lineHeight: 1.0, margin: '0 0 20px' }}
        >
          {product.name}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0.2}
          style={{ fontSize: 19, color: '#86868b', lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 560 }}
        >
          {product.description}
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0.25}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 28 }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <svg key={s} width="16" height="16" viewBox="0 0 20 20" fill={s <= Math.round(product.rating) ? '#FBBF24' : '#E5E7EB'}>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span style={{ fontSize: 14, color: '#86868b', marginLeft: 4 }}>{product.rating} ({product.reviews} отзывов)</span>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0.3}
          style={{ fontSize: 36, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em', marginBottom: 28 }}
        >
          {product.price.toLocaleString('ru-RU')} ₽
          <span style={{ fontSize: 17, color: '#86868b', fontWeight: 400, marginLeft: 6 }}>{product.priceUnit}</span>
        </motion.div>

        {product.badge && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.32} style={{ display: 'inline-flex', alignItems: 'center', background: '#0071e3', color: '#fff', borderRadius: 980, padding: '4px 14px', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            {product.badge}
          </motion.div>
        )}

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0.35}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 4 }}
        >
          <button
            onClick={handleAddToCart}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0071e3', color: '#fff', border: 'none', height: 54, borderRadius: 980, fontWeight: 600, fontSize: 17, padding: '0 32px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0077ED')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0071e3')}
          >
            <ShoppingCartOutlined style={{ fontSize: 18 }} /> Добавить в корзину
          </button>
          <button
            onClick={() => setLiked((v) => !v)}
            style={{ width: 54, height: 54, borderRadius: '50%', border: '1.5px solid #E8E8ED', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, transition: 'border-color 0.2s', color: liked ? '#FF3B30' : '#1d1d1f' }}
          >
            {liked ? '♥' : <HeartOutlined />}
          </button>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, color: '#34C759', fontSize: 14, fontWeight: 600 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="#34C759"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          В наличии
        </motion.div>
      </section>

      {/* ── Product image ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.0, ease, delay: 0.5 }}
        style={{ margin: '48px auto 0', maxWidth: 1080, padding: '0 24px' }}
      >
        <div style={{ background: '#F5F5F7', borderRadius: 32, overflow: 'hidden', position: 'relative' }}>
          <motion.img
            key={selectedImage}
            src={gallery[selectedImage]}
            alt={product.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease }}
            style={{ width: '100%', height: 540, objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* Thumbnail strip */}
        {gallery.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {gallery.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                style={{
                  width: 72, height: 72, borderRadius: 14, overflow: 'hidden', border: 'none',
                  outline: selectedImage === idx ? '2px solid #0071e3' : '2px solid transparent',
                  outlineOffset: 2, cursor: 'pointer', padding: 0, transition: 'outline 0.25s',
                }}
              >
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Configuration ─────────────────────────────────── */}
      <section style={{ background: '#F5F5F7', marginTop: 80, padding: '64px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          {/* Color */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            style={{ marginBottom: 48, textAlign: 'center' }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Выберите цвет</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', marginBottom: 20 }}>{product.colors[selectedColor].name}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              {product.colors.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedColor(idx)}
                  title={color.name}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', background: color.hex, border: 'none', cursor: 'pointer',
                    outline: selectedColor === idx ? `3px solid ${color.hex}` : '3px solid transparent',
                    outlineOffset: 3,
                    boxShadow: selectedColor === idx ? '0 0 0 5px rgba(0,0,0,0.08)' : '0 0 0 1px rgba(0,0,0,0.12)',
                    transition: 'outline 0.25s, box-shadow 0.25s',
                    transform: selectedColor === idx ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Size */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            style={{ marginBottom: 48, textAlign: 'center' }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>Размер</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {product.sizes.map((size, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSize(idx)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 980,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1.5px solid',
                    borderColor: selectedSize === idx ? '#0071e3' : '#D1D5DB',
                    background: selectedSize === idx ? '#0071e3' : '#FFFFFF',
                    color: selectedSize === idx ? '#FFFFFF' : '#1d1d1f',
                    transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  }}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Quantity + total */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: 20, padding: '24px 32px' }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#86868b', fontWeight: 500, marginBottom: 10 }}>Количество (м²)</div>
              <Stepper value={quantity} onChange={setQuantity} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#86868b', fontWeight: 500, marginBottom: 4 }}>Итого</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em' }}>{totalPrice} ₽</div>
            </div>
          </motion.div>

          {/* Final CTA */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            style={{ marginTop: 24, textAlign: 'center' }}
          >
            <button
              onClick={handleAddToCart}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: '#0071e3', color: '#fff', border: 'none',
                height: 56, borderRadius: 980, fontWeight: 600, fontSize: 17,
                padding: '0 40px', cursor: 'pointer', transition: 'background 0.2s, transform 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0077ED'; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0071e3'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <ShoppingCartOutlined style={{ fontSize: 20 }} /> Добавить в корзину
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── In The Wild ───────────────────────────────────── */}
      {product.usageExamples && product.usageExamples.length > 0 && (
        <section style={{ maxWidth: 1080, margin: '96px auto 0', padding: '0 24px' }}>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            style={{ marginBottom: 48 }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              В интерьере
            </div>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0 }}>
              {product.name}<br />в реальных пространствах.
            </h2>
          </motion.div>

          {/* Layout: first image large, rest in 2-col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Hero image (first example) */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              style={{ position: 'relative', borderRadius: 28, overflow: 'hidden', cursor: 'default' }}
            >
              <div style={{ overflow: 'hidden', borderRadius: 28 }}>
                <motion.img
                  src={product.usageExamples[0].image}
                  alt={product.usageExamples[0].room}
                  whileHover={{ scale: 1.03 }}
                  transition={{ duration: 0.8, ease }}
                  style={{ width: '100%', height: 520, objectFit: 'cover', display: 'block' }}
                />
              </div>
              {/* Dark gradient overlay */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 28,
                background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 45%, transparent 100%)',
                pointerEvents: 'none',
              }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 40px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 980, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                  color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12,
                }}>
                  {product.usageExamples[0].room}
                </div>
                <p style={{ fontSize: 21, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em', maxWidth: 560 }}>
                  {product.usageExamples[0].caption}
                </p>
              </div>
            </motion.div>

            {/* Remaining images in 2-col grid */}
            {product.usageExamples.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {product.usageExamples.slice(1).map((ex, idx) => (
                  <motion.div
                    key={idx}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.2 }}
                    style={{ position: 'relative', borderRadius: 24, overflow: 'hidden' }}
                  >
                    <div style={{ overflow: 'hidden', borderRadius: 24 }}>
                      <motion.img
                        src={ex.image}
                        alt={ex.room}
                        whileHover={{ scale: 1.04 }}
                        transition={{ duration: 0.8, ease }}
                        style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 24,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
                      pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 28px' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)', borderRadius: 980, padding: '4px 12px',
                        fontSize: 11, fontWeight: 600, color: '#fff', letterSpacing: '0.04em',
                        textTransform: 'uppercase', marginBottom: 10,
                      }}>
                        {ex.room}
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 500, color: '#fff', margin: 0, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                        {ex.caption}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Feature tiles ─────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '96px auto 0', padding: '0 24px' }}>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Почему Wonder Wow</div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Сделано для вашего дома
          </h2>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {features.map((f) => (
            <FeatureTile key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ── Full-width feature banner ──────────────────────── */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        style={{ maxWidth: 1080, margin: '32px auto 0', padding: '0 24px' }}
      >
        <div
          style={{
            borderRadius: 32, overflow: 'hidden', position: 'relative', height: 420,
            background: `linear-gradient(135deg, #1d1d1f 0%, #3a3a3c 100%)`,
            display: 'flex', alignItems: 'center',
          }}
        >
          <img
            src={product.image}
            alt={product.name}
            style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '55%', objectFit: 'cover', objectPosition: 'center', opacity: 0.5 }}
          />
          <div style={{ position: 'relative', zIndex: 1, padding: '0 56px', maxWidth: 460 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Класс {product.specs['Класс'] ?? 'Премиум'}
            </div>
            <h3 style={{ fontSize: 40, fontWeight: 700, color: '#fff', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 20 }}>
              {product.name}.<br />Настоящий стиль.
            </h3>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 28 }}>
              Реалистичная фактура, уход влажной уборкой, магнитный монтаж — всё, что нужно для безупречного интерьера.
            </p>
            <button
              onClick={handleAddToCart}
              style={{ background: '#fff', color: '#1d1d1f', border: 'none', height: 48, borderRadius: 980, fontWeight: 600, fontSize: 15, padding: '0 24px', cursor: 'pointer' }}
            >
              Купить
            </button>
          </div>
        </div>
      </motion.section>

      {/* ── Specs ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 780, margin: '96px auto 0', padding: '0 24px' }}>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em', marginBottom: 32, textAlign: 'center' }}>
            Характеристики
          </h2>
          <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
            {Object.entries(product.specs).map(([key, value], idx, arr) => (
              <div
                key={key}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '18px 24px',
                  borderBottom: idx < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  background: idx % 2 === 0 ? '#fff' : '#FBFBFD',
                }}
              >
                <span style={{ fontSize: 15, color: '#86868b', fontWeight: 500 }}>{key}</span>
                <span style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Related products ──────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section style={{ maxWidth: 1080, margin: '96px auto 0', padding: '0 24px 120px' }}>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.02em', marginBottom: 32 }}>
              Похожие дизайны
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {relatedProducts.map((related) => (
                <motion.div
                  key={related.id}
                  whileHover={{ y: -6, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}
                  transition={{ duration: 0.4, ease }}
                  onClick={() => navigate(`/product/${related.id}`)}
                  style={{ borderRadius: 24, overflow: 'hidden', cursor: 'pointer', background: '#F5F5F7' }}
                >
                  <img
                    src={related.image}
                    alt={related.name}
                    style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ padding: '16px 20px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                      {related.categoryLabel}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', marginBottom: 8 }}>
                      {related.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1f' }}>
                        {related.price.toLocaleString('ru-RU')} ₽
                      </span>
                      <span style={{ fontSize: 13, color: '#86868b' }}>{related.priceUnit}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ── Bottom rooms ──────────────────────────────────── */}
      {product.room.length > 0 && (
        <div style={{ background: '#F5F5F7', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#86868b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
            Подходит для
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
            {product.room.map((r) => (
              <span
                key={r}
                style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 980, padding: '8px 18px', fontSize: 14, fontWeight: 500, color: '#1d1d1f' }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
