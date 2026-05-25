import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, InputNumber } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import {
  AppstoreOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  SearchOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  SettingOutlined,
  LockOutlined,
  DesktopOutlined,
  WifiOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { products } from '../../catalog/model/data';

// ─── Animation variants ───────────────────────────────────────────────────────

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

const fadeUpVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: APPLE_EASE, delay: i * 0.12 },
  }),
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// ─── Shared style constants ───────────────────────────────────────────────────

const SECTION_PADDING: React.CSSProperties = { padding: '100px 24px' };
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1200, margin: '0 auto' };
const ACCENT = '#4CAF50';
const ACCENT_DARK = '#2E7D32';
const DARK = '#1D1D1F';
const GRAY_TEXT = '#6E6E73';
const LIGHT_BG = '#F5F5F7';
const SUBTLE_BORDER = 'rgba(0,0,0,0.06)';
const CARD_RADIUS = 20;
const PILL_RADIUS = 10;

// ─── Hero Section ────────────────────────────────────────────────────────────────

const HeroSection: React.FC<{ onCatalog: () => void }> = ({ onCatalog }) => (
  <section
    style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      ...SECTION_PADDING,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        ...MAX_WIDTH,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        gap: 32,
      }}
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}
      >
        <motion.div variants={fadeUpVariants} custom={0}>
          <span
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: GRAY_TEXT,
              textTransform: 'uppercase',
              letterSpacing: '3px',
            }}
          >
            Дизайн-платформа для стен
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUpVariants}
          custom={1}
          style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            color: DARK,
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: 800,
          }}
        >
          Ремонт окончен.{' '}
          <span style={{ color: ACCENT_DARK }}>
            Начинается свобода.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          custom={2}
          style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 'clamp(17px, 2vw, 20px)',
            color: GRAY_TEXT,
            margin: 0,
            lineHeight: 1.65,
            maxWidth: 560,
          }}
        >
          Новый интерьер – в один клик.
          <br />
          WONDER WOW WALL – первая платформа трансформации пространства.
        </motion.p>

        <motion.div
          variants={fadeUpVariants}
          custom={3}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <Button
            onClick={onCatalog}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: PILL_RADIUS,
              height: 56,
              padding: '0 44px',
              fontFamily: "'SF Pro Display', sans-serif",
              fontWeight: 600,
              fontSize: 17,
              boxShadow: 'none',
              letterSpacing: '-0.01em',
            }}
          >
            выбрать свой WOW!
          </Button>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

// ─── Step Icons (Ant Design) ───────────────────────────────────────────────────

const stepIcons: Record<string, React.ReactNode> = {
  '1': <SearchOutlined style={{ fontSize: 28 }} />,
  '2': <CameraOutlined style={{ fontSize: 28 }} />,
  '3': <ClockCircleOutlined style={{ fontSize: 28 }} />,
  '4': <SwapOutlined style={{ fontSize: 28 }} />,
};

const StepIcon: React.FC<{ num: string; hovered?: boolean }> = ({ num, hovered }) => {
  return (
    <div style={{
      width: 72,
      height: 72,
      borderRadius: 20,
      background: hovered ? '#E8F5E9' : LIGHT_BG,
      color: hovered ? ACCENT_DARK : DARK,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.4s ease',
    }}>
      {stepIcons[num] || stepIcons['1']}
    </div>
  );
};

// ─── How It Works Section ─────────────────────────────────────────────────────

const steps = [
  {
    num: '1',
    title: 'Выбираете',
    desc: 'Найдите текстуру, которая отражает Вас сегодня',
  },
  {
    num: '2',
    title: 'Примеряете',
    desc: 'Загрузите фото и приложение мгновенно впишет новый интерьер в Ваше пространство',
  },
  {
    num: '3',
    title: 'Обновляете',
    desc: 'Мы превратили обновление интерьера в вопрос нескольких часов',
  },
  {
    num: '4',
    title: 'Меняете',
    desc: 'Одна бесплатная замена уже включена в подписку',
  },
];

const HowItWorksSection: React.FC = () => {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  return (
    <section style={{ background: '#fff', ...SECTION_PADDING }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}
        >
          <motion.div variants={fadeUpVariants} custom={0} style={{ textAlign: 'center' }}>
            <span style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: GRAY_TEXT,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              display: 'block',
              marginBottom: 12,
            }}>
              Платформа трансформации
            </span>
            <h2
              style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontSize: 'clamp(32px, 3.5vw, 44px)',
                fontWeight: 700,
                color: DARK,
                margin: 0,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
              }}
            >
              Просто. Быстро. WOW
            </h2>
          </motion.div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 24,
              width: '100%',
            }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                variants={fadeUpVariants}
                custom={i + 1}
                whileHover={{
                  translateY: -4,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
                  transition: { duration: 0.5, ease: APPLE_EASE },
                }}
                onHoverStart={() => setHoveredStep(step.num)}
                onHoverEnd={() => setHoveredStep(null)}
                style={{
                  borderRadius: CARD_RADIUS,
                  overflow: 'hidden',
                  background: '#fff',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  transition: `box-shadow 0.5s cubic-bezier(${APPLE_EASE.join(',')})`,
                  border: `1px solid ${SUBTLE_BORDER}`,
                }}
              >
                <div style={{
                  height: 160,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: LIGHT_BG,
                  transition: 'background 0.4s ease',
                }}>
                  <StepIcon num={step.num} hovered={hoveredStep === step.num} />
                </div>
                <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontWeight: 700,
                      fontSize: 18,
                      color: DARK,
                    }}
                  >
                    {step.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
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
};

