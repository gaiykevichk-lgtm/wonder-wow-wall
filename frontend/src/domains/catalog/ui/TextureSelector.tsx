import { motion } from 'framer-motion';
import type { Texture } from '../model/types';

interface Props {
  textures: Texture[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function TextureSelector({ textures, activeId, onChange }: Props) {
  if (textures.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, textAlign: 'center' }}>
        Текстура
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {textures.map((t) => {
          const active = t.id === activeId;
          return (
            <motion.button
              key={t.id}
              onClick={() => onChange(t.id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 16,
                border: active ? '2px solid #4CAF50' : '2px solid transparent',
                background: active ? 'rgba(76, 175, 80, 0.06)' : '#fff',
                cursor: 'pointer',
                minWidth: 90,
                transition: 'border-color 0.25s, background 0.25s',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: active ? '0 2px 12px rgba(76, 175, 80, 0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                {t.swatchImage ? (
                  <img src={t.swatchImage} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#E8E8ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    🧱
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 500, color: active ? '#2D2D2D' : '#6B7280', lineHeight: 1.2, textAlign: 'center' }}>
                {t.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
