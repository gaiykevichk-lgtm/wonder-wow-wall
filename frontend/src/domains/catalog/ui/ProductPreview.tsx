import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from 'antd';

const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

interface Props {
  imagePath: string | null;
  fallbackImage: string;
  altText: string;
  isLoading?: boolean;
}

export default function ProductPreview({ imagePath, fallbackImage, altText, isLoading }: Props) {
  const src = imagePath || fallbackImage;

  return (
    <div style={{ background: '#F5F5F5', borderRadius: 28, overflow: 'hidden', position: 'relative', aspectRatio: '4/3' }}>
      {isLoading ? (
        <Skeleton.Image
          active
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.img
            key={src}
            src={src}
            alt={altText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
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
  );
}
