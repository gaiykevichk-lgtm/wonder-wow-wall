import React from 'react';
import { Card, Collapse } from 'antd';
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

const GREEN = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';
const SECTION_PAD: React.CSSProperties = { padding: '80px 24px' };
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

// ─── Steps data ───────────────────────────────────────────────────────────────

const processSteps = [
  {
    num: 1,
    icon: <SearchOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Выберите дизайн',
    desc: 'Откройте каталог из более чем 200 уникальных коллекций. Используйте фильтры по стилю, материалу и цвету. Каждая карточка содержит фотографии в реальных интерьерах и детальное описание характеристик панели.',
    detail: 'Доступен онлайн-конструктор для просмотра панелей на фотографии вашей комнаты.',
  },
  {
    num: 2,
    icon: <AppstoreOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Рассчитайте площадь',
    desc: 'В конструкторе укажите длину и высоту стен. Система автоматически рассчитает количество панелей с учётом 10% запаса на подрезку. Вы сразу увидите итоговую стоимость материалов и монтажа.',
    detail: 'Расчёт занимает не более 3 минут. Консультант всегда готов помочь онлайн.',
  },
  {
    num: 3,
    icon: <ShoppingCartOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Оформите заказ',
    desc: 'Добавьте выбранные панели в корзину, укажите адрес доставки и удобное время для визита мастера. Оплата онлайн, в рассрочку или наличными — выбирайте то, что удобно вам.',
    detail: 'При заказе от 50 000 ₽ доставка бесплатна. Принимаем все банковские карты.',
  },
  {
    num: 4,
    icon: <ToolOutlined style={{ fontSize: 28, color: '#fff' }} />,
    title: 'Профессиональный монтаж',
    desc: 'Сертифицированный мастер приедет в согласованное время. Стандартный монтаж занимает 2–4 часа в зависимости от площади. Мастер убирает за собой весь мусор и проводит инструктаж по уходу за панелями.',
    detail: 'Гарантия на монтажные работы — 5 лет. Все мастера застрахованы.',
  },
];

// ─── Guarantees data ──────────────────────────────────────────────────────────

const guarantees = [
  {
    icon: <SafetyCertificateOutlined style={{ fontSize: 26, color: GREEN }} />,
    title: '5 лет гарантии',
    desc: 'На все материалы и монтажные работы. При любом дефекте производства устраним бесплатно.',
  },
  {
    icon: <GiftOutlined style={{ fontSize: 26, color: GREEN }} />,
    title: 'Бесплатный монтаж',
    desc: 'При заказе от 20 м² монтаж включён в стоимость. Никаких скрытых платежей.',
  },
  {
    icon: <TeamOutlined style={{ fontSize: 26, color: GREEN }} />,
    title: 'Опытные мастера',
    desc: 'Каждый монтажник имеет не менее 3 лет опыта и прошёл нашу сертификацию.',
  },
  {
    icon: <CarOutlined style={{ fontSize: 26, color: GREEN }} />,
    title: 'Быстрая доставка',
    desc: 'Доставка по Москве за 1 день, по России за 3–7 рабочих дней.',
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
    {/* Hero */}
    <section style={{ background: '#F5F5F5', padding: '80px 24px 88px' }}>
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
            Простой процесс
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
            Как это работает
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
            От выбора дизайна до готового результата — всего 4 простых шага.
            Мы берём на себя всё, чтобы ваш опыт был максимально комфортным.
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
                borderBottom: i < processSteps.length - 1 ? '1px solid #F3F4F6' : 'none',
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
                      fontWeight: 700,
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
                    fontWeight: 800,
                    color: DARK,
                    margin: 0,
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
                fontWeight: 800,
                color: DARK,
                margin: 0,
                textAlign: 'center',
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
              <motion.div key={g.title} variants={fadeUp} custom={i + 2}>
                <Card
                  style={{ borderRadius: 14, border: '1px solid #E5E7EB', boxShadow: 'none', height: '100%' }}
                  styles={{ body: { padding: '28px 24px' } }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>{g.icon}</div>
                    <div>
                      <h3
                        style={{
                          fontFamily: FONT,
                          fontSize: 17,
                          fontWeight: 700,
                          color: DARK,
                          margin: '0 0 8px',
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
                fontWeight: 800,
                color: DARK,
                margin: 0,
              }}
            >
              Частые вопросы
            </h2>
          </motion.div>

          <motion.div variants={fadeUp} custom={1}>
            <Collapse
              items={faqItems}
              style={{ borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff' }}
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
