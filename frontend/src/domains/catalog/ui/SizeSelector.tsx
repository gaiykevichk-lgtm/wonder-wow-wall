import { PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE } from '../../../shared/config/constants';

interface Props {
  activeSizeKey: string;
  onChange: (sizeKey: string) => void;
}

export default function SizeSelector({ activeSizeKey, onChange }: Props) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, textAlign: 'center' }}>
        Размер
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {PANEL_SIZES.map((s) => {
          const key = `${s.width}x${s.height}`;
          const active = key === activeSizeKey;
          const price = (BASE_PANEL_PRICES[key] ?? 0) + DESIGN_OVERLAY_PRICE;
          return (
            <button
              key={key}
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