// ─── Service Banner Section — "Стены как сервис" (Слайд 3) ──────────────────

const ServiceBannerSection: React.FC = () => (
  <section style={{ background: '#fff', padding: '100px 24px', overflow: 'hidden' }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        custom={0}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 20,
          position: 'relative',
        }}
      >
        <motion.div variants={fadeUpVariants} custom={1}>
          <span style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: GRAY_TEXT,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            display: 'block',
            marginBottom: 12,
          }}>
            Впервые в индустрии
          </span>
        </motion.div>

        <motion.h2 variants={fadeUpVariants} custom={2} style={{
          fontFamily: "'SF Pro Display', sans-serif",
          fontSize: 'clamp(40px, 6vw, 80px)',
          fontWeight: 700,
          color: DARK,
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
        }}>
          Стены как сервис
        </motion.h2>

        <motion.p variants={fadeUpVariants} custom={3} style={{
          fontFamily: "'SF Pro Display', sans-serif",
          fontSize: 18,
          color: GRAY_TEXT,
          margin: 0,
          lineHeight: 1.65,
          maxWidth: 520,
        }}>
          Мы создали будущее, в котором интерьер меняется без традиционного ремонта
        </motion.p>

        <motion.div variants={fadeUpVariants} custom={4} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 8,
        }}>
          <span style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: DARK,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            WONDER WOW WALL
          </span>
          <span style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 13,
            color: GRAY_TEXT,
          }}>
            —
          </span>
          <span style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 13,
            color: GRAY_TEXT,
          }}>
            новый стандарт трансформации пространства
          </span>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

// ─── Tech Section — "Технологии Вашей свободы" (Слайд 4) ───────────────────

const techPoints = [
  {
    icon: <SettingOutlined style={{ fontSize: 28, color: DARK }} />,
    title: 'Универсальная платформа монтажа',
    desc: 'Адаптирована для любых поверхностей — бетон, кирпич, дерево, плитка.',
  },
  {
    icon: <LockOutlined style={{ fontSize: 28, color: DARK }} />,
    title: 'Запатентованная система креплений',
    desc: 'Обеспечивает быструю замену без повреждения стены.',
  },
  {
    icon: <AppstoreOutlined style={{ fontSize: 28, color: DARK }} />,
    title: 'Безграничность фактур',
    desc: 'Формируйте пространство под любой стиль — от минимализма до лофта.',
  },
];

const TechSection: React.FC = () => (
  <section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}
      >
        <motion.div variants={fadeUpVariants} custom={0} style={{ textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: 'clamp(32px, 3.5vw, 44px)',
              fontWeight: 700,
              color: DARK,
              margin: 0,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            Технологии Вашей свободы
          </h2>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
            width: '100%',
          }}
          className="tech-grid"
        >
          {techPoints.map((point, i) => (
            <motion.div
              key={point.title}
              variants={fadeUpVariants}
              custom={i + 1}
              style={{
                background: '#fff',
                borderRadius: CARD_RADIUS,
                padding: '40px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: `1px solid ${SUBTLE_BORDER}`,
              }}
            >
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: LIGHT_BG,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {point.icon}
              </div>
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
                lineHeight: 1.3,
              }}>
                {point.title}
              </span>
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontSize: 14,
                color: GRAY_TEXT,
                lineHeight: 1.6,
              }}>
                {point.desc}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.p
          variants={fadeUpVariants}
          custom={4}
          style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 16,
            color: GRAY_TEXT,
            margin: 0,
            textAlign: 'center',
            maxWidth: 480,
          }}
        >
          Вы сами решаете, о чём сегодня говорят Ваши стены
        </motion.p>
      </motion.div>
    </div>
  </section>
);

// ─── Panel Grid Section — 4 панели чистый визуал (Слайд 5) ──────────────────

