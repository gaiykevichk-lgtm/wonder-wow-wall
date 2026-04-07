import React, { useState } from 'react';
import { Card, Button, Tag } from 'antd';
import { CheckOutlined, ArrowRightOutlined, CrownOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../model/subscriptionStore';

const BLUE = '#0071e3';
const DARK = '#1d1d1f';
const GRAY_TEXT = '#86868b';
const FONT = 'Inter, sans-serif';
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1080, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.48, ease: [0.25, 0.1, 0.25, 1.0], delay: i * 0.1 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const panelPricing = [
  { size: '30×30 см', basePrice: BASE_PANEL_PRICES['300x300'], overlayPrice: DESIGN_OVERLAY_PRICE, desc: 'Компактная панель — идеально для акцентов и небольших зон' },
  { size: '30×60 см', basePrice: BASE_PANEL_PRICES['300x600'], overlayPrice: DESIGN_OVERLAY_PRICE, desc: 'Самый популярный размер — баланс эстетики и покрытия' },
  { size: '60×60 см', basePrice: BASE_PANEL_PRICES['600x600'], overlayPrice: DESIGN_OVERLAY_PRICE, desc: 'Крупный формат — для максимального эффекта, меньше стыков' },
];

// ─── PlanCard ────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{
  plan: (typeof SUBSCRIPTION_PLANS)[0];
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
}> = ({ plan, index, isActive, onSelect }) => (
  <motion.div variants={fadeUp} custom={index} style={{ position: 'relative' }}>
    <Card
      style={{
        borderRadius: 20,
        border: plan.popular ? `2px solid ${DARK}` : isActive ? `2px solid ${BLUE}` : '1px solid rgba(0,0,0,0.04)',
        boxShadow: 'none',
        background: plan.popular ? DARK : '#fff',
        height: '100%',
        transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      }}
      styles={{ body: { padding: '36px 28px' } }}
    >
      {plan.popular && (
        <Tag style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: BLUE, color: '#fff', border: 'none', borderRadius: 980, fontFamily: FONT, fontWeight: 600, fontSize: 12, padding: '4px 16px', whiteSpace: 'nowrap' }}>
          Популярный
        </Tag>
      )}
      {isActive && (
        <Tag icon={<CrownOutlined />} style={{ position: 'absolute', top: -14, right: 16, background: BLUE, color: '#fff', border: 'none', borderRadius: 980, fontFamily: FONT, fontWeight: 600, fontSize: 12, padding: '4px 12px' }}>
          Ваш план
        </Tag>
      )}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: FONT, fontSize: 20, fontWeight: 600, color: plan.popular ? '#fff' : DARK, margin: '0 0 6px' }}>{plan.name}</h3>
        <span style={{ fontFamily: FONT, fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.65)' : GRAY_TEXT }}>{plan.desc}</span>
      </div>

      <div style={{ marginBottom: 28 }}>
        <span style={{ fontFamily: FONT, fontSize: 42, fontWeight: 600, color: plan.popular ? '#fff' : DARK, lineHeight: 1 }}>
          {plan.price.toLocaleString('ru-RU')} ₽
        </span>
        <span style={{ fontFamily: FONT, fontSize: 14, color: plan.popular ? 'rgba(255,255,255,0.55)' : GRAY_TEXT, marginLeft: 4 }}>
          / {plan.period}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {plan.features.map((feat) => (
          <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <CheckOutlined style={{ color: BLUE, fontSize: 13, marginTop: 3, flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontSize: 14, color: plan.popular ? 'rgba(255,255,255,0.85)' : DARK, lineHeight: 1.5 }}>{feat}</span>
          </div>
        ))}
      </div>

      <Button
        size="large"
        onClick={() => onSelect(plan.id)}
        disabled={isActive}
        style={{
          background: isActive ? '#E8E8E8' : plan.popular ? BLUE : DARK,
          color: isActive ? GRAY_TEXT : '#fff',
          border: 'none',
          borderRadius: 980,
          height: 50,
          width: '100%',
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        {isActive ? 'Текущий план' : 'Выбрать план'}
      </Button>
    </Card>
  </motion.div>
);

// ─── PricingPage ─────────────────────────────────────────────────────────────

const PricingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'purchase' | 'subscription'>('purchase');
  const navigate = useNavigate();
  const { openModal, activePlanId, hasSubscription, getActivePlan, cancelSubscription } = useSubscriptionStore();

  const tabBtn = (key: 'purchase' | 'subscription', label: string) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        background: activeTab === key ? DARK : 'transparent',
        color: activeTab === key ? '#fff' : DARK,
        border: `1.5px solid ${activeTab === key ? DARK : 'rgba(0,0,0,0.04)'}`,
        borderRadius: 980,
        padding: '10px 28px',
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 15,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ fontFamily: FONT, paddingTop: 72 }}>
      {/* Hero */}
      <section style={{ background: '#F5F5F7', padding: '120px 24px' }}>
        <div style={{ ...MAX_WIDTH, textAlign: 'center' }}>
          <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <motion.span variants={fadeUp} custom={0} style={{ fontSize: 12, fontWeight: 600, color: GRAY_TEXT, textTransform: 'uppercase', letterSpacing: '2px' }}>
              Прозрачное ценообразование
            </motion.span>
            <motion.h1 variants={fadeUp} custom={1} style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 600, color: DARK, margin: 0, lineHeight: 1.15 }}>
              Панели + Накладки
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} style={{ fontSize: 17, color: GRAY_TEXT, margin: 0, maxWidth: 560, lineHeight: 1.65 }}>
              Базовая панель крепится на стену. Сверху — магнитная накладка с любым дизайном.
              Стоимость всех дизайнов одинакова: {DESIGN_OVERLAY_PRICE.toLocaleString('ru-RU')} ₽ за накладку.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {tabBtn('purchase', 'Покупка')}
              {tabBtn('subscription', 'Подписка')}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Active subscription banner */}
      {hasSubscription() && (
        <section style={{ background: BLUE, padding: '16px 24px' }}>
          <div style={{ ...MAX_WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
              <CrownOutlined style={{ fontSize: 18 }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                Активная подписка: {getActivePlan()?.name} — накладки включены в план
              </span>
            </div>
            <Button
              size="small"
              onClick={cancelSubscription}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 980, fontWeight: 500 }}
            >
              Отменить подписку
            </Button>
          </div>
        </section>
      )}

      {/* Content */}
      <section style={{ background: '#fff', padding: '120px 24px' }}>
        <div style={{ ...MAX_WIDTH }}>
          {activeTab === 'purchase' ? (
            <motion.div key="purchase" variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              <motion.div variants={fadeUp} custom={0}>
                <h2 style={{ fontSize: 'clamp(24px, 2.5vw, 30px)', fontWeight: 600, color: DARK, margin: '0 0 8px' }}>
                  Как формируется цена
                </h2>
                <p style={{ fontSize: 15, color: GRAY_TEXT, margin: 0, maxWidth: 600 }}>
                  Стоимость = панель + накладка. Панель покупается один раз. Накладки можно менять сколько угодно.
                </p>
              </motion.div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {panelPricing.map((item, i) => (
                  <motion.div key={item.size} variants={fadeUp} custom={i + 1}>
                    <Card style={{ borderRadius: 20, border: '1px solid rgba(0,0,0,0.04)', height: '100%' }} styles={{ body: { padding: '28px' } }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <h3 style={{ fontSize: 22, fontWeight: 600, color: DARK, margin: 0 }}>{item.size}</h3>
                        <p style={{ fontSize: 13, color: GRAY_TEXT, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                        <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                            <span style={{ color: GRAY_TEXT }}>Базовая панель:</span>
                            <span style={{ fontWeight: 600, color: DARK }}>{item.basePrice.toLocaleString('ru-RU')} ₽</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                            <span style={{ color: GRAY_TEXT }}>Накладка (любой дизайн):</span>
                            <span style={{ fontWeight: 600, color: DARK }}>
                              {hasSubscription() ? (
                                <><span style={{ textDecoration: 'line-through', color: '#9CA3AF', marginRight: 6 }}>{item.overlayPrice.toLocaleString('ru-RU')} ₽</span><span style={{ color: BLUE }}>0 ₽ (подписка)</span></>
                              ) : (
                                <>{item.overlayPrice.toLocaleString('ru-RU')} ₽</>
                              )}
                            </span>
                          </div>
                          <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                            <span style={{ fontWeight: 600, color: DARK }}>Итого:</span>
                            <span style={{ fontWeight: 600, color: DARK }}>
                              {(item.basePrice + (hasSubscription() ? 0 : item.overlayPrice)).toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: BLUE, fontWeight: 500 }}>
                          {hasSubscription()
                            ? 'Накладки включены в вашу подписку!'
                            : `Замена накладки — только ${item.overlayPrice.toLocaleString('ru-RU')} ₽`}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <motion.div variants={fadeUp} custom={5} style={{ background: DARK, borderRadius: 20, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>Рассчитайте стоимость вашей стены</p>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Используйте конструктор — укажите размеры, выберите дизайн, получите точную смету.</p>
                </div>
                <Button size="large" icon={<ArrowRightOutlined />} onClick={() => navigate('/constructor')} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 980, height: 48, padding: '0 28px', fontWeight: 600, flexShrink: 0 }}>
                  Открыть конструктор
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} custom={6} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  { title: 'Единая цена дизайна', text: 'Любая накладка — одна цена. Никаких сюрпризов.' },
                  { title: 'Магнитное крепление', text: 'Смена дизайна за 5 минут без инструментов.' },
                  { title: 'Монтаж за 2 часа', text: 'Профессиональная установка базовых панелей.' },
                  { title: '100+ дизайнов', text: 'Дерево, камень, абстракция, геометрия и другие.' },
                ].map((item) => (
                  <div key={item.title} style={{ padding: '20px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.04)' }}>
                    <h4 style={{ fontSize: 15, fontWeight: 600, color: DARK, margin: '0 0 6px' }}>{item.title}</h4>
                    <p style={{ fontSize: 13, color: GRAY_TEXT, margin: 0, lineHeight: 1.5 }}>{item.text}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="subscription" variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
              <motion.div variants={fadeUp} custom={0}>
                <h2 style={{ fontSize: 'clamp(24px, 2.5vw, 30px)', fontWeight: 600, color: DARK, margin: '0 0 8px' }}>
                  Подписка на обновление накладок
                </h2>
                <p style={{ fontSize: 15, color: GRAY_TEXT, margin: 0, maxWidth: 600 }}>
                  Базовые панели покупаются один раз. По подписке вы регулярно получаете новые накладки — меняйте дизайн когда захотите.
                </p>
              </motion.div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
                {SUBSCRIPTION_PLANS.map((plan, i) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    index={i}
                    isActive={activePlanId === plan.id}
                    onSelect={(id) => openModal(id)}
                  />
                ))}
              </div>

              <motion.div variants={fadeUp} custom={4} style={{ background: '#F5F5F7', borderRadius: 20, padding: '24px 28px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: DARK, margin: '0 0 12px' }}>Как работает подписка?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    '1. Установите базовые панели на стену (разовая покупка)',
                    '2. Выберите план подписки исходя из количества накладок',
                    '3. Каждый месяц получайте новые накладки с любым дизайном',
                    '4. Меняйте накладки самостоятельно за 5 минут — магнитное крепление',
                    '5. Отмена подписки в любой момент без штрафов',
                  ].map((step) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: DARK }}>
                      <CheckOutlined style={{ color: BLUE, fontSize: 12, flexShrink: 0 }} />
                      {step}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
