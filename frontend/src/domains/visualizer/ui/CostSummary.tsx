import { Button, Tag, Typography } from 'antd';
import { ShoppingCartOutlined, CrownOutlined } from '@ant-design/icons';
import type { CostBreakdown } from '../model/types';

const { Text, Title } = Typography;

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

interface CostSummaryProps {
  cost: CostBreakdown;
  hasSubscription: boolean;
  onAddToCart: () => void;
  onSave: () => void;
}

export function CostSummary({
  cost,
  hasSubscription,
  onAddToCart,
  onSave,
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
        borderRadius: 12,
        border: '1px solid #E5E7EB',
      }}
    >
      <Title level={5} style={{ margin: 0 }}>
        Стоимость
      </Title>

      {/* Panel counts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cost.panelsBySize['30x30'] > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">30×30 см × {cost.panelsBySize['30x30']}</Text>
            <Text>{fmt(cost.panelsBySize['30x30'] * 890)} ₽</Text>
          </div>
        )}
        {cost.panelsBySize['30x60'] > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">30×60 см × {cost.panelsBySize['30x60']}</Text>
            <Text>{fmt(cost.panelsBySize['30x60'] * 1490)} ₽</Text>
          </div>
        )}
        {cost.panelsBySize['60x60'] > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">60×60 см × {cost.panelsBySize['60x60']}</Text>
            <Text>{fmt(cost.panelsBySize['60x60'] * 2490)} ₽</Text>
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        style={{
          borderTop: '1px solid #E5E7EB',
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
        <Text strong style={{ fontSize: 16 }}>
          Итого
        </Text>
        <Title level={4} style={{ margin: 0, color: '#2D2D2D' }}>
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
          borderRadius: 10,
          height: 48,
          fontWeight: 600,
        }}
      >
        В корзину
      </Button>
      <Button
        block
        onClick={onSave}
        disabled={cost.totalPanels === 0}
        style={{ borderRadius: 10 }}
      >
        Сохранить проект
      </Button>
    </div>
  );
}
