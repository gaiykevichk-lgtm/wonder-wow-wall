import React, { useState } from 'react';
import { Tag } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import { motion } from 'framer-motion';

// ─── Style constants ──────────────────────────────────────────────────────────

const ACCENT = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
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

// ─── SVG Icons (flat style) ──────────────────────────────────────────────────

const ApartmentIcon = ({ color = '#4CAF50', size = 80 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="25" width="60" height="45" rx="4" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2.5"/>
    <rect x="18" y="35" width="12" height="12" rx="2" fill={color}/>
    <rect x="34" y="35" width="12" height="12" rx="2" fill={color}/>
    <rect x="50" y="35" width="12" height="12" rx="2" fill={color}/>
    <rect x="18" y="52" width="12" height="12" rx="2" fill={color} fillOpacity="0.5"/>
    <rect x="34" y="52" width="12" height="12" rx="2" fill={color} fillOpacity="0.5"/>
    <rect x="50" y="52" width="12" height="12" rx="2" fill={color}/>
    <path d="M40 10 L60 25 L20 25 Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

const OfficeIcon = ({ color = '#4CAF50', size = 80 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="18" width="64" height="52" rx="4" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2.5"/>
    <rect x="16" y="26" width="20" height="14" rx="2" fill={color}/>
    <rect x="44" y="26" width="20" height="14" rx="2" fill={color}/>
    <rect x="16" y="46" width="48" height="18" rx="2" fill={color} fillOpacity="0.4"/>
    <rect x="30" y="50" width="20" height="10" rx="1" fill={color}/>
    <circle cx="60" cy="24" r="4" fill={color}/>
  </svg>
);

const RestaurantIcon = ({ color = '#4CAF50', size = 80 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="60" rx="30" ry="8" fill={color} fillOpacity="0.15"/>
    <path d="M20 30 Q20 18 40 18 Q60 18 60 30" stroke={color} strokeWidth="2.5" fill={color} fillOpacity="0.15"/>
    <rect x="18" y="30" width="44" height="25" rx="4" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2.5"/>
    <rect x="28" y="38" width="10" height="14" rx="2" fill={color}/>
    <rect x="42" y="38" width="10" height="14" rx="2" fill={color}/>
    <path d="M32 18 Q36 12 40 18 Q44 12 48 18" stroke={color} strokeWidth="2" fill="none"/>
    <rect x="36" y="10" width="8" height="8" rx="1" fill={color}/>
  </svg>
);

// ─── Projects data ────────────────────────────────────────────────────────────

const projects = [
  {
    id: '1',
    type: 'apartment',
    typeLabel: 'Квартира',
    title: 'Скандинавская гостиная',
    desc: 'Деревянные панели светлого ясеня создают уютную атмосферу скандинавского стиля. Площадь: 34 м².',
    icon: 'apartment',
  },
  {
    id: '2',
    type: 'office',
    typeLabel: 'Офис',
    title: 'Переговорная комната',
    desc: 'Строгие геометрические панели в тёмных тонах подчёркивают деловой стиль переговорной зоны.',
    icon: 'office',
  },
  {
    id: '3',
    type: 'restaurant',
    typeLabel: 'Ресторан',
    title: 'Акцентная стена бара',
    desc: '3D-панели в форме волны с подсветкой создают атмосферное пространство для гостей заведения.',
    icon: 'restaurant',
  },
  {
    id: '4',
    type: 'apartment',
    typeLabel: 'Квартира',
    title: 'Спальня в стиле лофт',
    desc: 'Бетонные панели с фактурой грубого камня органично вписались в интерьер городского лофта.',
    icon: 'apartment',
  },
  {
    id: '5',
    type: 'office',
    typeLabel: 'Офис',
    title: 'Рецепция IT-компании',
    desc: 'Белые 3D-панели с фирменным логотипом создают современный и профессиональный образ компании.',
    icon: 'office',
  },
  {
    id: '6',
    type: 'restaurant',
    typeLabel: 'Ресторан',
    title: 'Японский ресторан',
    desc: 'Деревянные рейки в японском стиле создают медитативную атмосферу и зонируют пространство.',
    icon: 'restaurant',
  },
];

// ─── Icon renderer ────────────────────────────────────────────────────────────

const IconRenderer: React.FC<{ icon: string; color?: string }> = ({ icon, color = '#4CAF50' }) => {
  switch (icon) {
    case 'apartment':
      return <ApartmentIcon color={color} />;
    case 'office':
      return <OfficeIcon color={color} />;
    case 'restaurant':
      return <RestaurantIcon color={color} />;
    default:
      return <ApartmentIcon color={color} />;
  }
};

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
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.04)',
        background: '#fff',
        cursor: 'pointer',
        boxShadow: hovered ? '0 8px 30px rgba(0,0,0,0.08)' : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Icon area */}
      <div
        style={{
          position: 'relative',
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: hovered
            ? `linear-gradient(135deg, ${ACCENT}08 0%, ${ACCENT}15 100%)`
            : 'linear-gradient(135deg, #f8f9fa 0%, #f0f1f2 100%)',
          transition: 'background 0.4s ease',
        }}
      >
        <IconRenderer icon={project.icon} color={hovered ? ACCENT : GRAY_TEXT} />
        <Tag
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 16,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 12,
            padding: '3px 12px',
            zIndex: 5,
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
      <PageMeta title="Портфолио" description="Примеры реализованных проектов Wonder Wow Wall." />
      {/* Hero */}
      <section style={{ background: '#F5F5F5', padding: '120px 24px' }}>
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
                  background: activeFilter === f.key ? DARK : '#F5F5F5',
                  color: activeFilter === f.key ? '#fff' : DARK,
                  border: 'none',
                  borderRadius: 8,
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
