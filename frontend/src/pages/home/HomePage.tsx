import React from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Rate, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { products, categories, clientReviews } from '../../shared/data/products';

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUpVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut', delay: i * 0.12 },
  }),
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// ─── Shared style constants ───────────────────────────────────────────────────

const SECTION_PADDING: React.CSSProperties = { padding: '80px 24px' };
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1280, margin: '0 auto' };
const GREEN = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';

// ─── Hero Section ─────────────────────────────────────────────────────────────

const heroImages = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=600&fit=crop',
];

const HeroSection: React.FC<{ onCatalog: () => void; onConstructor: () => void }> = ({
  onCatalog,
  onConstructor,
}) => (
  <section
    style={{
      minHeight: '100vh',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      ...SECTION_PADDING,
    }}
  >
    <div
      style={{
        ...MAX_WIDTH,
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 64,
        alignItems: 'center',
      }}
      className="hero-grid"
    >
      {/* Left column */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
      >
        <motion.div variants={fadeUpVariants} custom={0}>
          <Tag
            style={{
              background: GREEN,
              color: '#fff',
              border: 'none',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            Новая коллекция 2026
          </Tag>
        </motion.div>

        <motion.h1
          variants={fadeUpVariants}
          custom={1}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(48px, 5vw, 64px)',
            fontWeight: 800,
            color: DARK,
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-1px',
          }}
        >
          Стены, которые вдохновляют
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          custom={2}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            color: GRAY_TEXT,
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 480,
          }}
        >
          Более 100&nbsp;000 вариантов оформления — от натурального дерева до
          3D-гипса. Профессиональный монтаж за 2&nbsp;часа с гарантией результата.
        </motion.p>

        <motion.div
          variants={fadeUpVariants}
          custom={3}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
        >
          <Button
            onClick={onCatalog}
            size="large"
            style={{
              background: DARK,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              height: 52,
              padding: '0 28px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Смотреть каталог
          </Button>
          <Button
            onClick={onConstructor}
            size="large"
            style={{
              background: 'transparent',
              color: DARK,
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              height: 52,
              padding: '0 28px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Открыть конструктор
          </Button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={fadeUpVariants}
          custom={4}
          style={{
            display: 'flex',
            gap: 36,
            borderTop: '1px solid #F3F4F6',
            paddingTop: 24,
            flexWrap: 'wrap',
          }}
        >
          {[
            { number: '200+', label: 'Дизайнов' },
            { number: '50K+', label: 'Клиентов' },
            { number: '4.9', label: 'Рейтинг' },
          ].map((stat) => (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 28,
                  fontWeight: 800,
                  color: DARK,
                }}
              >
                {stat.number}
              </span>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  color: GRAY_TEXT,
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Right column — 2×2 photo grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        {heroImages.map((src, i) => (
          <motion.div
            key={src}
            variants={fadeUpVariants}
            custom={i * 0.5}
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              overflow: 'hidden',
              aspectRatio: '1 / 1',
            }}
          >
            <img
              src={src}
              alt={`Панель ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

// ─── How It Works Section ─────────────────────────────────────────────────────

const steps = [
  {
    num: '1',
    title: 'Выберите дизайн',
    desc: 'Просмотрите каталог из 200+ уникальных дизайнов и подберите нужный стиль.',
  },
  {
    num: '2',
    title: 'Примерьте на стену',
    desc: 'Используйте наш 3D-конструктор для визуализации панелей в вашем интерьере.',
  },
  {
    num: '3',
    title: 'Оформите заказ',
    desc: 'Укажите размеры, выберите цвет и оформите заказ онлайн за несколько минут.',
  },
  {
    num: '4',
    title: 'Установим за 2 часа',
    desc: 'Наша команда приедет и профессионально установит панели с гарантией.',
  },
];

const HowItWorksSection: React.FC = () => (
  <section style={{ background: '#fff', ...SECTION_PADDING }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}
      >
        <motion.h2
          variants={fadeUpVariants}
          custom={0}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(32px, 3vw, 36px)',
            fontWeight: 800,
            color: DARK,
            margin: 0,
            textAlign: 'center',
          }}
        >
          Как это работает
        </motion.h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 32,
            width: '100%',
          }}
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              variants={fadeUpVariants}
              custom={i + 1}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: DARK,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 800,
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {step.num}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    color: DARK,
                  }}
                >
                  {step.title}
                </span>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    color: GRAY_TEXT,
                    lineHeight: 1.6,
                  }}
                >
                  {step.desc}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Categories Section ───────────────────────────────────────────────────────

const CategoriesSection: React.FC<{ onCategory: (key: string) => void }> = ({ onCategory }) => {
  const filtered = categories.filter((c) => c.key !== 'all');

  return (
    <section style={{ background: '#F5F5F5', ...SECTION_PADDING }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <motion.span
              variants={fadeUpVariants}
              custom={0}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                color: GRAY_TEXT,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Категории
            </motion.span>
            <motion.h2
              variants={fadeUpVariants}
              custom={1}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(32px, 3vw, 36px)',
                fontWeight: 800,
                color: DARK,
                margin: 0,
                textAlign: 'center',
              }}
            >
              Найдите свой стиль
            </motion.h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
              width: '100%',
            }}
          >
            {filtered.map((cat, i) => (
              <motion.div
                key={cat.key}
                variants={fadeUpVariants}
                custom={i * 0.1 + 2}
                whileHover={{ translateY: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
                onClick={() => onCategory(cat.key)}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: '3 / 4',
                }}
              >
                <img
                  src={cat.image}
                  alt={cat.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    left: 14,
                    right: 14,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#fff',
                  }}
                >
                  {cat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Popular Products Section ─────────────────────────────────────────────────

const PopularProductsSection: React.FC<{ onProduct: (id: string) => void; onAllProducts: () => void }> = ({
  onProduct,
  onAllProducts,
}) => {
  const popular = products.slice(0, 4);

  return (
    <section style={{ background: '#fff', ...SECTION_PADDING }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
        >
          {/* Header */}
          <motion.div
            variants={fadeUpVariants}
            custom={0}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(32px, 3vw, 36px)',
                fontWeight: 800,
                color: DARK,
                margin: 0,
              }}
            >
              Популярные дизайны
            </h2>
            <button
              onClick={onAllProducts}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 15,
                fontWeight: 600,
                color: DARK,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Все дизайны →
            </button>
          </motion.div>

          {/* Product grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 24,
            }}
          >
            {popular.map((product, i) => (
              <motion.div
                key={product.id}
                variants={fadeUpVariants}
                custom={i * 0.1 + 1}
                whileHover={{ translateY: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.1)' }}
                onClick={() => onProduct(product.id)}
                style={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#fff',
                  transition: 'box-shadow 0.2s',
                }}
              >
                {/* Photo area */}
                <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {product.badge && (
                    <Tag
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        background: GREEN,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: 12,
                        padding: '2px 10px',
                      }}
                    >
                      {product.badge}
                    </Tag>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: '16px 16px 20px' }}>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12,
                      color: GRAY_TEXT,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    {product.categoryLabel}
                  </span>
                  <div
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 16,
                      color: DARK,
                      marginTop: 6,
                      marginBottom: 8,
                    }}
                  >
                    {product.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Rate
                      disabled
                      defaultValue={product.rating}
                      allowHalf
                      style={{ fontSize: 12, color: '#F59E0B' }}
                    />
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 12,
                        color: GRAY_TEXT,
                      }}
                    >
                      ({product.reviews})
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: 18,
                        color: DARK,
                      }}
                    >
                      {product.price.toLocaleString('ru-RU')} ₽
                      <span
                        style={{ fontWeight: 400, fontSize: 13, color: GRAY_TEXT, marginLeft: 3 }}
                      >
                        {product.priceUnit}
                      </span>
                    </span>

                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {product.colors.slice(0, 4).map((c) => (
                        <div
                          key={c.hex}
                          title={c.name}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: c.hex,
                            border: '1.5px solid #E5E7EB',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Calculator CTA Section ───────────────────────────────────────────────────

const CalculatorCTASection: React.FC<{ onConstructor: () => void }> = ({ onConstructor }) => (
  <section style={{ background: '#F5F5F5', ...SECTION_PADDING }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        custom={0}
        style={{
          border: '1px solid #E5E7EB',
          borderRadius: 16,
          background: '#fff',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          padding: '48px 56px',
          alignItems: 'center',
        }}
        className="cta-calc-grid"
      >
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(28px, 2.5vw, 34px)',
              fontWeight: 800,
              color: DARK,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Рассчитайте стоимость
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 16,
              color: GRAY_TEXT,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Укажите площадь стен, выберите панели — и получите точную стоимость
            с учётом монтажа за несколько секунд.
          </p>
          <Button
            onClick={onConstructor}
            size="large"
            style={{
              background: DARK,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              height: 52,
              padding: '0 28px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 15,
              width: 'fit-content',
            }}
          >
            Открыть калькулятор
          </Button>
        </div>

        {/* Right — price examples visual */}
        <div
          style={{
            background: '#F9FAFB',
            borderRadius: 12,
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {[
            { label: 'Прихожая ~8 м²', price: '13 600 ₽' },
            { label: 'Спальня ~16 м²', price: '27 200 ₽' },
            { label: 'Гостиная ~24 м²', price: '40 800 ₽' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: 14,
              }}
            >
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  color: GRAY_TEXT,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  color: DARK,
                }}
              >
                {item.price}
              </span>
            </div>
          ))}
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              color: '#9CA3AF',
            }}
          >
            * Примерная стоимость материалов. Точный расчёт — в конструкторе.
          </span>
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Client Reviews Section ───────────────────────────────────────────────────

const ReviewsSection: React.FC = () => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <section style={{ background: '#fff', ...SECTION_PADDING }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
        >
          <motion.h2
            variants={fadeUpVariants}
            custom={0}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(32px, 3vw, 36px)',
              fontWeight: 800,
              color: DARK,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Отзывы клиентов
          </motion.h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 24,
            }}
          >
            {clientReviews.map((review, i) => (
              <motion.div
                key={review.id}
                variants={fadeUpVariants}
                custom={i * 0.1 + 1}
                whileHover={{ translateY: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  padding: '24px',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {/* Author row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: DARK,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(review.author)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: 15,
                        color: DARK,
                      }}
                    >
                      {review.author}
                    </span>
                    <Rate
                      disabled
                      defaultValue={review.rating}
                      style={{ fontSize: 12, color: '#F59E0B' }}
                    />
                  </div>
                </div>

                {/* Review text */}
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    color: '#374151',
                    margin: 0,
                    lineHeight: 1.65,
                    flex: 1,
                  }}
                >
                  {review.text}
                </p>

                {/* Date */}
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12,
                    color: '#9CA3AF',
                  }}
                >
                  {formatDate(review.date)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── CTA Banner Section ───────────────────────────────────────────────────────

const CTABannerSection: React.FC<{ onCatalog: () => void; onContact: () => void }> = ({
  onCatalog,
  onContact,
}) => (
  <section style={{ background: '#fff', ...SECTION_PADDING }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        custom={0}
        className="cta-banner-inner"
        style={{
          background: DARK,
          borderRadius: 16,
          padding: '64px 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 'clamp(32px, 3vw, 40px)',
            fontWeight: 800,
            color: '#fff',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Готовы преобразить ваши стены?
        </h2>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 17,
            color: '#9CA3AF',
            margin: 0,
            maxWidth: 520,
            lineHeight: 1.6,
          }}
        >
          Выберите дизайн из нашего каталога или свяжитесь с нами для индивидуального
          проекта — мы поможем создать интерьер мечты.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            onClick={onCatalog}
            size="large"
            style={{
              background: GREEN,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              height: 52,
              padding: '0 32px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Смотреть каталог
          </Button>
          <Button
            onClick={onContact}
            size="large"
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 10,
              height: 52,
              padding: '0 32px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Связаться с нами
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Main HomePage Component ──────────────────────────────────────────────────

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleCatalog = () => navigate('/catalog');
  const handleConstructor = () => navigate('/constructor');
  const handleCategory = (key: string) => navigate(`/catalog?category=${key}`);
  const handleProduct = (id: string) => navigate(`/product/${id}`);
  const handleContact = () => navigate('/contacts');

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <HeroSection onCatalog={handleCatalog} onConstructor={handleConstructor} />
      <HowItWorksSection />
      <CategoriesSection onCategory={handleCategory} />
      <PopularProductsSection onProduct={handleProduct} onAllProducts={handleCatalog} />
      <CalculatorCTASection onConstructor={handleConstructor} />
      <ReviewsSection />
      <CTABannerSection onCatalog={handleCatalog} onContact={handleContact} />

      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .hero-grid .hero-images { order: -1; }
          .cta-calc-grid { grid-template-columns: 1fr !important; padding: 28px 20px !important; }
          .cta-banner-inner { padding: 36px 20px !important; }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
