import React, { useState } from 'react';
import { Card, Button, Tag } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

// ─── Style constants ──────────────────────────────────────────────────────────

const GREEN = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1280, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: 'easeOut', delay: i * 0.1 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Purchase mode data ───────────────────────────────────────────────────────

const purchaseCategories = [
  { name: 'МДФ-панели', range: '1 700 — 3 200 ₽/м²', desc: 'Лёгкий монтаж, широкая палитра, идеально для квартир' },
  { name: '3D-гипс', range: '2 400 — 4 800 ₽/м²', desc: 'Фактурные поверхности, ручная работа, эксклюзивный вид' },
  { name: 'Деревянный шпон', range: '3 100 — 6 500 ₽/м²', desc: 'Натуральное дерево, тёплая атмосфера, долговечность' },
  { name: 'Каменный декор', range: '2 800 — 5 200 ₽/м²', desc: 'Имитация натурального камня, устойчивость к влаге' },
  { name: 'Акустические панели', range: '4 200 — 8 900 ₽/м²', desc: 'Поглощение звука, профессиональные студии и офисы' },
  { name: 'Монтаж (работа)', range: '600 — 1 200 ₽/м²', desc: 'Зависит от сложности и региона, включает вывоз мусора' },
];

// ─── Subscription plans ───────────────────────────────────────────────────────

const plans = [
  {
    name: 'Стартовый',
    area: '15 м²',
    price: 7000,
    period: 'мес',
    popular: false,
    features: [
      'До 15 м² обновления в месяц',
      'Все базовые коллекции',
      'Стандартный монтаж',
      'Доставка по Москве',
      'Поддержка 9:00–18:00',
      'Один активный проект',
    ],
    cta: 'Выбрать план',
  },
  {
    name: 'Популярный',
    area: '30 м²',
    price: 12000,
    period: 'мес',
    popular: true,
    features: [
      'До 30 м² обновления в месяц',
      'Все коллекции включая премиум',
      'Ускоренный монтаж (приоритет)',
      'Бесплатная доставка по РФ',
      'Поддержка 8:00–22:00',
      'До 3 активных проектов',
      'Персональный дизайнер',
    ],
    cta: 'Выбрать план',
  },
  {
    name: 'Бизнес',
    area: '50 м²',
    price: 18000,
    period: 'мес',
    popular: false,
    features: [
      'До 50 м² обновления в месяц',
      'Эксклюзивные и кастомные коллекции',
      'VIP-монтаж в удобное время',
      'Бесплатная доставка по всей РФ',
      'Поддержка 24/7',
      'Без ограничений на проекты',
      'Персональный менеджер',
      'Скидка 15% на доп. материалы',
    ],
    cta: 'Связаться с нами',
  },
];

