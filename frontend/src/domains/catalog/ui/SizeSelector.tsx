import { useCallback, useRef } from 'react';
import { PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';

interface Props {
  activeSizeKey: string;
  onChange: (sizeKey: string) => void;
  designPrice?: number;
}

const sizeKeys = PANEL_SIZES.map((s) => `${s.width}x${s.height}`);

export default function SizeSelector({ activeSizeKey, onChange, designPrice }: Props) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const idx = sizeKeys.indexOf(activeSizeKey);
      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (idx + 1) % sizeKeys.length;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (idx - 1 + sizeKeys.length) % sizeKeys.length;
        e.preventDefault();
      } else {
        return;
      }
      onChange(sizeKeys[next]);
      const el = groupRef.current?.querySelector(`[data-size-key="${sizeKeys[next]}"]`) as HTMLElement | null;
      el?.focus();
    },
    [activeSizeKey, onChange],
  );

  return (
    <div>
      <div
        id="size-selector-label"
        style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, textAlign: 'center' }}
      >
        Размер
      </div>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="size-selector-label"
        onKeyDown={handleKeyDown}
        style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}
      >
        {PANEL_SIZES.map((s) => {
          const key = `${s.width}x${s.height}`;
          const active = key === activeSizeKey;
          const price = (BASE_PANEL_PRICES[key] ?? 0) + (designPrice ?? DESIGN_OVERLAY_PRICE);
          return (
            <button
              key={key}
              data-size-key={key}
              role="radio"
              aria-checked={active}
              aria-label={`${s.label}, ${price.toLocaleString('ru-RU')} рублей`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '12px 20px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                border: '1.5px solid',
                borderColor: active ? '#4CAF50' : '#D1D5DB',
                background: active ? '#4CAF50' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#2D2D2D',
                transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                minWidth: 100,
              }}
            >
              <span>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
                {price.toLocaleString('ru-RU')} ₽
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
