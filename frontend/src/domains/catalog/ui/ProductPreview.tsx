import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from 'antd';

const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

interface Props {
  imagePath: string | null;
  fallbackImage: string;
  altText: string;
  isLoading?: boolean;
}

function getSideImage(src: string): string | null {
  if (src.includes('-front.')) {
    return src.replace('-front.', '-side.');
  }
  return null;
}

export default function ProductPreview({ imagePath, fallbackImage, altText, isLoading }: Props) {
  const mainSrc = imagePath || fallbackImage;
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
  }, [mainSrc]);

  const gallery = useMemo(() => {
    const imgs = [mainSrc];
    const side = getSideImage(mainSrc);
    if (side) imgs.push(side);
    return imgs;
  }, [mainSrc]);

  const currentSrc = gallery[activeIdx] || gallery[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Main image */}
      <div style={{ background: '#F5F5F5', borderRadius: 28, overflow: 'hidden', position: 'relative', aspectRatio: '4/3' }}>
        {isLoading ? (
          <Skeleton.Image
            active
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.img
              key={currentSrc}
              src={currentSrc}
              alt={altText}
              decoding="async"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
            />
          </AnimatePresence>
        )}
        {!imagePath && !isLoading && (
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            color: '#fff',
            fontWeight: 500,
          }}>
            Фото для этой комбинации скоро появится
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {gallery.length > 1 && !isLoading && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {gallery.map((src, idx) => (
            <button
              key={src}
              onClick={() => setActiveIdx(idx)}
              aria-label={idx === 0 ? 'Вид спереди' : 'Вид под углом'}
              style={{
                width: 64,
                height: 48,
                borderRadius: 12,
                overflow: 'hidden',
                border: idx === activeIdx ? '2px solid #4CAF50' : '2px solid #E5E7EB',
                cursor: 'pointer',
                padding: 0,
                background: '#F5F5F5',
                transition: 'border-color 0.2s',
              }}
            >
              <img
                src={src}
                alt={idx === 0 ? 'Вид спереди' : 'Вид под углом'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
