import { motion } from 'framer-motion';
import type { PanelProduct } from '../model/types';

interface Props {
  forms: PanelProduct[];
  currentId: string;
  onSelect: (id: string) => void;
}

export default function FormSwitcher({ forms, currentId, onSelect }: Props) {
  const others = forms.filter((f) => f.id !== currentId);
  if (others.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
        Другие формы
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          padding: '4px 0',
        }}
      >
        {others.map((form) => (
          <motion.button
            key={form.id}
            onClick={() => onSelect(form.id)}
            whileHover={{ scale: 1.04, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              flexShrink: 0,
              width: 140,
              scrollSnapAlign: 'start',
              border: 'none',
              background: '#F5F5F5',
              borderRadius: 16,
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              textAlign: 'left',
            }}
          >
            <img
              src={form.previewImage || form.image}
              alt={form.name}
              style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '8px 12px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#2D2D2D', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {form.name}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
