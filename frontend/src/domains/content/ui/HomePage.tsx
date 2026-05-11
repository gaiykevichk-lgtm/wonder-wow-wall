import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Rate, Tag, InputNumber } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import {
  AppstoreOutlined,
  ThunderboltOutlined,
  AudioMutedOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
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
import { products, categories, clientReviews } from '../../catalog/model/data';

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
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const LIGHT_BG = '#F5F5F5';
const SUBTLE_BORDER = 'rgba(0,0,0,0.04)';
const CARD_RADIUS = 20;
const PILL_RADIUS = 10;

// ─── Hero Section ────────────────────────────────────────────────────────────────

const HeroSection: React.FC<{ onCatalog: () => void }> = ({ onCatalog }) => (
  <section
    style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, #FFFFFF 0%, #F8FBF8 100%)`,
      display: 'flex',
      alignItems: 'center',
      ...SECTION_PADDING,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    {/* Decorative accent */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: 'linear-gradient(90deg, #4CAF50 0%, #2E7D32 50%, #4CAF50 100%)',
    }} />

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
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: ACCENT,
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
            fontFamily: 'Inter, sans-serif',
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
          <span style={{
            background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Начинается свобода.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          custom={2}
          style={{
            fontFamily: 'Inter, sans-serif',
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
              height: 60,
              padding: '0 48px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 17,
              boxShadow: '0 8px 28px rgba(76,175,80,0.35)',
              letterSpacing: '0.5px',
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
  '1': <SearchOutlined style={{ fontSize: 32, color: '#fff' }} />,
  '2': <CameraOutlined style={{ fontSize: 32, color: '#fff' }} />,
  '3': <ClockCircleOutlined style={{ fontSize: 32, color: '#fff' }} />,
  '4': <SwapOutlined style={{ fontSize: 32, color: '#fff' }} />,
};

const StepIcon: React.FC<{ num: string; hovered?: boolean }> = ({ num, hovered }) => {
  return (
    <div style={{
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: hovered
        ? ACCENT
        : 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: hovered ? '0 8px 24px rgba(76,175,80,0.5)' : '0 4px 12px rgba(76,175,80,0.3)',
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
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              display: 'block',
              marginBottom: 12,
            }}>
              Платформа трансформации
            </span>
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
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
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  transition: `box-shadow 0.5s cubic-bezier(${APPLE_EASE.join(',')})`,
                  border: hoveredStep === step.num ? `2px solid ${ACCENT}30` : '2px solid transparent',
                }}
              >
                <div style={{
                  height: 180,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: hoveredStep === step.num
                    ? `linear-gradient(135deg, ${ACCENT}10 0%, ${ACCENT}20 100%)`
                    : 'linear-gradient(135deg, #f8f9fa 0%, #f0f1f2 100%)',
                  transition: 'background 0.4s ease',
                }}>
                  <StepIcon num={step.num} hovered={hoveredStep === step.num} />
                </div>
                <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 18,
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
};

// ─── Advantages Section ──────────────────────────────────────────────────────

const advantages: { icon: React.ReactNode; title: string; desc: string; color: string }[] = [
  {
    icon: <AppstoreOutlined />,
    title: '200+ дизайнов в наличии',
    desc: 'Выбирайте. Не нашли — привезём под заказ за две недели.',
    color: '#E8F5E9'
  },
  {
    icon: <ThunderboltOutlined />,
    title: 'Монтаж за 2 часа',
    desc: 'Приедем, поставим, уберём за собой. Вы только проверяете.',
    color: '#FFF3E0'
  },
  {
    icon: <AudioMutedOutlined />,
    title: 'Чисто. Без шума.',
    desc: 'Технология без сверления и пыли. Дети и животные не пострадают.',
    color: '#E3F2FD'
  },
  {
    icon: <CrownOutlined />,
    title: 'Подписка — выгоднее',
    desc: 'Меняете дизайн каждый год? Подписка окупается за два заказа.',
    color: '#F3E5F5'
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: 'Гарантия 5 лет',
    desc: 'Что-то пошло не так — приедем и исправим. Бесплатно.',
    color: '#FFEBEE'
  },
  {
    icon: <RocketOutlined />,
    title: 'Доставка по всей России',
    desc: 'Москва — завтра. По России — от трёх дней. Везём аккуратно.',
    color: '#E0F7FA'
  },
];

const AdvantagesSection: React.FC = () => (
  <section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
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
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: '3px',
            }}
          >
            Почему к нам приходят
          </motion.span>
          <motion.h2
            variants={fadeUpVariants}
            custom={1}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(32px, 3.5vw, 44px)',
              fontWeight: 700,
              color: DARK,
              margin: 0,
              textAlign: 'center',
              letterSpacing: '-0.03em',
            }}
          >
            Потому что мы делаем это{' '}
            <span style={{
              background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              хорошо
            </span>
          </motion.h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 20,
            width: '100%',
          }}
        >
          {advantages.map((item, i) => (
            <motion.div
              key={item.title}
              variants={fadeUpVariants}
              custom={i * 0.1 + 2}
              whileHover={{
                translateY: -3,
                boxShadow: '0 16px 40px rgba(0,0,0,0.08)',
                transition: { duration: 0.5, ease: APPLE_EASE },
              }}
              style={{
                background: '#fff',
                borderRadius: CARD_RADIUS,
                padding: '28px 24px',
                display: 'flex',
                gap: 18,
                alignItems: 'flex-start',
                transition: `box-shadow 0.5s cubic-bezier(${APPLE_EASE.join(',')})`,
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: ACCENT,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    color: DARK,
                    marginBottom: 6,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    color: GRAY_TEXT,
                    lineHeight: 1.6,
                  }}
                >
                  {item.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Service Banner Section — "Стены как сервис" (Слайд 3) ──────────────────

const ServiceBannerSection: React.FC = () => (
  <section style={{ background: '#fff', padding: '80px 24px', overflow: 'hidden' }}>
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
          gap: 24,
          position: 'relative',
        }}
      >
        {/* Decorative green line */}
        <div style={{
          width: 64,
          height: 4,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
          marginBottom: 8,
        }} />

        <motion.div variants={fadeUpVariants} custom={1}>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            color: ACCENT,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            display: 'block',
            marginBottom: 16,
          }}>
            Впервые в индустрии
          </span>
        </motion.div>

        <motion.h2 variants={fadeUpVariants} custom={2} style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 'clamp(36px, 5vw, 64px)',
          fontWeight: 700,
          color: DARK,
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
        }}>
          Стены как сервис
        </motion.h2>

        <motion.p variants={fadeUpVariants} custom={3} style={{
          fontFamily: 'Inter, sans-serif',
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
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: ACCENT,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            WONDER WOW WALL
          </span>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            color: GRAY_TEXT,
          }}>
            –
          </span>
          <span style={{
            fontFamily: 'Inter, sans-serif',
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
    icon: <SettingOutlined style={{ fontSize: 28, color: ACCENT }} />,
    title: 'Универсальная платформа монтажа',
    desc: 'Адаптирована для любых поверхностей — бетон, кирпич, дерево, плитка.',
  },
  {
    icon: <LockOutlined style={{ fontSize: 28, color: ACCENT }} />,
    title: 'Запатентованная система креплений',
    desc: 'Обеспечивает быструю замену без повреждения стены.',
  },
  {
    icon: <AppstoreOutlined style={{ fontSize: 28, color: ACCENT }} />,
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
              fontFamily: 'Inter, sans-serif',
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
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: '#E8F5E9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {point.icon}
              </div>
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
                lineHeight: 1.3,
              }}>
                {point.title}
              </span>
              <span style={{
                fontFamily: 'Inter, sans-serif',
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
            fontFamily: 'Inter, sans-serif',
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
                fontFamily: 'Inter, sans-serif',
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
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
              width: '100%',
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
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
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
                      fontFamily: 'Inter, sans-serif',
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
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 16,
                boxShadow: '0 8px 24px rgba(76,175,80,0.3)',
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
  { icon: <DesktopOutlined style={{ fontSize: 32, color: ACCENT }} />, label: 'Гостиная' },
  { icon: <AppstoreOutlined style={{ fontSize: 32, color: ACCENT }} />, label: 'Спальня' },
  { icon: <CameraOutlined style={{ fontSize: 32, color: ACCENT }} />, label: 'Зона ТВ' },
  { icon: <ExperimentOutlined style={{ fontSize: 32, color: ACCENT }} />, label: 'Детская' },
  { icon: <ThunderboltOutlined style={{ fontSize: 32, color: ACCENT }} />, label: 'Кухня' },
  { icon: <WifiOutlined style={{ fontSize: 32, color: ACCENT }} />, label: 'WC' },
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
            fontFamily: 'Inter, sans-serif',
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
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}>
                Точный расчёт
              </span>
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: GRAY_TEXT,
                lineHeight: 1.6,
              }}>
                Введите параметры Вашей стены и система определит необходимое количество панелей
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span style={{ fontFamily: 'Inter', fontSize: 12, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>Высота (м)</span>
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
                  <span style={{ fontFamily: 'Inter', fontSize: 12, color: GRAY_TEXT, display: 'block', marginBottom: 4 }}>Длина (м)</span>
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
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                  }}
                >
                  Рассчитать
                </Button>
              </div>
              {calcResult && (
                <div style={{
                  background: '#E8F5E9',
                  borderRadius: 12,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: GRAY_TEXT }}>
                    Площадь: <strong style={{ color: DARK }}>{calcResult.area} м²</strong>
                  </span>
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: GRAY_TEXT }}>
                    Панелей: <strong style={{ color: DARK }}>{calcResult.panels} шт</strong>
                  </span>
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: GRAY_TEXT }}>
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
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}>
                Сценарии жизни
              </span>
              <span style={{
                fontFamily: 'Inter, sans-serif',
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
                      fontFamily: 'Inter, sans-serif',
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
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}>
                Виртуальная примерка
              </span>
              <span style={{
                fontFamily: 'Inter, sans-serif',
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
                    height: 60,
                    padding: '0 40px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    boxShadow: '0 8px 28px rgba(76,175,80,0.35)',
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

// ─── Promo Banner Section ────────────────────────────────────────────────────

const PromoBannerSection: React.FC<{ onCatalog: () => void }> = ({ onCatalog }) => (
  <section style={{ background: '#fff', padding: '80px 24px' }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        custom={0}
        style={{
          background: `linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #388E3C 100%)`,
          borderRadius: CARD_RADIUS,
          padding: '64px 56px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 40,
          flexWrap: 'wrap',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(46,125,50,0.25)',
        }}
        className="promo-banner-inner"
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 520, position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.75)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: 12,
            }}
          >
            Только до конца месяца
          </div>
          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(28px, 3vw, 40px)',
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 16px',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            Скидка 15% на первый заказ
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 16,
              color: 'rgba(255,255,255,0.85)',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Да, мы тоже не любим переплачивать. Поэтому — скидка. Введите промокод FIRST15 при оформлении.
          </p>
          <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {['Бесплатный замер', 'Гарантия 5 лет', 'Рассрочка 0%'].map((perk) => (
              <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckOutlined style={{ color: '#A5D6A7', fontSize: 14 }} />
                <span style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{perk}</span>
              </div>
            ))}
          </div>
        </div>
        <Button
          onClick={onCatalog}
          size="large"
          style={{
            background: '#fff',
            color: ACCENT,
            border: 'none',
            borderRadius: PILL_RADIUS,
            height: 56,
            padding: '0 36px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Получить скидку
        </Button>
      </motion.div>
    </div>
  </section>
);

// ─── Categories Section ───────────────────────────────────────────────────────

const categoryImages: Record<string, string> = {
  wood: 'https://images.unsplash.com/photo-1644925757334-d0397c01518c?w=500&h=700&fit=crop',
  stone: 'https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=500&h=700&fit=crop',
  abstract: 'https://images.unsplash.com/photo-1740686004244-e9bc7c75d8e5?w=500&h=700&fit=crop',
  geometric: 'https://images.unsplash.com/photo-1582135739786-3bceafcaea85?w=500&h=700&fit=crop',
  nature: 'https://images.unsplash.com/photo-1722109997425-40f920848aed?w=500&h=700&fit=crop',
  minimal: 'https://images.unsplash.com/photo-1584530313715-bfe628686135?w=500&h=700&fit=crop',
};

const CategoriesSection: React.FC<{ onCategory: (key: string) => void }> = ({ onCategory }) => {
  const filtered = categories.filter((c) => c.key !== 'all');

  return (
    <section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
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
                color: ACCENT,
                textTransform: 'uppercase',
                letterSpacing: '3px',
              }}
            >
              Подберите свой стиль
            </motion.span>
            <motion.h2
              variants={fadeUpVariants}
              custom={1}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(32px, 3.5vw, 44px)',
                fontWeight: 700,
                color: DARK,
                margin: 0,
                textAlign: 'center',
                letterSpacing: '-0.03em',
              }}
            >
              Категории панелей
            </motion.h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 20,
              width: '100%',
            }}
          >
            {filtered.map((cat, i) => (
              <motion.div
                key={cat.key}
                variants={fadeUpVariants}
                custom={i * 0.1 + 2}
                whileHover={{
                  translateY: -4,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.12)',
                  transition: { duration: 0.5, ease: APPLE_EASE },
                }}
                onClick={() => onCategory(cat.key)}
                style={{
                  position: 'relative',
                  borderRadius: CARD_RADIUS,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  aspectRatio: '3 / 4',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                }}
              >
                <img
                  src={categoryImages[cat.key] || cat.image}
                  alt={cat.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 80%)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '20px 16px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#fff',
                      display: 'block',
                    }}
                  >
                    {cat.label}
                  </span>
                </div>
                {/* Green accent corner */}
                <div style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ color: '#fff', fontSize: 14 }}>→</span>
                </div>
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
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                color: ACCENT,
                textTransform: 'uppercase',
                letterSpacing: '3px',
                display: 'block',
                marginBottom: 8,
              }}>
                Хиты продаж
              </span>
              <h2
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(32px, 3.5vw, 44px)',
                  fontWeight: 700,
                  color: DARK,
                  margin: 0,
                  letterSpacing: '-0.03em',
                }}
              >
                Что выбирают чаще всего
              </h2>
            </div>
            <button
              onClick={onAllProducts}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 15,
                fontWeight: 600,
                color: ACCENT,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Все дизайны
              <span>→</span>
            </button>
          </motion.div>

          {/* Product grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 28,
            }}
          >
            {popular.map((product, i) => (
              <motion.div
                key={product.id}
                variants={fadeUpVariants}
                custom={i * 0.1 + 1}
                whileHover={{
                  translateY: -4,
                  boxShadow: '0 24px 60px rgba(0,0,0,0.1)',
                  transition: { duration: 0.5, ease: APPLE_EASE },
                }}
                onClick={() => onProduct(product.id)}
                style={{
                  borderRadius: CARD_RADIUS,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#fff',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.04)',
                  transition: `box-shadow 0.5s cubic-bezier(${APPLE_EASE.join(',')})`,
                }}
              >
                {/* Photo area */}
                <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {product.badge && (
                    <Tag
                      style={{
                        position: 'absolute',
                        top: 14,
                        left: 14,
                        background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: PILL_RADIUS,
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: 12,
                        padding: '4px 12px',
                        boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
                      }}
                    >
                      {product.badge}
                    </Tag>
                  )}
                  {/* Bottom gradient */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.1) 0%, transparent 100%)',
                  }} />
                </div>

                {/* Card body */}
                <div style={{ padding: '20px 20px 24px' }}>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 11,
                      color: GRAY_TEXT,
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      fontWeight: 600,
                    }}
                  >
                    {product.categoryLabel}
                  </span>
                  <div
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 18,
                      color: DARK,
                      marginTop: 6,
                      marginBottom: 10,
                    }}
                  >
                    {product.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Rate
                      disabled
                      defaultValue={product.rating}
                      allowHalf
                      style={{ fontSize: 13, color: '#F59E0B' }}
                    />
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 13,
                        color: GRAY_TEXT,
                      }}
                    >
                      {product.reviews} отзывов
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
                        fontSize: 20,
                        color: DARK,
                      }}
                    >
                      {product.price.toLocaleString('ru-RU')} ₽
                      <span
                        style={{ fontWeight: 400, fontSize: 13, color: GRAY_TEXT, marginLeft: 4 }}
                      >
                        {product.priceUnit}
                      </span>
                    </span>

                    {/* Color dots */}
                    <div style={{ display: 'flex', gap: 5 }}>
                      {product.colors.slice(0, 4).map((c) => (
                        <div
                          key={c.hex}
                          title={c.name}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: c.hex,
                            border: '2px solid #fff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
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
  <section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUpVariants}
        custom={0}
        style={{
          borderRadius: CARD_RADIUS,
          background: '#fff',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          padding: '56px',
          alignItems: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.04)',
        }}
        className="cta-calc-grid"
      >
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              display: 'block',
              marginBottom: 8,
            }}>
              Бесплатный расчёт
            </span>
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(28px, 2.5vw, 38px)',
                fontWeight: 700,
                color: DARK,
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              Узнайте точную стоимость за 30 секунд
            </h2>
          </div>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 16,
              color: GRAY_TEXT,
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            Вводите площадь, выбираете панели — и видите итог. Никаких скрытых платежей. Монтаж уже включён в расчёт.
          </p>

          {/* Trust items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Точный расчёт за 30 секунд', 'Без скрытых платежей', 'Монтаж включён'].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#E8F5E9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CheckOutlined style={{ color: ACCENT, fontSize: 12 }} />
                </div>
                <span style={{ fontFamily: 'Inter', fontSize: 14, color: DARK }}>{item}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={onConstructor}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: PILL_RADIUS,
              height: 56,
              padding: '0 32px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 16,
              width: 'fit-content',
              boxShadow: '0 8px 24px rgba(76,175,80,0.3)',
            }}
          >
            Открыть калькулятор
          </Button>
        </div>

        {/* Right — price examples visual */}
        <div
          style={{
            background: LIGHT_BG,
            borderRadius: CARD_RADIUS,
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: GRAY_TEXT,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Примеры цен
          </span>
          {[
            { label: 'Прихожая', area: '~8 м²', price: '13 600 ₽' },
            { label: 'Спальня', area: '~16 м²', price: '27 200 ₽' },
            { label: 'Гостиная', area: '~24 м²', price: '40 800 ₽' },
          ].map((item, idx) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: idx < 2 ? `1px solid ${SUBTLE_BORDER}` : 'none',
                paddingBottom: 16,
              }}
            >
              <div>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  fontWeight: 600,
                  color: DARK,
                  display: 'block',
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12,
                  color: GRAY_TEXT,
                }}>
                  {item.area}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: 18,
                  color: ACCENT,
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
              color: GRAY_TEXT,
              marginTop: 4,
            }}
          >
            *Точная цена зависит от выбранных панелей. Расчёт в конструкторе — бесплатный.
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

  const avatarColors = ['#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9', '#2E7D32', '#388E3C'];

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
          <motion.div variants={fadeUpVariants} custom={0} style={{ textAlign: 'center' }}>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: '3px',
              display: 'block',
              marginBottom: 12,
            }}>
              Реальные отзывы
            </span>
            <h2
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(32px, 3.5vw, 44px)',
                fontWeight: 700,
                color: DARK,
                margin: 0,
                letterSpacing: '-0.03em',
              }}
            >
              Что говорят наши клиенты
            </h2>
          </motion.div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 24,
            }}
          >
            {clientReviews.map((review, i) => (
              <motion.div
                key={review.id}
                variants={fadeUpVariants}
                custom={i * 0.1 + 1}
                whileHover={{
                  translateY: -3,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
                  transition: { duration: 0.5, ease: APPLE_EASE },
                }}
                style={{
                  borderRadius: CARD_RADIUS,
                  padding: '28px',
                  background: LIGHT_BG,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  border: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                {/* Author row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${avatarColors[i % avatarColors.length]} 0%, ${ACCENT_DARK} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      fontSize: 15,
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    {getInitials(review.author)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 700,
                        fontSize: 16,
                        color: DARK,
                      }}
                    >
                      {review.author}
                    </span>
                    <Rate
                      disabled
                      defaultValue={review.rating}
                      style={{ fontSize: 13, color: '#F59E0B' }}
                    />
                  </div>
                </div>

                {/* Review text */}
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    color: DARK,
                    margin: 0,
                    lineHeight: 1.7,
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
                    color: GRAY_TEXT,
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
          boxShadow: '0 12px 60px rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative element */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '4px',
          background: 'linear-gradient(90deg, transparent 0%, #4CAF50 50%, transparent 100%)',
          borderRadius: '0 0 4px 4px',
        }} />

        <div>
          <h2
            style={{
              fontFamily: 'Inter, sans-serif',
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
              fontFamily: 'Inter, sans-serif',
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
              fontFamily: 'Inter, sans-serif',
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
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            boxShadow: '0 8px 24px rgba(76,175,80,0.3)',
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
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <PageMeta title="Wonder Wow Wall — 3D-панели для стен" description="Купить 3D-панели для стен с доставкой и монтажом. 200+ дизайнов, гарантия 5 лет, рассрочка 0%." />
      <HeroSection onCatalog={handleCatalog} />
      <HowItWorksSection />
      <ServiceBannerSection />
      <TechSection />
      <PanelGridSection onCatalog={handleCatalog} />
      <ProjectDetailsSection />
      <CTABannerSection onCatalog={handleCatalog} />
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
