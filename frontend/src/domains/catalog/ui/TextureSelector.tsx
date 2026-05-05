import { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Texture } from '../model/types';

interface Props {
  textures: Texture[];
  activeId: string;
  onChange: (id: string) => void;
  onHover?: (id: string) => void;
}

const TEXTURE_VISUALS: Record<string, { gradient: string; icon: string }> = {
  leather:    { gradient: 'linear-gradient(135deg, #8B4513 0%, #A0522D 50%, #6B3410 100%)', icon: '🐂' },
  textile:    { gradient: 'linear-gradient(135deg, #9CA3AF 0%, #D1D5DB 50%, #6B7280 100%)', icon: '🧵' },
  wood:       { gradient: 'linear-gradient(135deg, #DEB887 0%, #D2A679 50%, #C49A6C 100%)', icon: '🪵' },
  metal:      { gradient: 'linear-gradient(135deg, #9CA3AF 0%, #E5E7EB 40%, #6B7280 100%)', icon: '⚙️' },
  stone:      { gradient: 'linear-gradient(135deg, #A3A9B5 0%, #D5D8DC 50%, #8E9299 100%)', icon: '🪨' },
  'natural-stone': { gradient: 'linear-gradient(135deg, #A3A9B5 0%, #D5D8DC 50%, #8E9299 100%)', icon: '🪨' },
  decorative: { gradient: 'linear-gradient(135deg, #F9A8D4 0%, #C084FC 50%, #818CF8 100%)', icon: '✦' },
  paint:      { gradient: 'linear-gradient(135deg, #60A5FA 0%, #34D399 50%, #FBBF24 100%)', icon: '🎨' },
  graphics:   { gradient: 'linear-gradient(135deg, #2D2D2D 0%, #4B5563 50%, #1F2937 100%)', icon: '◆' },
};

function getVisual(slug: string) {
  return TEXTURE_VISUALS[slug] ?? { gradient: 'linear-gradient(135deg, #E8E8ED 0%, #D1D5DB 100%)', icon: '■' };
}

export default function TextureSelector({ textures, activeId, onChange, onHover }: Props) {
  if (textures.length === 0) return null;

  const groupRef = useRef<HTMLDivElement>(null);
  const activeName = textures.find((t) => t.id === activeId)?.name ?? '';

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = textures.findIndex((t) => t.id === activeId);
      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (idx + 1) % textures.length;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (idx - 1 + textures.length) % textures.length;
        e.preventDefault();
      } else {
        return;
      }
      onChange(textures[next].id);
      const el = groupRef.current?.querySelector(`[data-texture-id="${textures[next].id}"]`) as HTMLElement | null;
      el?.focus();
    },
    [textures, activeId, onChange],
  );

  return (
    <div>
      <div
        id="texture-selector-label"
        style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}
      >
        Текстура
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeName}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
          style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', marginBottom: 16, textAlign: 'center', minHeight: 22 }}
        >
          {activeName}
        </motion.div>
      </AnimatePresence>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="texture-selector-label"
        onKeyDown={handleKeyDown}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {textures.map((t) => {
          const active = t.id === activeId;
          const visual = getVisual(t.slug);
          return (
            <motion.button
              key={t.id}
              data-texture-id={t.id}
              role="radio"
              aria-checked={active}
              aria-label={t.name}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onMouseEnter={() => onHover?.(t.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '10px 4px 8px',
                borderRadius: 12,
                border: active ? '2px solid #4CAF50' : '2px solid transparent',
                background: active ? 'rgba(76, 175, 80, 0.06)' : 'transparent',
                cursor: 'pointer',
                transition: 'border-color 0.25s, background 0.25s',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: active ? '0 2px 10px rgba(76, 175, 80, 0.3)' : '0 1px 4px rgba(0,0,0,0.1)',
                  transition: 'box-shadow 0.25s',
                }}
              >
                {t.swatchImage ? (
                  <img src={t.swatchImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: visual.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    {visual.icon}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 600 : 500,
                color: active ? '#2D2D2D' : '#6B7280',
                lineHeight: 1.25,
                textAlign: 'center',
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}>
                {t.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
