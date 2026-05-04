import { Tooltip } from 'antd';
import type { TextureColor } from '../model/types';

interface Props {
  colors: TextureColor[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function ColorSelector({ colors, activeId, onChange }: Props) {
  if (colors.length === 0) return null;

  const activeName = colors.find((c) => c.id === activeId)?.name ?? '';

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}>
        Цвет
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', marginBottom: 16, textAlign: 'center', minHeight: 22 }}>
        {activeName}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        {colors.map((c) => {
          const active = c.id === activeId;
          const hasSwatch = !!c.swatchImage;
          return (
            <Tooltip key={c.id} title={c.name}>
              <button
                onClick={() => onChange(c.id)}
                aria-label={c.name}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  position: 'relative',
                  outline: active ? `3px solid ${c.hex}` : '3px solid transparent',
                  outlineOffset: 3,
                  boxShadow: active ? '0 0 0 5px rgba(0,0,0,0.08)' : '0 0 0 1px rgba(0,0,0,0.12)',
                  transition: 'outline 0.25s, box-shadow 0.25s, transform 0.25s',
                  transform: active ? 'scale(1.15)' : 'scale(1)',
                  overflow: 'hidden',
                  background: hasSwatch ? 'transparent' : c.hex,
                }}
              >
                {hasSwatch && (
                  <img
                    src={c.swatchImage}
                    alt={c.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                )}
                {active && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
