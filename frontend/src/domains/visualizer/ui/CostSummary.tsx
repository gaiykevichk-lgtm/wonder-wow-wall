import { Button, Tag, Typography } from 'antd';
import { ShoppingCartOutlined, CrownOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons';
import type { CostBreakdown } from '../model/types';
import { BASE_PANEL_PRICES } from '../../../shared/config/constants';

/** Map display size key (cm) → price key (mm) used in BASE_PANEL_PRICES */
const SIZE_TO_PRICE_KEY: Record<string, string> = {
  '30x30': '300x300',
  '30x60': '300x600',
  '60x60': '600x600',
};

const { Text, Title } = Typography;

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

interface CostSummaryProps {
  cost: CostBreakdown;
  hasSubscription: boolean;
  onAddToCart: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function CostSummary({
  cost,
  hasSubscription,
  onAddToCart,
  onSave,
  onExport,
}: CostSummaryProps) {
  return (
    <div
      data-testid="cost-summary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px',
        background: '#FAFAFA',
        borderRadius: 16,
        border: '1px solid #E5E7EB',
      }}
    >
      <Title level={5} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2D2D2D' }}>
        Стоимость
      </Title>

      {/* Panel counts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cost.panelsBySize['30x30'] > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">30×30 см × {cost.panelsBySize['30x30']}</Text>
            <Text>{fmt(cost.panelsBySize['30x30'] * BASE_PANEL_PRICES[SIZE_TO_PRICE_KEY['30x30']!]!)} ₽</Text>
          </div>
        )}
        {cost.panelsBySize['30x60'] > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">30×60 см × {cost.panelsBySize['30x60']}</Text>
            <Text>{fmt(cost.panelsBySize['30x60'] * BASE_PANEL_PRICES[SIZE_TO_PRICE_KEY['30x60']!]!)} ₽</Text>
          </div>
        )}
        {cost.panelsBySize['60x60'] > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">60×60 см × {cost.panelsBySize['60x60']}</Text>
            <Text>{fmt(cost.panelsBySize['60x60'] * BASE_PANEL_PRICES[SIZE_TO_PRICE_KEY['60x60']!]!)} ₽</Text>
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,0.04)',
          paddingTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Панели ({cost.totalPanels} шт.)</Text>
          <Text>{fmt(cost.basePanelsCost)} ₽</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Накладки</Text>
          {hasSubscription ? (
            <Text delete type="secondary">
              {fmt(cost.overlaysCost + cost.overlayDiscount)} ₽
            </Text>
          ) : (
            <Text>{fmt(cost.overlaysCost)} ₽</Text>
          )}
        </div>
        {hasSubscription && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Tag icon={<CrownOutlined />} color="#4CAF50" style={{ margin: 0 }}>
              Подписка
            </Tag>
            <Text style={{ color: '#4CAF50', fontWeight: 600 }}>
              −{fmt(cost.overlayDiscount)} ₽
            </Text>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Площадь</Text>
          <Text>{cost.coveredAreaM2} м²</Text>
        </div>
      </div>

      {/* Total */}
      <div
        style={{
          borderTop: '2px solid #2D2D2D',
          paddingTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong style={{ fontSize: 16, color: '#2D2D2D' }}>
          Итого
        </Text>
        <Title level={4} style={{ margin: 0, color: '#2D2D2D', fontSize: 24, fontWeight: 800 }}>
          {fmt(cost.totalCost)} ₽
        </Title>
      </div>

      {/* Actions */}
      <Button
        type="primary"
        icon={<ShoppingCartOutlined />}
        size="large"
        block
        disabled={cost.totalPanels === 0}
        onClick={onAddToCart}
        style={{
          background: '#2D2D2D',
          borderColor: '#2D2D2D',
          borderRadius: 8,
          height: 48,
          fontWeight: 600,
        }}
      >
        В корзину
      </Button>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          block
          icon={<SaveOutlined />}
          onClick={onSave}
          disabled={cost.totalPanels === 0}
          style={{ borderRadius: 8, height: 36, borderColor: '#E5E7EB', color: '#2D2D2D' }}
        >
          Сохранить
        </Button>
        <Button
          block
          icon={<DownloadOutlined />}
          onClick={onExport}
          disabled={cost.totalPanels === 0}
          style={{ borderRadius: 8, height: 36, borderColor: '#E5E7EB', color: '#2D2D2D' }}
        >
          Скачать
        </Button>
      </div>
    </div>
  );
}
