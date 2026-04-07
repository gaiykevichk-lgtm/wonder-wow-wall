import React, { useState } from 'react';
import { Tag } from 'antd';
import { motion } from 'framer-motion';

// ─── Style constants ──────────────────────────────────────────────────────────

const BLUE = '#0071e3';
const DARK = '#1d1d1f';
const GRAY_TEXT = '#86868b';
const FONT = 'Inter, sans-serif';
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1080, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: i * 0.08 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

// ─── Filters ──────────────────────────────────────────────────────────────────

const filters = [
  { key: 'all', label: 'Все' },
  { key: 'apartment', label: 'Квартиры' },
  { key: 'office', label: 'Офисы' },
  { key: 'restaurant', label: 'Рестораны' },
];

// ─── Projects data ────────────────────────────────────────────────────────────

const projects = [
  {
    id: '1',
    type: 'apartment',
    typeLabel: 'Квартира',
    title: 'Скандинавская гостиная',
    desc: 'Деревянные панели светлого ясеня создают уютную атмосферу скандинавского стиля. Площадь: 34 м².',
    image: 'https://images.unsplash.com/photo-1723810779771-f5895e975ba1?w=600&h=500&fit=crop',
  },
  {
    id: '2',
    type: 'office',
    typeLabel: 'Офис',
    title: 'Переговорная комната',
    desc: 'Строгие геометрические панели в тёмных тонах подчёркивают деловой стиль переговорной зоны.',
    image: 'https://images.unsplash.com/photo-1755096731687-d0b6efac246d?w=600&h=500&fit=crop',
  },
  {
    id: '3',
    type: 'restaurant',
    typeLabel: 'Ресторан',
    title: 'Акцентная стена бара',
    desc: '3D-панели в форме волны с подсветкой создают атмосферное пространство для гостей заведения.',
    image: 'https://images.unsplash.com/photo-1521607630287-ee2e81ad3ced?w=600&h=500&fit=crop',
  },
  {
    id: '4',
    type: 'apartment',
    typeLabel: 'Квартира',
    title: 'Спальня в стиле лофт',
    desc: 'Бетонные панели с фактурой грубого камня органично вписались в интерьер городского лофта.',
    image: 'https://images.unsplash.com/photo-1555794812-7f4102b3773b?w=600&h=500&fit=crop',
  },
  {
    id: '5',
    type: 'office',
    typeLabel: 'Офис',
    title: 'Рецепция IT-компании',
    desc: 'Белые 3D-панели с фирменным логотипом создают современный и профессиональный образ компании.',
    image: 'https://images.unsplash.com/photo-1584530313715-bfe628686135?w=600&h=500&fit=crop',
  },
  {
    id: '6',
    type: 'restaurant',
    typeLabel: 'Ресторан',
    title: 'Японский ресторан',
    desc: 'Деревянные рейки в японском стиле создают медитативную атмосферу и зонируют пространство.',
    image: 'https://images.unsplash.com/photo-1722109997425-40f920848aed?w=600&h=500&fit=crop',
  },
];

// ─── ProjectCard ──────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{ project: typeof projects[0]; index: number }> = ({ project, index }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      whileHover={{ translateY: -2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.04)',
        background: '#fff',
        cursor: 'pointer',
        boxShadow: hovered ? '0 8px 30px rgba(0,0,0,0.08)' : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <img
          src={project.image}
          alt={project.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.4s ease',
          }}
        />
        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hovered
              ? 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)'
              : 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 60%)',
            transition: 'background 0.3s ease',
          }}
        />
        {/* Type tag */}
        <Tag
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            background: BLUE,
            color: '#fff',
            border: 'none',
            borderRadius: 20,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 12,
            padding: '3px 12px',
          }}
        >
          {project.typeLabel}
        </Tag>
      </div>

      {/* Info */}
      <div style={{ padding: '20px 22px 24px' }}>
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
          {project.title}
        </h3>
        <p
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: GRAY_TEXT,
            margin: 0,
            lineHeight: 1.65,
          }}
        >
          {project.desc}
        </p>
      </div>
    </motion.div>
  );
};

// ─── PortfolioPage ────────────────────────────────────────────────────────────

const PortfolioPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = activeFilter === 'all'
    ? projects
    : projects.filter((p) => p.type === activeFilter);

  return (
    <div style={{ fontFamily: FONT, paddingTop: 72 }}>
      {/* Hero */}
      <section style={{ background: '#F5F5F7', padding: '120px 24px' }}>
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
              Наши работы
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
              Портфолио проектов
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              style={{
                fontFamily: FONT,
                fontSize: 17,
                color: GRAY_TEXT,
                margin: 0,
                maxWidth: 540,
                lineHeight: 1.65,
              }}
            >
              Реализованные проекты в квартирах, офисах и ресторанах — вдохновитесь
              для вашего интерьера.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Filter tabs + grid */}
      <section style={{ background: '#fff', padding: '64px 24px 88px' }}>
        <div style={{ ...MAX_WIDTH }}>
          {/* Filter tabs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: 0.15 }}
            style={{ display: 'flex', gap: 8, marginBottom: 48, flexWrap: 'wrap' }}
          >
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  background: activeFilter === f.key ? DARK : '#F5F5F7',
                  color: activeFilter === f.key ? '#fff' : DARK,
                  border: 'none',
                  borderRadius: 980,
                  padding: '8px 22px',
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {f.label}
              </button>
            ))}
          </motion.div>

          {/* Projects grid */}
          <motion.div
            key={activeFilter}
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 28,
            }}
          >
            {filtered.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </motion.div>

          {filtered.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 24px',
                fontFamily: FONT,
                fontSize: 16,
                color: GRAY_TEXT,
              }}
            >
              Проекты не найдены
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PortfolioPage;
