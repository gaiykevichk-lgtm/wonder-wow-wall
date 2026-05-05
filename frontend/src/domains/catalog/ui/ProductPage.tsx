import { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Skeleton, Rate, Input, Button } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import { LeftOutlined, StarFilled, UserOutlined, CameraOutlined, LayoutOutlined } from '@ant-design/icons';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { products as mockProducts } from '../model/data';
import { useDesign, useDesigns, useDesignReviews, useAddReview, usePublicRecommendations, useFullConfig } from '../api/catalogApi';
import { apiDesignToProduct, apiReviewToReview } from '../api/adapters';
import { useCartStore } from '../../order/model/cartStore';
import { useAuthStore } from '../../auth/model/authStore';
import ProductPreview from './ProductPreview';
import ConfiguratorPanel from './ConfiguratorPanel';
import FormSwitcher from './FormSwitcher';

const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease, delay },
  }),
};

function FeatureTile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      style={{ background: '#F5F5F5', borderRadius: 24, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontSize: 21, fontWeight: 600, color: '#2D2D2D', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</div>
      <div style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6 }}>{body}</div>
    </motion.div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: apiDesign, isLoading, isError } = useDesign(id || '');
  const { data: fullConfig, isLoading: configLoading } = useFullConfig(id || '');
  const { data: allDesigns } = useDesigns({ limit: 200 });
  const { data: reviewsData, isLoading: reviewsLoading } = useDesignReviews(id || '');
  const addReviewMutation = useAddReview(id || '');
  const isAuth = useAuthStore((s) => s.isAuth);

  const reviews = useMemo(() => {
    return reviewsData ? reviewsData.map(apiReviewToReview) : [];
  }, [reviewsData]);

  const product = useMemo(() => {
    if (apiDesign) return apiDesignToProduct(apiDesign);
    return mockProducts.find((p) => p.id === id);
  }, [apiDesign, id]);

  const [variantImage, setVariantImage] = useState<string | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 5;

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => {
    setStickyVisible(y > 480);
  });

  const handleVariantImageChange = useCallback((path: string | null) => {
    setVariantImage(path);
  }, []);

  // Phase 10 — recommendations
  const { data: recsData } = usePublicRecommendations({
    sourceType: 'design',
    sourceId: id || '',
    limit: 3,
    enabled: !!id,
  });

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    if (recsData?.items?.length && allDesigns?.items) {
      const byId = new Map(allDesigns.items.map((d) => [d.id, d]));
      const mapped = recsData.items
        .filter((t) => t.target_type === 'design')
        .map((t) => byId.get(t.target_id))
        .filter((d): d is NonNullable<typeof d> => !!d)
        .slice(0, 3)
        .map(apiDesignToProduct);
      if (mapped.length > 0) return mapped;
    }
    if (allDesigns?.items) {
      return allDesigns.items
        .filter((d) => d.category_id === product.category && d.id !== product.id)
        .slice(0, 3)
        .map(apiDesignToProduct);
    }
    return mockProducts
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 3);
  }, [recsData, allDesigns, product]);

  const otherForms = useMemo(() => {
    if (!allDesigns?.items) return [];
    return allDesigns.items.map(apiDesignToProduct);
  }, [allDesigns]);

  /* ─── Loading ─── */
  if (isLoading && !isError && !product) {
    return (
      <div style={{ paddingTop: 72, background: '#fff', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
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
        <h2 style={{ fontSize: 28, fontWeight: 600, color: '#2D2D2D', margin: 0 }}>Товар не найден</h2>
        <button
          onClick={() => navigate('/catalog')}
          style={{ background: '#4CAF50', color: '#fff', border: 'none', height: 50, borderRadius: 8, fontWeight: 600, fontSize: 16, padding: '0 28px', cursor: 'pointer' }}
        >
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const features = [
    {
      icon: '✦',
      title: 'Премиальные материалы',
      body: `${product.specs['Материал'] ?? 'Полимер с УФ-печатью'} — насыщенный цвет и реалистичная фактура, которые не выцветают годами.`,
    },
    {
      icon: '🔒',
      title: 'Крепление на клипсах',
      body: `${product.specs['Монтаж'] ?? 'Крепление на клипсах'} — никаких инструментов. Снимается и меняется за секунды.`,
    },
    {
      icon: '📐',
      title: 'Точный размер',
      body: `${product.sizes.length} вариантов размера под любое помещение. Толщина накладки — ${product.specs['Толщина накладки'] ?? '3 мм'}.`,
    },
  ];

  return (
    <div style={{ paddingTop: 72, background: '#fff', minHeight: '100vh' }}>
      <PageMeta title={product.name} description={product.description} ogImage={product.image} />

      {/* ── Sticky buy bar ──────────────────────────────── */}
      <AnimatePresence>
        {stickyVisible && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            style={{
              position: 'fixed', top: 52, left: 0, right: 0, zIndex: 900,
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D' }}>{product.name}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>от {product.price.toLocaleString('ru-RU')} ₽</div>
              </div>
              <a
                href="#configurator"
                style={{ background: '#4CAF50', color: '#fff', textDecoration: 'none', height: 40, borderRadius: 8, fontWeight: 600, fontSize: 14, padding: '0 22px', display: 'inline-flex', alignItems: 'center' }}
              >
                Конфигурировать
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Breadcrumb ───────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#4CAF50', fontSize: 14, fontWeight: 500, padding: 0 }}
          >
            <LeftOutlined style={{ fontSize: 11 }} /> Назад
          </button>
          <span style={{ color: '#E5E7EB', fontSize: 14 }}>·</span>
          <span style={{ color: '#6B7280', fontSize: 14, cursor: 'pointer' }} onClick={() => navigate('/catalog')}>Каталог</span>
          <span style={{ color: '#E5E7EB', fontSize: 14 }}>·</span>
          <span style={{ color: '#2D2D2D', fontSize: 14, fontWeight: 500 }}>{product.name}</span>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section ref={heroRef} style={{ textAlign: 'center', padding: '40px 24px 0', maxWidth: 780, margin: '0 auto' }}>
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0}
          style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}
        >
          {product.categoryLabel} · {product.material}
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="show" custom={0.1}
          style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.03em', lineHeight: 1.0, margin: '0 0 16px' }}
        >
          {product.name}
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="show" custom={0.2}
          style={{ fontSize: 18, color: '#6B7280', lineHeight: 1.6, margin: '0 auto 20px', maxWidth: 560 }}
        >
          {product.description}
        </motion.p>

        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0.25}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <svg key={s} width="16" height="16" viewBox="0 0 20 20" fill={s <= Math.round(product.rating) ? '#FBBF24' : '#E5E7EB'}>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span style={{ fontSize: 14, color: '#6B7280', marginLeft: 4 }}>{product.rating} ({product.reviews} отзывов)</span>
        </motion.div>

        {product.badge && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.28} style={{ display: 'inline-flex', alignItems: 'center', background: '#4CAF50', color: '#fff', borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {product.badge}
          </motion.div>
        )}

        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={0.3}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
        >
          <button
            onClick={() => navigate(`/visualizer?designId=${id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#2D2D2D', border: '1.5px solid #E5E7EB', height: 44, borderRadius: 8, fontWeight: 600, fontSize: 14, padding: '0 20px', cursor: 'pointer', transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#2D2D2D')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <CameraOutlined style={{ fontSize: 15 }} /> Примерить на фото
          </button>
          <button
            onClick={() => navigate(`/constructor?designId=${id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#2D2D2D', border: '1.5px solid #E5E7EB', height: 44, borderRadius: 8, fontWeight: 600, fontSize: 14, padding: '0 20px', cursor: 'pointer', transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#2D2D2D')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            <LayoutOutlined style={{ fontSize: 15 }} /> Примерить в конструкторе
          </button>
        </motion.div>
      </section>

      {/* ── Configurator Section (Preview + Panel) ──────── */}
      <section
        id="configurator"
        className="configurator-grid"
        style={{
          maxWidth: 1200,
          margin: '56px auto 0',
          padding: '0 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gap: 48,
          alignItems: 'start',
        }}
      >
        {/* Left: Product Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.0, ease, delay: 0.4 }}
          style={{ position: 'sticky', top: 120 }}
        >
          <ProductPreview
            imagePath={variantImage}
            fallbackImage={product.image}
            altText={product.name}
            isLoading={configLoading}
          />
        </motion.div>

        {/* Right: Configurator Panel */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.5 }}
        >
          {fullConfig ? (
            <ConfiguratorPanel
              config={fullConfig}
              designId={id || ''}
              designImage={product.image}
              onVariantImageChange={handleVariantImageChange}
            />
          ) : configLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <Skeleton active paragraph={{ rows: 2 }} />
              <Skeleton active paragraph={{ rows: 2 }} />
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ) : (
            /* No textures configured — show legacy size-only selector */
            <ConfiguratorFallback product={product} designId={id || ''} />
          )}

          {/* Other forms */}
          <div style={{ marginTop: 32 }}>
            <FormSwitcher
              forms={otherForms}
              currentId={id || ''}
              onSelect={(formId) => navigate(`/product/${formId}`)}
            />
          </div>
        </motion.div>
      </section>

      {/* ── In The Wild ───────────────────────────────────── */}
      {product.usageExamples && product.usageExamples.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '96px auto 0', padding: '0 24px' }}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>В интерьере</div>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0 }}>
              {product.name}<br />в реальных пространствах.
            </h2>
          </motion.div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <UsageHero ex={product.usageExamples[0]} />
            {product.usageExamples.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {product.usageExamples.slice(1).map((ex, idx) => (
                  <UsageCard key={idx} ex={ex} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Feature tiles ─────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: '96px auto 0', padding: '0 24px' }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Почему Wonder Wow</div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
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
        variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
        style={{ maxWidth: 1200, margin: '32px auto 0', padding: '0 24px' }}
      >
        <div style={{
          borderRadius: 32, overflow: 'hidden', position: 'relative', height: 420,
          background: 'linear-gradient(135deg, #2D2D2D 0%, #3a3a3c 100%)',
          display: 'flex', alignItems: 'center',
        }}>
          <img src={product.image} alt={product.name} style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '55%', objectFit: 'cover', objectPosition: 'center', opacity: 0.5 }} />
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
            <a
              href="#configurator"
              style={{ background: '#fff', color: '#2D2D2D', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', height: 48, borderRadius: 8, fontWeight: 600, fontSize: 15, padding: '0 24px' }}
            >
              Выбрать
            </a>
          </div>
        </div>
      </motion.section>

      {/* ── Specs ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 780, margin: '96px auto 0', padding: '0 24px' }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.02em', marginBottom: 32, textAlign: 'center' }}>Характеристики</h2>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
            {Object.entries(product.specs).map(([key, value], idx, arr) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '18px 24px',
                borderBottom: idx < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                background: idx % 2 === 0 ? '#fff' : '#FAFAFA',
              }}>
                <span style={{ fontSize: 15, color: '#6B7280', fontWeight: 500 }}>{key}</span>
                <span style={{ fontSize: 15, color: '#2D2D2D', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Reviews ────────────────────────────────────────── */}
      <section style={{ maxWidth: 780, margin: '96px auto 0', padding: '0 24px' }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.02em', marginBottom: 8, textAlign: 'center' }}>Отзывы</h2>
          <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <StarFilled style={{ color: '#FF9500', fontSize: 18 }} />
            <span style={{ fontSize: 17, fontWeight: 600, color: '#2D2D2D' }}>{product.rating.toFixed(1)}</span>
            <span style={{ fontSize: 15, color: '#6B7280' }}>({product.reviews} {pluralReviews(product.reviews)})</span>
          </div>

          {reviewsLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#6B7280', fontSize: 15 }}>
              Пока нет отзывов. Будьте первым!
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {reviews.slice(0, reviewsPage * REVIEWS_PER_PAGE).map((review) => (
                  <div key={review.id} style={{ background: '#F5F5F5', borderRadius: 16, padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E8E8ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserOutlined style={{ color: '#6B7280', fontSize: 16 }} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D' }}>{review.author}</span>
                      </div>
                      <span style={{ fontSize: 13, color: '#6B7280' }}>{new Date(review.date).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarFilled key={star} style={{ fontSize: 14, color: star <= review.rating ? '#FF9500' : '#E8E8ED' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 15, color: '#2D2D2D', lineHeight: 1.5 }}>{review.text}</div>
                  </div>
                ))}
              </div>
              {reviews.length > reviewsPage * REVIEWS_PER_PAGE && (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <Button type="link" onClick={() => setReviewsPage((p) => p + 1)} style={{ fontSize: 15, fontWeight: 600, color: '#0066CC' }}>
                    Показать ещё
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Add review form */}
          <div style={{ marginTop: 32, background: '#F5F5F5', borderRadius: 16, padding: '24px 28px' }}>
            {isAuth ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#2D2D2D', marginBottom: 16 }}>Оставить отзыв</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 6 }}>Оценка</div>
                  <Rate value={reviewRating} onChange={setReviewRating} style={{ fontSize: 24 }} />
                </div>
                <Input.TextArea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Расскажите о вашем опыте…"
                  rows={3} maxLength={500}
                  style={{ borderRadius: 12, resize: 'none', marginBottom: 12, border: '1px solid rgba(0,0,0,0.1)' }}
                />
                <Button
                  type="primary" loading={addReviewMutation.isPending}
                  disabled={!reviewText.trim() || reviewRating < 1}
                  onClick={() => {
                    addReviewMutation.mutate(
                      { rating: reviewRating, text: reviewText.trim() },
                      {
                        onSuccess: () => { setReviewText(''); setReviewRating(5); message.success('Отзыв добавлен!'); },
                        onError: () => { message.error('Не удалось отправить отзыв'); },
                      },
                    );
                  }}
                  style={{ borderRadius: 8, height: 44, padding: '0 32px', fontWeight: 600, fontSize: 15 }}
                >
                  Отправить
                </Button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Авторизуйтесь, чтобы оставить отзыв</div>
                <Button type="primary" onClick={() => navigate('/auth')} style={{ borderRadius: 8, height: 40, padding: '0 28px', fontWeight: 600 }}>
                  Войти
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Related products ──────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '96px auto 0', padding: '0 24px 120px' }}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D', letterSpacing: '-0.02em', marginBottom: 32 }}>Похожие дизайны</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {relatedProducts.map((related) => (
                <motion.div
                  key={related.id}
                  whileHover={{ y: -6, boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}
                  transition={{ duration: 0.4, ease }}
                  onClick={() => navigate(`/product/${related.id}`)}
                  style={{ borderRadius: 24, overflow: 'hidden', cursor: 'pointer', background: '#F5F5F5' }}
                >
                  <img src={related.image} alt={related.name} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '16px 20px 20px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{related.categoryLabel}</div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#2D2D2D', marginBottom: 8 }}>{related.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#2D2D2D' }}>{related.price.toLocaleString('ru-RU')} ₽</span>
                      <span style={{ fontSize: 13, color: '#6B7280' }}>{related.priceUnit}</span>
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
        <div style={{ background: '#F5F5F5', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Подходит для</div>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
            {product.room.map((r) => (
              <span key={r} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '8px 18px', fontSize: 14, fontWeight: 500, color: '#2D2D2D' }}>{r}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────── */

function pluralReviews(n: number): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return 'отзывов';
  if (d === 1) return 'отзыв';
  if (d >= 2 && d <= 4) return 'отзыва';
  return 'отзывов';
}

function ConfiguratorFallback({ product, designId }: { product: { name: string; image: string; price: number; colors: { hex: string; name: string }[]; sizes: { width: number; height: number; label: string }[] }; designId: string }) {
  const { addItem, setOpen: setCartOpen } = useCartStore();
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);

  const handleAdd = () => {
    const color = product.colors[selectedColor];
    const size = product.sizes[selectedSize];
    const sizeKey = size ? `${size.width}x${size.height}` : 'default';
    addItem({
      id: `${designId}-default-${color ? 'legacy-' + selectedColor : 'default'}-${sizeKey}`,
      productId: designId,
      name: product.name,
      image: product.image,
      price: product.price,
      area: 1,
      color: color?.hex ?? '',
      colorName: color?.name ?? '',
      sizeKey,
      size: size?.label ?? '',
    });
    message.success('Товар добавлен в корзину');
    setCartOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {product.colors.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Цвет</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            {product.colors.map((color, idx) => (
              <button
                key={idx} onClick={() => setSelectedColor(idx)}
                style={{
                  width: 42, height: 42, borderRadius: '50%', background: color.hex, border: 'none', cursor: 'pointer',
                  outline: selectedColor === idx ? `3px solid ${color.hex}` : '3px solid transparent',
                  outlineOffset: 3, transition: 'outline 0.25s',
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Размер</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          {product.sizes.map((size, idx) => (
            <button key={idx} onClick={() => setSelectedSize(idx)}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid', borderColor: selectedSize === idx ? '#4CAF50' : '#D1D5DB',
                background: selectedSize === idx ? '#4CAF50' : '#FFFFFF', color: selectedSize === idx ? '#FFFFFF' : '#2D2D2D',
              }}
            >{size.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F5F5', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D' }}>{product.price.toLocaleString('ru-RU')} ₽</div>
      </div>
      <button onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#4CAF50', color: '#fff', border: 'none', height: 54, borderRadius: 12, fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }}>
        В корзину
      </button>
    </div>
  );
}

function UsageHero({ ex }: { ex: { room: string; image: string; caption: string } }) {
  const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} style={{ position: 'relative', borderRadius: 28, overflow: 'hidden' }}>
      <div style={{ overflow: 'hidden', borderRadius: 28 }}>
        <motion.img src={ex.image} alt={ex.room} whileHover={{ scale: 1.03 }} transition={{ duration: 0.8, ease }} style={{ width: '100%', height: 520, objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 28, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 45%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>{ex.room}</div>
        <p style={{ fontSize: 21, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em', maxWidth: 560 }}>{ex.caption}</p>
      </div>
    </motion.div>
  );
}

function UsageCard({ ex }: { ex: { room: string; image: string; caption: string } }) {
  const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} style={{ position: 'relative', borderRadius: 24, overflow: 'hidden' }}>
      <div style={{ overflow: 'hidden', borderRadius: 24 }}>
        <motion.img src={ex.image} alt={ex.room} whileHover={{ scale: 1.04 }} transition={{ duration: 0.8, ease }} style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 24, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.08) 50%, transparent 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>{ex.room}</div>
        <p style={{ fontSize: 16, fontWeight: 500, color: '#fff', margin: 0, lineHeight: 1.4, letterSpacing: '-0.01em' }}>{ex.caption}</p>
      </div>
    </motion.div>
  );
}
