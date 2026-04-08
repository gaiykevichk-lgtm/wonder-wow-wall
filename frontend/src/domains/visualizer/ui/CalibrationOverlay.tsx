import { Select, InputNumber, Button, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { CalibrationPoints } from '../model/types';

const { Text } = Typography;

const REFERENCE_PRESETS = [
  { label: 'Дверь (200 см)', value: 200 },
  { label: 'Окно (120 см)', value: 120 },
  { label: 'Розетка / выключатель (8 см)', value: 8 },
  { label: 'Своё значение', value: -1 },
];

interface CalibrationOverlayProps {
  points: CalibrationPoints;
  onReferenceChange: (cm: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

export function CalibrationOverlay({
  points,
  onReferenceChange,
  onApply,
  onCancel,
}: CalibrationOverlayProps) {
  const hasStart = points.start !== null;
  const hasEnd = points.end !== null;
  const canApply = hasStart && hasEnd && points.referenceCm > 0;

  const distPx = hasStart && hasEnd
    ? Math.hypot(points.end!.x - points.start!.x, points.end!.y - points.start!.y)
    : 0;

  return (
    <div
      data-testid="calibration-overlay"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '12px 16px',
        background: '#2D2D2D',
        borderRadius: 10,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: 500, color: '#FFFFFF' }}>
        Калибровка масштаба
      </Text>

      <Text style={{ fontSize: 13, color: '#6B7280' }}>
        {!hasStart
          ? 'Кликните на начало объекта известного размера'
          : !hasEnd
            ? 'Кликните на конец объекта'
            : `Расстояние: ${Math.round(distPx)} px`}
      </Text>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Select
          size="small"
          value={REFERENCE_PRESETS.some((p) => p.value === points.referenceCm) ? points.referenceCm : -1}
          onChange={(val) => {
            if (val > 0) onReferenceChange(val);
          }}
          options={REFERENCE_PRESETS}
          style={{ flex: 1, borderRadius: 8 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <InputNumber
          size="small"
          min={1}
          max={1000}
          value={points.referenceCm}
          onChange={(val) => val && onReferenceChange(val)}
          addonAfter="см"
          style={{ flex: 1 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          disabled={!canApply}
          onClick={onApply}
          style={{
            flex: 1,
            background: canApply ? '#4CAF50' : undefined,
            borderColor: canApply ? '#4CAF50' : undefined,
            borderRadius: 8,
          }}
        >
          Применить
        </Button>
        <Button
          size="small"
          icon={<CloseOutlined />}
          onClick={onCancel}
          style={{ borderRadius: 8 }}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