// ─── PlanCard ─────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{ plan: typeof plans[0]; index: number }> = ({ plan, index }) => (
  <motion.div variants={fadeUp} custom={index} style={{ position: 'relative' }}>
    <Card
      style={{
        borderRadius: 20,
        border: plan.popular ? `2px solid ${DARK}` : '1px solid #E5E7EB',
        boxShadow: plan.popular ? '0 8px 40px rgba(0,0,0,0.12)' : 'none',
        background: plan.popular ? DARK : '#fff',
        height: '100%',
      }}
      styles={{ body: { padding: '36px 28px' } }}
    >
      {/* Popular badge */}
      {plan.popular && (
        <Tag
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: GREEN,
            color: '#fff',
            border: 'none',
            borderRadius: 20,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 12,
            padding: '4px 16px',
            whiteSpace: 'nowrap',
          }}
        >
          Популярный
        </Tag>
      )}

      {/* Plan name */}
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 700,
            color: plan.popular ? '#fff' : DARK,
            margin: '0 0 6px',
          }}
        >
          {plan.name}
        </h3>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: plan.popular ? 'rgba(255,255,255,0.65)' : GRAY_TEXT,
          }}
        >
          {plan.area} ежемесячного обновления
        </span>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 42,
              fontWeight: 800,
              color: plan.popular ? '#fff' : DARK,
              lineHeight: 1,
            }}
          >
            {plan.price.toLocaleString('ru-RU')} ₽
          </span>
        </div>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: plan.popular ? 'rgba(255,255,255,0.55)' : GRAY_TEXT,
          }}
        >
          / {plan.period}
        </span>
      </div>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {plan.features.map((feat) => (
          <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <CheckOutlined
              style={{
                color: plan.popular ? GREEN : GREEN,
                fontSize: 13,
                marginTop: 3,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: FONT,
                fontSize: 14,
                color: plan.popular ? 'rgba(255,255,255,0.85)' : DARK,
                lineHeight: 1.5,
              }}
            >
              {feat}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button
        size="large"
        style={{
          background: plan.popular ? GREEN : DARK,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          height: 50,
          width: '100%',
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        {plan.cta}
      </Button>
    </Card>
  </motion.div>
);

// ─── PricingPage ──────────────────────────────────────────────────────────────

const PricingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'purchase' | 'subscription'>('purchase');

  const tabBtn = (key: 'purchase' | 'subscription', label: string) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        background: activeTab === key ? DARK : 'transparent',
        color: activeTab === key ? '#fff' : DARK,
        border: `1.5px solid ${activeTab === key ? DARK : '#E5E7EB'}`,
        borderRadius: 10,
        padding: '10px 28px',
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 15,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ fontFamily: FONT, paddingTop: 72 }}>
      {/* Hero */}
      <section style={{ background: '#F5F5F5', padding: '80px 24px' }}>
        <div style={{ ...MAX_WIDTH, textAlign: 'center' }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                color: GRAY_TEXT,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Прозрачное ценообразование
            </motion.span>
            <motion.h1
              variants={fadeUp}
              custom={1}
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(36px, 4vw, 52px)',
                fontWeight: 800,
                color: DARK,
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: '-0.5px',
              }}
            >
              Тарифы и цены
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              style={{
                fontFamily: FONT,
                fontSize: 17,
                color: GRAY_TEXT,
                margin: 0,
                maxWidth: 520,
                lineHeight: 1.65,
              }}
            >
              Купите разово или подпишитесь для регулярного обновления интерьера —
              выберите формат, который подходит именно вам.
            </motion.p>

            {/* Tabs */}
            <motion.div
              variants={fadeUp}
              custom={3}
              style={{ display: 'flex', gap: 8, marginTop: 8 }}
            >
              {tabBtn('purchase', 'Покупка')}
              {tabBtn('subscription', 'Подписка')}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section style={{ background: '#fff', padding: '72px 24px 96px' }}>
        <div style={{ ...MAX_WIDTH }}>
          {activeTab === 'purchase' ? (
            <motion.div
              key="purchase"
              variants={stagger}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
            >
              <motion.div variants={fadeUp} custom={0}>
                <h2
                  style={{
                    fontFamily: FONT,
                    fontSize: 'clamp(24px, 2.5vw, 30px)',
                    fontWeight: 800,
                    color: DARK,
                    margin: '0 0 8px',
                  }}
                >
                  Цены на материалы и монтаж
                </h2>
                <p style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: 0 }}>
                  Окончательная стоимость рассчитывается в конструкторе с учётом вашей площади и выбранных панелей.
                </p>
              </motion.div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 20,
                }}
              >
                {purchaseCategories.map((cat, i) => (
                  <motion.div key={cat.name} variants={fadeUp} custom={i + 1}>
                    <Card
                      style={{
                        borderRadius: 14,
                        border: '1px solid #E5E7EB',
                        boxShadow: 'none',
                        height: '100%',
                      }}
                      styles={{ body: { padding: '24px' } }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <h3
                          style={{
                            fontFamily: FONT,
                            fontSize: 16,
                            fontWeight: 700,
                            color: DARK,
                            margin: 0,
                          }}
                        >
                          {cat.name}
                        </h3>
                        <div
                          style={{
                            fontFamily: FONT,
                            fontSize: 20,
                            fontWeight: 800,
                            color: DARK,
                          }}
                        >
                          {cat.range}
                        </div>
                        <p style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT, margin: 0, lineHeight: 1.6 }}>
                          {cat.desc}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <motion.div
                variants={fadeUp}
                custom={7}
                style={{
                  background: '#F5F5F5',
                  borderRadius: 14,
                  padding: '24px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: FONT,
                      fontSize: 15,
                      fontWeight: 600,
                      color: DARK,
                      margin: '0 0 4px',
                    }}
                  >
                    Нужен точный расчёт?
                  </p>
                  <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0 }}>
                    Используйте наш конструктор — введите размеры стен и получите итоговую смету.
                  </p>
                </div>
                <Button
                  size="large"
                  style={{
                    background: DARK,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    height: 48,
                    padding: '0 28px',
                    fontFamily: FONT,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Открыть конструктор
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="subscription"
              variants={stagger}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', gap: 48 }}
            >
              <motion.div variants={fadeUp} custom={0}>
                <h2
                  style={{
                    fontFamily: FONT,
                    fontSize: 'clamp(24px, 2.5vw, 30px)',
                    fontWeight: 800,
                    color: DARK,
                    margin: '0 0 8px',
                  }}
                >
                  Подписка на обновление интерьера
                </h2>
                <p style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: 0 }}>
                  Регулярно меняйте панели и обновляйте атмосферу без больших разовых затрат.
                </p>
              </motion.div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 24,
                  alignItems: 'start',
                }}
              >
                {plans.map((plan, i) => (
                  <PlanCard key={plan.name} plan={plan} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
