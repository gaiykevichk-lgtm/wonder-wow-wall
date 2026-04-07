import React from 'react';
import { Button, Tag } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { blogPosts } from './BlogPage';

const ACCENT = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';
const MAX_WIDTH: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const renderContent = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={key++}
          style={{
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 600,
            color: DARK,
            margin: '32px 0 12px',
            letterSpacing: '-0.03em',
          }}
        >
          {trimmed.slice(3)}
        </h2>,
      );
    } else {
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p
          key={key++}
          style={{
            fontFamily: FONT,
            fontSize: 16,
            color: DARK,
            margin: '0 0 16px',
            lineHeight: 1.75,
          }}
        >
          {parts.map((part, pi) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={pi}>{part.slice(2, -2)}</strong>
            ) : (
              part
            ),
          )}
        </p>,
      );
    }
  }
  return elements;
};

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div style={{ fontFamily: FONT, paddingTop: 72, minHeight: '100vh', background: '#fff' }}>
        <section style={{ padding: '120px 24px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 600, color: DARK }}>Статья не найдена</h1>
          <Button
            onClick={() => navigate('/blog')}
            style={{ marginTop: 24, borderRadius: 8, borderColor: ACCENT, color: ACCENT }}
          >
            Вернуться в блог
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, paddingTop: 72, minHeight: '100vh', background: '#fff' }}>
      {/* Hero image */}
      <div style={{ height: 400, overflow: 'hidden', position: 'relative' }}>
        <img
          src={post.image}
          alt={post.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Content */}
      <section style={{ padding: '48px 24px 120px' }}>
        <div style={{ ...MAX_WIDTH }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            {/* Back button */}
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/blog')}
              style={{
                fontFamily: FONT,
                fontSize: 14,
                color: GRAY_TEXT,
                padding: 0,
                marginBottom: 24,
              }}
            >
              Назад к статьям
            </Button>

            {/* Meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: GRAY_TEXT, fontSize: 13 }}>
                <CalendarOutlined /> {formatDate(post.date)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: GRAY_TEXT, fontSize: 13 }}>
                <ClockCircleOutlined /> {post.readTime}
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(28px, 3.5vw, 40px)',
                fontWeight: 600,
                color: DARK,
                margin: '0 0 32px',
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
              }}
            >
              {post.title}
            </h1>

            {/* Body */}
            <div>{renderContent(post.content)}</div>

            {/* CTA */}
            <div
              style={{
                marginTop: 48,
                padding: '32px',
                background: '#F5F5F5',
                borderRadius: 16,
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  fontFamily: FONT,
                  fontSize: 20,
                  fontWeight: 600,
                  color: DARK,
                  margin: '0 0 12px',
                }}
              >
                Хотите увидеть панели вживую?
              </h3>
              <p style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: '0 0 20px' }}>
                Посетите наш шоурум или попробуйте онлайн-конструктор
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button
                  onClick={() => navigate('/catalog')}
                  size="large"
                  style={{
                    background: ACCENT,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    height: 44,
                    padding: '0 28px',
                    fontFamily: FONT,
                    fontWeight: 600,
                  }}
                >
                  Смотреть каталог
                </Button>
                <Button
                  onClick={() => navigate('/constructor')}
                  size="large"
                  style={{
                    background: 'transparent',
                    color: ACCENT,
                    border: `1px solid ${ACCENT}`,
                    borderRadius: 8,
                    height: 44,
                    padding: '0 28px',
                    fontFamily: FONT,
                    fontWeight: 600,
                  }}
                >
                  Открыть конструктор
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default BlogPostPage;
