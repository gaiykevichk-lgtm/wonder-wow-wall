import React from 'react';
import { Card, Collapse } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import {
  SearchOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  GiftOutlined,
  TeamOutlined,
  CarOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';

// ─── Style constants ──────────────────────────────────────────────────────────

const ACCENT = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = "'SF Pro Display', sans-serif";
const SECTION_PAD: React.CSSProperties = { padding: '120px 24px' };
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1080, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' as const, delay: i * 0.1 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Steps data ───────────────────────────────────────────────────────────────

const processSteps = [
  {
    num: 1,
    icon: <SearchOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Выбираете решение.',
    desc: 'Найдите стиль, который подходит именно Вам.',
    detail: 'Каталог, готовые пространства или Конфигуратор.',
  },
  {
    num: 2,
    icon: <AppstoreOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Подтверждаете проект.',
    desc: 'Укажите размеры стены, а система автоматически рассчитает необходимое количество материалов и итоговую стоимость.',
    detail: 'Автоматический расчёт параметров.',
  },
  {
    num: 3,
    icon: <ShoppingCartOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Получаете готовое пространство.',
    desc: 'Мы доставляем комплект и организуем монтаж платформы. Она фиксируется на стене один раз и становится постоянным фундаментом для будущих обновлений.',
    detail: 'Монтаж универсальной платформы.',
  },
  {
    num: 4,
    icon: <ToolOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Меняете, когда захотите.',
    desc: 'Новые панели устанавливаются на существующую платформу за считанные часы – без демонтажа, пыли и традиционного ремонта.',
    detail: 'Трансформация пространства.',
  },
];

// ─── Guarantees data ──────────────────────────────────────────────────────────

const guarantees = [
  {
    icon: <CarOutlined style={{ fontSize: 26, color: ACCENT }} />,
    title: 'Доставка.',
    desc: 'Комплект поставляется полностью готовым к монтажу. Никаких поездок за комплектующими и поиска совместимых элементов.',
  },
  {
    icon: <TeamOutlined style={{ fontSize: 26, color: ACCENT }} />,
    title: 'Монтаж.',
    desc: 'Установку выполняют сертифицированные партнёры. Вам не нужно искать подрядчиков и контролировать технические детали процесса.',
  },
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 26, color: ACCENT }} />,
    title: 'Гарантия.',
    desc: 'Мы отвечаем за качество материалов и работоспособность платформы в соответствии с условиями гарантии.',
  },
  {
    icon: <GiftOutlined style={{ fontSize: 26, color: ACCENT }} />,
    title: 'Подписка.',
    desc: 'После установки пространство может продолжать меняться без повторного ремонта. Программа обслуживания открывает доступ к регулярным обновлениям интерьера.',
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const faqItems = [
  {
    key: '1',
    label: 'Сколько времени занимает монтаж?',
    children: (
      <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0, lineHeight: 1.7 }}>
        Стандартная комната 16–20 м² занимает около 2–3 часов. Если у вас сложная геометрия стен
        или нестандартные проёмы, мастер может задержаться немного дольше. Точное время мы
        озвучим при согласовании визита.
      </p>
    ),
  },
  {
    key: '2',
    label: 'Нужна ли специальная подготовка стен?',
    children: (
      <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0, lineHeight: 1.7 }}>
        Стены должны быть сухими, без выраженных перепадов более 5 мм. Незначительные
        неровности мастер исправит в процессе монтажа. Свежую штукатурку нужно выдержать
        не менее 28 дней перед установкой панелей.
      </p>
    ),
  },
  {
    key: '3',
    label: 'Можно ли снять панели и установить заново?',
    children: (
      <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0, lineHeight: 1.7 }}>
        Да, наша система крепления позволяет демонтировать панели без повреждения стены
        и поверхности панели. При переезде или редизайне вы можете взять панели с собой
        и установить в новом месте.
      </p>
    ),
  },
  {
    key: '4',
    label: 'Как ухаживать за панелями?',
    children: (
      <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0, lineHeight: 1.7 }}>
        Большинство панелей достаточно протирать влажной тряпкой или микрофиброй.
        Не используйте абразивные средства и растворители. Деревянные панели
        рекомендуется раз в год обрабатывать специальным воском для дерева.
      </p>
    ),
  },
];

// ─── HowItWorksPage ───────────────────────────────────────────────────────────