const PanelGridSection: React.FC<{ onCatalog: () => void }> = ({ onCatalog }) => {
  const first4 = products.slice(0, 4);

  return (
    <section style={{ background: '#fff', ...SECTION_PADDING }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}
        >
          <motion.div variants={fadeUpVariants} custom={0} style={{ textAlign: 'center' }}>
            <h2
              style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontSize: 'clamp(32px, 3.5vw, 44px)',
                fontWeight: 700,
                color: DARK,
                margin: 0,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
              }}
            >
              Время выбирать
            </h2>
          </motion.div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(first4.length, 4)}, minmax(200px, 280px))`,
              gap: 20,
              width: '100%',
              justifyContent: 'center',
            }}
            className="panel-grid"
          >
            {first4.map((product, i) => (
              <motion.div
                key={product.id}
                variants={fadeUpVariants}
                custom={i + 1}
                style={{
                  borderRadius: CARD_RADIUS,
                  overflow: 'hidden',
                  aspectRatio: '3 / 4',
                  position: 'relative',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '20px 16px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#fff',
                      display: 'block',
                    }}
                  >
                    {product.name}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div variants={fadeUpVariants} custom={5}>
            <Button
              onClick={onCatalog}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: PILL_RADIUS,
                height: 56,
                padding: '0 40px',
                fontFamily: "'SF Pro Display', sans-serif",
                fontWeight: 600,
                fontSize: 16,
                boxShadow: 'none',
                letterSpacing: '-0.01em',
              }}
            >
              выбрать свой WOW!
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Life Scenarios (for ProjectDetailsSection) ──────────────────────────────

const lifeScenarios = [
  { icon: <DesktopOutlined style={{ fontSize: 28, color: DARK }} />, label: 'Гостиная' },
  { icon: <AppstoreOutlined style={{ fontSize: 28, color: DARK }} />, label: 'Спальня' },
  { icon: <CameraOutlined style={{ fontSize: 28, color: DARK }} />, label: 'Зона ТВ' },
  { icon: <ExperimentOutlined style={{ fontSize: 28, color: DARK }} />, label: 'Детская' },
  { icon: <ThunderboltOutlined style={{ fontSize: 28, color: DARK }} />, label: 'Кухня' },
  { icon: <WifiOutlined style={{ fontSize: 28, color: DARK }} />, label: 'WC' },
];

// ─── Project Details Section — калькулятор + сценарии (Слайд 6) ─────────────

const ProjectDetailsSection: React.FC = () => {
  const navigate = useNavigate();
  const [height, setHeight] = useState<number | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const [calcResult, setCalcResult] = useState<{ area: number; panels: number; price: number } | null>(null);

  const handleCalculate = async () => {
    if (!height || !length) return;
    try {
      const res = await fetch('/api/quick-calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ height_m: height, length_m: length }),
      });
      if (!res.ok) throw new Error('Calculation failed');
      const data = await res.json();
      setCalcResult({ area: data.wall_area, panels: data.panels_estimate, price: data.price_from });
    } catch (err) {
      console.error('quick-calculate error:', err);
    }
  };

  return (
    <section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          custom={0}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}
        >
          <h2 style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: 'clamp(32px, 3.5vw, 44px)',
            fontWeight: 700,
            color: DARK,
            margin: 0,
            letterSpacing: '-0.03em',
            textAlign: 'center',
          }}>
            Ваш проект. В деталях
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 32,
              width: '100%',
            }}
            className="project-grid"
          >
            {/* Блок 1: Калькулятор */}
            <motion.div
              variants={fadeUpVariants}
              custom={1}
              style={{
                background: '#fff',
                borderRadius: CARD_RADIUS,
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: `1px solid ${SUBTLE_BORDER}`,
              }}
            >
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}>
                Точный расчёт
              </span>
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontSize: 13,
                color: GRAY_TEXT,
                lineHeight: 1.6,
              }}>
                Введите параметры Вашей стены и система определит необходимое количество панелей
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ fontFamily: "'SF Pro Display'", fontSize: 12, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>Высота (м)</span>
                  <InputNumber
                    value={height}
                    onChange={(v) => setHeight(v as number | null)}
                    min={0.1}
                    max={10}
                    step={0.1}
                    style={{ width: '100%', borderRadius: 10 }}
                    placeholder="3.0"
                  />
                </div>
                <div>
                  <span style={{ fontFamily: "'SF Pro Display'", fontSize: 12, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>Длина (м)</span>
                  <InputNumber
                    value={length}
                    onChange={(v) => setLength(v as number | null)}
                    min={0.1}
                    max={50}
                    step={0.1}
                    style={{ width: '100%', borderRadius: 10 }}
                    placeholder="4.0"
                  />
                </div>
                <Button
                  onClick={handleCalculate}
                  style={{
                    background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: PILL_RADIUS,
                    height: 44,
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontWeight: 600,
                    boxShadow: 'none',
                  }}
                >
                  Рассчитать
                </Button>
              </div>
              {calcResult && (
                <div style={{
                  background: LIGHT_BG,
                  borderRadius: 12,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <span style={{ fontFamily: "'SF Pro Display'", fontSize: 13, color: GRAY_TEXT }}>
                    Площадь: <strong style={{ color: DARK }}>{calcResult.area} м²</strong>
                  </span>
                  <span style={{ fontFamily: "'SF Pro Display'", fontSize: 13, color: GRAY_TEXT }}>
                    Панелей: <strong style={{ color: DARK }}>{calcResult.panels} шт</strong>
                  </span>
                  <span style={{ fontFamily: "'SF Pro Display'", fontSize: 13, color: GRAY_TEXT }}>
                    Цена от: <strong style={{ color: ACCENT }}>{calcResult.price.toLocaleString('ru-RU')} ₽</strong>
                  </span>
                </div>
              )}
            </motion.div>

            {/* Блок 2: Сценарии жизни */}
            <motion.div
              variants={fadeUpVariants}
              custom={2}
              style={{
                background: '#fff',
                borderRadius: CARD_RADIUS,
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: `1px solid ${SUBTLE_BORDER}`,
              }}
            >
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}>
                Сценарии жизни
              </span>
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontSize: 13,
                color: GRAY_TEXT,
                lineHeight: 1.6,
              }}>
                Сотни визуализаций — для разного света и объёма
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}>
                {lifeScenarios.map((s) => (
                  <div
                    key={s.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 8px',
                      background: '#F5F5F5',
                      borderRadius: 12,
                    }}
                  >
                    {s.icon}
                    <span style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontSize: 12,
                      color: DARK,
                      fontWeight: 600,
                    }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Блок 3: Виртуальная примерка */}
            <motion.div
              variants={fadeUpVariants}
              custom={3}
              style={{
                background: '#fff',
                borderRadius: CARD_RADIUS,
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: `1px solid ${SUBTLE_BORDER}`,
              }}
            >
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}>
                Виртуальная примерка
              </span>
              <span style={{
                fontFamily: "'SF Pro Display', sans-serif",
                fontSize: 13,
                color: GRAY_TEXT,
                lineHeight: 1.6,
              }}>
                Готовы увидеть это на своей стене? Загрузите фото и посмотрите как изменится Ваш интерьер
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Button
                  onClick={() => navigate('/visualizer')}
                  size="large"
                  style={{
                    background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: PILL_RADIUS,
                    height: 56,
                    padding: '0 40px',
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontWeight: 600,
                    fontSize: 17,
                    boxShadow: 'none',
                    letterSpacing: '-0.01em',
                  }}
                >
                  WOW!
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── CTA Banner Section (Слайд 7) ───────────────────────────────────────────────

const CTABannerSection: React.FC<{ onCatalog: () => void }> = ({ onCatalog }) => (
  <section style={{ background: LIGHT_BG, padding: '100px 24px' }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        custom={0}
        style={{
          background: '#fff',
          borderRadius: CARD_RADIUS,
          padding: '80px 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          border: `1px solid ${SUBTLE_BORDER}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >

        <div>
          <h2
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: 'clamp(32px, 3vw, 44px)',
              fontWeight: 700,
              color: DARK,
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
            }}
          >
            Начните обновление
          </h2>
          <p
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: 18,
              color: GRAY_TEXT,
              margin: '12px 0 0',
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Присоединяйтесь к новой культуре взаимодействия с пространством
          </p>
          <p
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: 16,
              color: GRAY_TEXT,
              margin: '8px 0 0',
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Ремонт перестал быть событием. Вам нужно только выбрать настроение.
          </p>
        </div>
        <Button
          onClick={onCatalog}
          size="large"
          style={{
            background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: PILL_RADIUS,
            height: 56,
            padding: '0 36px',
            fontFamily: "'SF Pro Display', sans-serif",
            fontWeight: 600,
            fontSize: 16,
            boxShadow: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Начать обновление
        </Button>
      </motion.div>
    </div>
  </section>
);

// ─── Main HomePage Component ──────────────────────────────────────────────────

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleCatalog = () => navigate('/catalog');
  const handleCategory = (key: string) => navigate(`/catalog?category=${key}`);
  const handleProduct = (id: string) => navigate(`/product/${id}`);

  return (
    <div style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
      <PageMeta title="Wonder Wow Wall — 3D-панели для стен" description="Купить 3D-панели для стен с доставкой и монтажом. 200+ дизайнов, гарантия 5 лет, рассрочка 0%." />
      <HeroSection onCatalog={handleCatalog} />
      <HowItWorksSection />
      <ServiceBannerSection />
      <TechSection />
      <PanelGridSection onCatalog={handleCatalog} />
      <ProjectDetailsSection />
      <CTABannerSection onCatalog={handleCatalog} />

      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hero-images { order: -1; }
          .tech-grid { grid-template-columns: 1fr !important; }
          .panel-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .project-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
