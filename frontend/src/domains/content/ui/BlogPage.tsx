import React from 'react';
import { Tag } from 'antd';
import { PageMeta } from '../../../shared/ui/PageMeta';
import { CalendarOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ACCENT = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = "'SF Pro Display', sans-serif";
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

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image: string;
  readTime: string;
  content: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'trendy-stenovykh-panelej-2026',
    title: 'Тренды стеновых панелей 2026: что выбирают дизайнеры',
    excerpt: 'Обзор ключевых тенденций в оформлении стен — от натуральных текстур до 3D-рельефов и экологичных материалов.',
    category: 'Тренды',
    date: '2026-03-28',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=500&fit=crop',
    readTime: '5 мин',
    content: `## Натуральные текстуры в тренде

В 2026 году дизайнеры интерьеров всё чаще обращаются к натуральным материалам. Деревянные панели из переработанной древесины, пробковые покрытия и камень — это не просто модно, это осознанный выбор в пользу экологии.

## 3D-рельефы: новое измерение стен

Объёмные панели с геометрическими паттернами остаются одним из самых популярных решений. Они добавляют глубину пространству и играют со светом, создавая динамичные тени в течение дня.

## Экологичные материалы

Потребители всё внимательнее относятся к составу отделочных материалов. Панели из переработанного пластика, бамбука и вторичной древесины занимают всё большую долю рынка.

## Микс текстур

Комбинирование разных фактур на одной стене — ещё один яркий тренд. Гладкие и рельефные панели, чередование дерева и камня создают уникальные интерьерные решения.`,
  },
  {
    slug: 'kejs-kvartira-na-patriarshikh',
    title: 'Кейс: как мы оформили квартиру на Патриарших за 1 день',
    excerpt: 'История реального проекта — от замера до готового результата. Фото до/после и отзыв клиента.',
    category: 'Кейсы',
    date: '2026-03-15',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop',
    readTime: '7 мин',
    content: `## Задача клиента

Владелица квартиры на Патриарших обратилась к нам с просьбой обновить гостиную. Основные требования: минимальное время монтажа, отсутствие пыли и шума (в квартире живёт кот), скандинавский стиль.

## Выбор панелей

Совместно с дизайнером подобрали деревянные панели из светлого ясеня размером 30×30 см. Три стены — нейтральный белый, одна акцентная — с текстурой дерева.

## Процесс монтажа

Бригада из двух мастеров приехала в 10:00. К 13:30 все панели были установлены, строительный мусор убран. Кот не пострадал.

## Результат

Клиентка осталась довольна. Общая стоимость проекта составила 48 000 ₽ (материалы + монтаж). Гостиная площадью 22 м² была полностью преображена за один рабочий день.`,
  },
  {
    slug: 'kak-vybrat-paneli-dlya-vannoj',
    title: 'Как выбрать панели для ванной комнаты: полный гид',
    excerpt: 'Влагостойкость, уход, стиль — разбираем все нюансы выбора стеновых панелей для влажных помещений.',
    category: 'Советы',
    date: '2026-03-01',
    image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=500&fit=crop',
    readTime: '6 мин',
    content: `## Влагостойкость — главный критерий

Для ванной комнаты подходят только панели с классом влагостойкости не ниже B1. В нашем каталоге такие панели отмечены специальной иконкой.

## Какие материалы подходят

**ПВХ-панели** — самый бюджетный вариант, полностью водонепроницаемы. **Композитные панели** — средний ценовой сегмент, сочетают красоту и практичность. **Камень и керамика** — премиум-решение с максимальной долговечностью.

## Уход и обслуживание

Панели для ванной достаточно протирать влажной тряпкой раз в неделю. Не используйте абразивные губки и агрессивные моющие средства.

## Популярные стили

Для ванных комнат чаще всего выбирают имитацию мрамора, бетона и дерева. Белые и светло-серые тона визуально увеличивают пространство.`,
  },
  {
    slug: 'paneli-vs-oboi-sravnenie',
    title: 'Панели vs обои: что выгоднее в долгосрочной перспективе',
    excerpt: 'Сравниваем стоимость владения, долговечность и эстетику двух популярных решений для отделки стен.',
    category: 'Советы',
    date: '2026-02-18',
    image: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800&h=500&fit=crop',
    readTime: '4 мин',
    content: `## Первоначальные затраты

Обои обходятся дешевле на старте: от 500 ₽/м² с работой. Панели — от 1 200 ₽/м². Но это только начало истории.

## Долговечность

Средний срок службы обоев — 5-7 лет. Панели служат 15-20 лет без потери вида. За 20 лет вы переклеите обои 3 раза, а панели останутся как новые.

## Стоимость владения за 20 лет

Обои: 500 × 3 переклейки = 1 500 ₽/м². Панели: 1 200 ₽/м² (один раз). Панели выгоднее на 20%.

## Эстетика и практичность

Панели не выгорают на солнце, не боятся влаги и механических повреждений. Их можно мыть, а при повреждении — заменить одну секцию, не переделывая всю стену.`,
  },
  {
    slug: 'oformlenie-detskoj-komnaty',
    title: '5 идей оформления детской комнаты стеновыми панелями',
    excerpt: 'Безопасные, яркие и легко заменяемые — почему панели идеальны для детских комнат.',
    category: 'Тренды',
    date: '2026-02-05',
    image: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&h=500&fit=crop',
    readTime: '5 мин',
    content: `## Безопасность прежде всего

Все наши панели для детских комнат сертифицированы по стандарту ЕАС и не содержат формальдегида. Мягкие 3D-панели из EVA-пены дополнительно защищают ребёнка от ушибов.

## Идея 1: Акцентная стена с животными

Панели с принтами животных создают игровую атмосферу. При этом три остальные стены остаются нейтральными.

## Идея 2: Зонирование цветом

Разделите комнату на зоны с помощью панелей разных цветов: спокойные тона для сна, яркие — для игровой зоны.

## Идея 3: Магнитные панели

Специальные панели с магнитным слоем позволяют крепить рисунки и поделки без скотча и гвоздей.

## Идея 4: Грифельные панели

Панели с грифельным покрытием — целая стена для рисования мелом. Легко моются влажной тряпкой.

## Идея 5: Растущий интерьер

С подпиской вы можете менять дизайн панелей по мере взросления ребёнка — от единорогов до космоса и далее.`,
  },
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const BlogPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: FONT, paddingTop: 72 }}>
      <PageMeta title="Блог" description="Статьи о дизайне интерьера, трендах и советах от Wonder Wow Wall." />
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
              Блог
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
              Статьи и советы
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
              Тренды в дизайне, кейсы клиентов и практические советы по выбору и уходу за панелями.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Articles grid */}
      <section style={{ background: '#fff', padding: '80px 24px 120px' }}>
        <div style={{ ...MAX_WIDTH }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 28,
            }}
          >
            {blogPosts.map((post, i) => (
              <motion.article
                key={post.slug}
                variants={fadeUp}
                custom={i}
                whileHover={{ translateY: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                onClick={() => navigate(`/blog/${post.slug}`)}
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '1px solid rgba(0,0,0,0.04)',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.3s ease',
                }}
              >
                <div style={{ height: 200, overflow: 'hidden' }}>
                  <img
                    src={post.image}
                    alt={post.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ padding: '20px 22px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Tag
                      style={{
                        background: `${ACCENT}15`,
                        color: ACCENT,
                        border: 'none',
                        borderRadius: 8,
                        fontFamily: FONT,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {post.category}
                    </Tag>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: GRAY_TEXT }}>
                      {post.readTime}
                    </span>
                  </div>
                  <h2
                    style={{
                      fontFamily: FONT,
                      fontSize: 17,
                      fontWeight: 600,
                      color: DARK,
                      margin: '0 0 8px',
                      letterSpacing: '-0.03em',
                      lineHeight: 1.3,
                    }}
                  >
                    {post.title}
                  </h2>
                  <p
                    style={{
                      fontFamily: FONT,
                      fontSize: 14,
                      color: GRAY_TEXT,
                      margin: '0 0 12px',
                      lineHeight: 1.6,
                    }}
                  >
                    {post.excerpt}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: GRAY_TEXT, fontSize: 12 }}>
                    <CalendarOutlined />
                    <span style={{ fontFamily: FONT }}>{formatDate(post.date)}</span>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default BlogPage;