const HowItWorksPage: React.FC = () => (
  <div style={{ fontFamily: FONT, paddingTop: 72 }}>
    <PageMeta title="Как это работает" description="Узнайте как работает сервис модульной отделки стен Wonder Wow Wall." />
    {/* Hero */}
    <section style={{ background: '#F5F5F5', padding: '120px 24px 120px' }}>
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
            Обновление пространства
          </motion.span>
          <motion.h1
            variants={fadeUp}
            custom={1}
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(36px, 4vw, 52px)',
              fontWeight: 600,
              color: DARK,
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
            }}
          >
            Просто.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            custom={2}
            style={{
              fontFamily: FONT,
              fontSize: 17,
              color: GRAY_TEXT,
              margin: 0,
              maxWidth: 560,
              lineHeight: 1.65,
            }}
          >
            Мы убрали всё лишнее: сложные расчёты, поиск подрядчиков, строительный мусор и недели ожидания.
            Вы выбираете дизайн. Всё остальное уже предусмотрено WONDER WOW WALL.
          </motion.p>
        </motion.div>
      </div>
    </section>

    {/* 4 Steps */}
    <section style={{ background: '#fff', ...SECTION_PAD }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
        >
          {processSteps.map((step, i) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              custom={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr',
                gap: 32,
                alignItems: 'flex-start',
                paddingBottom: i < processSteps.length - 1 ? 40 : 0,
                borderBottom: i < processSteps.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              }}
            >
              {/* Number bubble */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: DARK,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>

              {/* Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      fontWeight: 600,
                      color: GRAY_TEXT,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    Шаг {step.num}
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: FONT,
                    fontSize: 22,
                    fontWeight: 600,
                    color: DARK,
                    margin: 0,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: 0, lineHeight: 1.7, maxWidth: 680 }}>
                  {step.desc}
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#F5F5F5',
                    borderRadius: 8,
                    padding: '8px 14px',
                    alignSelf: 'flex-start',
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: 13, color: DARK, fontWeight: 500 }}>
                    {step.detail}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>

    {/* Video */}
    <section style={{ background: '#F5F5F5', ...SECTION_PAD }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}
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
            Посмотрите, как это выглядит
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            style={{
              fontFamily: FONT,
              fontSize: 16,
              color: GRAY_TEXT,
              margin: 0,
              textAlign: 'center',
              maxWidth: 520,
              lineHeight: 1.65,
            }}
          >
            Короткое видео о процессе установки панелей — от распаковки до результата.
          </motion.p>
          <motion.div
            variants={fadeUp}
            custom={2}
            style={{
              width: '100%',
              borderRadius: 16,
              overflow: 'hidden',
              aspectRatio: '16 / 9',
              background: '#000',
            }}
          >
            <iframe
              title="Монтаж панелей Wonder Wow Wall"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              width="100%"
              height="100%"
              style={{ border: 'none', display: 'block' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>

    {/* Guarantees */}
    <section style={{ background: '#F5F5F5', ...SECTION_PAD }}>
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
              Наши гарантии
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
              Почему нам доверяют
            </motion.h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
              width: '100%',
            }}
          >
            {guarantees.map((g, i) => (
              <motion.div
                key={g.title}
                variants={fadeUp}
                custom={i + 2}
                whileHover={{ translateY: -2 }}
              >
                <Card
                  style={{
                    borderRadius: 16,
                    border: '1px solid rgba(0,0,0,0.04)',
                    boxShadow: 'none',
                    height: '100%',
                    transition: 'box-shadow 0.3s ease, transform 0.3s ease',
                  }}
                  hoverable
                  styles={{ body: { padding: '28px 24px' } }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>{g.icon}</div>
                    <div>
                      <h3
                        style={{
                          fontFamily: FONT,
                          fontSize: 17,
                          fontWeight: 600,
                          color: DARK,
                          margin: '0 0 8px',
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {g.title}
                      </h3>
                      <p style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT, margin: 0, lineHeight: 1.65 }}>
                        {g.desc}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>

    {/* FAQ */}
    <section style={{ background: '#fff', ...SECTION_PAD }}>
      <div style={{ ...MAX_WIDTH }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <QuestionCircleOutlined style={{ fontSize: 24, color: DARK }} />
            <h2
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(24px, 2.5vw, 32px)',
                fontWeight: 600,
                color: DARK,
                margin: 0,
                letterSpacing: '-0.03em',
              }}
            >
              Частые вопросы
            </h2>
          </motion.div>

          <motion.div variants={fadeUp} custom={1}>
            <Collapse
              items={faqItems}
              style={{ borderRadius: 16, border: '1px solid rgba(0,0,0,0.04)', background: '#fff' }}
              expandIconPosition="end"
              defaultActiveKey={['1']}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  </div>
);

export default HowItWorksPage;
