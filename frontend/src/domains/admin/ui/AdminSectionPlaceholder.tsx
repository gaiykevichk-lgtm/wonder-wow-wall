import { Typography } from 'antd';

const DARK = '#2D2D2D';
const GREEN = '#4CAF50';
const GRAY_TEXT = '#6B7280';
const FONT = "'SF Pro Display', sans-serif";

/**
 * Shared empty-state card used by all 8 Phase-2 section pages.
 *
 * Each section will replace its own page body in later phases (3–8). Until
 * then, pages keep the same shape so route navigation, breadcrumbs and
 * layout work end-to-end — only the content differs.
 */
interface Props {
  title: string;
  phase: string;
  description: string;
}

export function AdminSectionPlaceholder({ title, phase, description }: Props) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '32px 32px 40px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        fontFamily: FONT,
        color: DARK,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontSize: 12,
          letterSpacing: 1.5,
          color: GREEN,
          background: 'rgba(76,175,80,0.08)',
          padding: '4px 10px',
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        {phase}
      </div>
      <Typography.Title level={2} style={{ margin: '0 0 12px', color: DARK, fontWeight: 600 }}>
        {title}
      </Typography.Title>
      <Typography.Paragraph style={{ color: GRAY_TEXT, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
        {description}
      </Typography.Paragraph>
    </section>
  );
}
