import React from 'react';
import { Card } from 'antd';
import {
  ExperimentOutlined,
  TrophyOutlined,
  TeamOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  BulbOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';

// ─── Style constants ──────────────────────────────────────────────────────────

const BLUE = '#0071e3';
const DARK = '#1d1d1f';
const GRAY_TEXT = '#86868b';
const FONT = 'Inter, sans-serif';
const SECTION_PAD: React.CSSProperties = { padding: '120px 24px' };
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1080, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: i * 0.1 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Hero Section ─────────────────────────────────────────────────────────────

const HeroSection: React.FC = () => (
  <section
    style={{
      background: '#F5F5F7',
      ...SECTION_PAD,
      paddingTop: 96,
      paddingBottom: 96,
    }}
  >
    <div style={{ ...MAX_WIDTH, textAlign: 'center' }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
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
          Wonder Wow Wall
        </motion.span>
        <motion.h1
          variants={fadeUp}
          custom={1}
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(40px, 5vw, 60px)',
            fontWeight: 600,
            color: DARK,
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          О компании Wonder Wow Wall
        </motion.h1>
        <motion.p
          variants={fadeUp}
          custom={2}
          style={{
            fontFamily: FONT,
            fontSize: 18,
            color: GRAY_TEXT,
            margin: 0,
            maxWidth: 600,
            lineHeight: 1.65,
          }}
        >
          Мы создаём декоративные стеновые панели, которые превращают обычные
          помещения в пространства с характером. Более 5 лет мы помогаем клиентам
          по всей России реализовывать дизайнерские решения.
        </motion.p>
      </motion.div>
    </div>
  </section>
);

// ─── Story Section ────────────────────────────────────────────────────────────

const StorySection: React.FC = () => (
  <section style={{ background: '#fff', ...SECTION_PAD }}>
    <div style={{ ...MAX_WIDTH }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'center',
        }}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
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
            Наша история
          </motion.span>
          <motion.h2
            variants={fadeUp}
            custom={1}
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(28px, 3vw, 36px)',
              fontWeight: 600,
              color: DARK,
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
            }}
          >
            Основаны в 2019 году с единой целью
          </motion.h2>
          {[
            'Компания Wonder Wow Wall появилась из простой идеи: дать каждому возможность иметь красивые стены без дорогостоящего ремонта и сложного монтажа.',
            'Наши основатели — архитекторы и дизайнеры интерьеров — объединились, чтобы создать продукт, сочетающий эстетику, долговечность и простоту установки.',
            'Сегодня Wonder Wow Wall — это более 200 уникальных дизайнов, команда из 80+ специалистов и тысячи довольных клиентов по всей стране.',
          ].map((text, i) => (
            <motion.p
              key={i}
              variants={fadeUp}
              custom={i + 2}
              style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: 0, lineHeight: 1.7 }}
            >
              {text}
            </motion.p>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {[
            'https://images.unsplash.com/photo-1755288556391-c4911fa13627?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1582135739786-3bceafcaea85?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1644925757334-d0397c01518c?w=400&h=400&fit=crop',
          ].map((src, i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <img
                src={src}
                alt={`О компании ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  </section>
);

// ─── Technology Section ───────────────────────────────────────────────────────

const techFeatures = [
  {
    icon: <BulbOutlined style={{ fontSize: 32, color: DARK }} />,
    title: 'Инновационные материалы',
    desc: 'Используем только сертифицированные материалы нового поколения: экологичный МДФ, переработанный пластик и натуральный шпон. Каждая панель проходит 12-ступенчатый контроль качества.',
  },
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 32, color: DARK }} />,
    title: 'Точность производства',
    desc: 'Современные ЧПУ-станки обеспечивают допуск ±0,1 мм. Панели идеально стыкуются без зазоров, а уникальная система крепления позволяет монтировать их без специальных навыков.',
  },
  {
    icon: <RocketOutlined style={{ fontSize: 32, color: DARK }} />,
    title: 'Быстрая доставка',
    desc: 'Собственный склад в Москве и логистическая сеть по всей России обеспечивают доставку в любую точку страны за 1–7 рабочих дней. Стандартные размеры — в наличии всегда.',
  },
];

const TechnologySection: React.FC = () => (
  <section style={{ background: '#F5F5F7', ...SECTION_PAD }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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
            Технологии
          </motion.span>
          <motion.h2
            variants={fadeUp}
            custom={1}
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(28px, 3vw, 36px)',
              fontWeight: 600,
              color: DARK,
              margin: 0,
              textAlign: 'center',
              letterSpacing: '-0.03em',
            }}
          >
            Почему наши панели лучше
          </motion.h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            width: '100%',
          }}
        >
          {techFeatures.map((feat, i) => (
            <motion.div
              key={feat.title}
              variants={fadeUp}
              custom={i + 2}
              whileHover={{ translateY: -2 }}
              style={{ transition: 'box-shadow 0.3s ease' }}
            >
              <Card
                style={{
                  borderRadius: 20,
                  border: '1px solid rgba(0,0,0,0.04)',
                  boxShadow: 'none',
                  height: '100%',
                  transition: 'box-shadow 0.3s ease, transform 0.3s ease',
                }}
                hoverable
                styles={{
                  body: { padding: '32px' },
                }}
              >
                <div style={{ marginBottom: 20 }}>{feat.icon}</div>
                <h3
                  style={{
                    fontFamily: FONT,
                    fontSize: 18,
                    fontWeight: 600,
                    color: DARK,
                    margin: '0 0 12px',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {feat.title}
                </h3>
                <p
                  style={{
                    fontFamily: FONT,
                    fontSize: 14,
                    color: GRAY_TEXT,
                    margin: 0,
                    lineHeight: 1.7,
                  }}
                >
                  {feat.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Numbers Section ──────────────────────────────────────────────────────────

const numbers = [
  { icon: <TrophyOutlined style={{ fontSize: 28, color: BLUE }} />, value: '200+', label: 'Дизайнов', desc: 'в каталоге' },
  { icon: <TeamOutlined style={{ fontSize: 28, color: BLUE }} />, value: '50K+', label: 'Клиентов', desc: 'по всей России' },
  { icon: <StarOutlined style={{ fontSize: 28, color: BLUE }} />, value: '5 лет', label: 'На рынке', desc: 'с 2019 года' },
  { icon: <StarOutlined style={{ fontSize: 28, color: BLUE }} />, value: '4.9', label: 'Рейтинг', desc: 'средняя оценка' },
];

const NumbersSection: React.FC = () => (
  <section style={{ background: '#fff', ...SECTION_PAD }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}
      >
        <motion.h2
          variants={fadeUp}
          custom={0}
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(28px, 3vw, 36px)',
            fontWeight: 600,
            color: DARK,
            margin: 0,
            textAlign: 'center',
            letterSpacing: '-0.03em',
          }}
        >
          Wonder Wow Wall в цифрах
        </motion.h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 24,
            width: '100%',
          }}
        >
          {numbers.map((item, i) => (
            <motion.div
              key={item.label}
              variants={fadeUp}
              custom={i + 1}
              whileHover={{ translateY: -2 }}
              style={{
                border: '1px solid rgba(0,0,0,0.04)',
                borderRadius: 20,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                textAlign: 'center',
                background: '#fff',
                transition: 'box-shadow 0.3s ease, transform 0.3s ease',
              }}
            >
              <div>{item.icon}</div>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 42,
                  fontWeight: 600,
                  color: DARK,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {item.value}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: DARK }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT }}>
                  {item.desc}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Eco Section ──────────────────────────────────────────────────────────────

const EcoSection: React.FC = () => (
  <section style={{ background: '#F5F5F7', ...SECTION_PAD }}>
    <div style={{ ...MAX_WIDTH }}>
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid rgba(0,0,0,0.04)',
          padding: '56px 64px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <motion.div variants={fadeUp} custom={0} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ExperimentOutlined style={{ fontSize: 28, color: BLUE }} />
            <span
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                color: GRAY_TEXT,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Экология
            </span>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={1}
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(26px, 2.5vw, 34px)',
              fontWeight: 600,
              color: DARK,
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
            }}
          >
            Забота об окружающей среде
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={2}
            style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: 0, lineHeight: 1.7 }}
          >
            Мы придерживаемся принципов устойчивого производства. Не менее 40%
            сырья поступает из сертифицированных источников ответственного лесопользования,
            а производственные отходы перерабатываются в новые материалы.
          </motion.p>
        </div>

        <motion.div
          variants={fadeUp}
          custom={3}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {[
            { title: 'FSC-сертификация', desc: 'Древесина из ответственных источников' },
            { title: 'Нулевые выбросы', desc: 'CO₂-нейтральное производство с 2023 года' },
            { title: 'Переработка отходов', desc: '95% производственных отходов уходят в переработку' },
            { title: 'Долговечность', desc: 'Срок службы 20+ лет снижает общий экологический след' },
          ].map((item) => (
            <div
              key={item.title}
              style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: BLUE,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: DARK }}>
                  {item.title}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT }}>
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  </section>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const AboutPage: React.FC = () => (
  <div style={{ fontFamily: FONT, paddingTop: 72 }}>
    <HeroSection />
    <StorySection />
    <TechnologySection />
    <NumbersSection />
    <EcoSection />
  </div>
);

export default AboutPage;
