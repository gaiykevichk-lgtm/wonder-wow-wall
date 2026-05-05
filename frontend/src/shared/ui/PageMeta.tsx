import { Helmet } from 'react-helmet-async';

interface PageMetaProps {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
}

const SITE_NAME = 'Wonder Wow Wall';
const DEFAULT_DESCRIPTION =
  'Инновационный сервис отделки стен модульными пластинами. 100 000+ вариантов дизайна, монтаж за 2 часа, гибкая подписка.';
const DEFAULT_OG_IMAGE = '/logo.png';

export function PageMeta({ title, description, ogImage, ogType }: PageMetaProps) {
  const fullTitle = title === 'Главная' ? SITE_NAME : `${title} — ${SITE_NAME}`;
  const desc = description || DEFAULT_DESCRIPTION;
  const img = ogImage || DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content={ogType || 'website'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
    </Helmet>
  );
}
