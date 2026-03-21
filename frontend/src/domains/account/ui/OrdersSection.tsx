import { useState } from 'react';
import { Card, Tag, Typography, Empty, Steps, Button, Space, Skeleton } from 'antd';
import { ShoppingOutlined, EyeOutlined } from '@ant-design/icons';
import { useAccountStore } from '../model/accountStore';
import { useOrders } from '../../order/api/orderApi';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../model/types';
import type { Order, OrderStatus } from '../model/types';

const { Title, Text } = Typography;

const STATUS_STEPS: OrderStatus[] = ['placed', 'confirmed', 'in_progress', 'delivered', 'installed'];

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const currentStep = STATUS_STEPS.indexOf(order.status);

  return (
    <Card
      style={{ borderRadius: 12 }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ShoppingOutlined />
            <Text strong>Заказ {order.number}</Text>
          </Space>
          <Tag color={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Tag>
        </div>
      }
      extra={
        <Button type="text" icon={<EyeOutlined />} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Скрыть' : 'Подробнее'}
        </Button>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: expanded ? 16 : 0 }}>
        <Text type="secondary">Дата: {new Date(order.date).toLocaleDateString('ru-RU')}</Text>
        <Text strong style={{ fontSize: 16 }}>{order.total.toLocaleString('ru-RU')} ₽</Text>
      </div>

      {expanded && (
        <>
          <Steps
            size="small"
            current={currentStep}
            items={STATUS_STEPS.map((s) => ({ title: ORDER_STATUS_LABELS[s] }))}
            style={{ marginBottom: 20 }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: '#FAFAFA',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: '#E8E8E8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  🎨
                </div>
                <div style={{ flex: 1 }}>
                  <Text strong>{item.name}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {item.size} · {item.color} · {item.quantity} шт.
                    </Text>
                  </div>
                </div>
                <Text strong>{(item.price * item.quantity).toLocaleString('ru-RU')} ₽</Text>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0F0F0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Адрес доставки: {order.address}</Text>
          </div>
        </>
      )}
    </Card>
  );
}

export default function OrdersSection() {
  const mockOrders = useAccountStore((s) => s.orders);
  const { data: apiOrders, isLoading } = useOrders();

  // Map API orders to frontend type, fallback to mock
  const orders: Order[] = apiOrders
    ? apiOrders.map((o) => ({
        id: o.id,
        number: o.number,
        date: o.created_at,
        status: o.status as OrderStatus,
        items: o.items.map((i) => ({
          id: i.id,
          name: i.design_name,
          image: i.design_image,
          size: i.size_key,
          color: i.color,
          quantity: i.quantity,
          price: i.unit_price,
        })),
        total: o.total,
        address: o.address,
      }))
    : mockOrders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title level={3} style={{ margin: 0 }}>Мои заказы</Title>

      {isLoading ? (
        <Card style={{ borderRadius: 12 }}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
      ) : orders.length === 0 ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty description="У вас пока нет заказов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        orders.map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </div>
  );
}
