import { Card, Switch, Typography } from 'antd';
import { BellOutlined, MailOutlined, CrownOutlined, GiftOutlined } from '@ant-design/icons';
import { useAccountStore } from '../model/accountStore';

const { Title, Text } = Typography;

const ITEMS = [
  {
    key: 'emailOrders' as const,
    icon: <MailOutlined style={{ fontSize: 20, color: '#4CAF50' }} />,
    title: 'Email о заказах',
    desc: 'Уведомления о статусе заказа, доставке и монтаже',
  },
  {
    key: 'emailSubscription' as const,
    icon: <CrownOutlined style={{ fontSize: 20, color: '#4CAF50' }} />,
    title: 'Email о подписке',
    desc: 'Уведомления о продлении, новых дизайнах в подписке',
  },
  {
    key: 'emailPromo' as const,
    icon: <GiftOutlined style={{ fontSize: 20, color: '#4CAF50' }} />,
    title: 'Промо-рассылка',
    desc: 'Акции, скидки и специальные предложения',
  },
];

export default function NotificationsSection() {
  const notifications = useAccountStore((s) => s.notifications);
  const updateNotifications = useAccountStore((s) => s.updateNotifications);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BellOutlined style={{ fontSize: 22, color: '#2D2D2D' }} />
        <Title level={3} style={{ margin: 0, color: '#2D2D2D', fontWeight: 600 }}>Уведомления</Title>
      </div>

      <Card style={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {ITEMS.map((item, idx) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 0',
                borderBottom: idx < ITEMS.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#F5F5F5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <Text strong style={{ color: '#2D2D2D', fontSize: 15 }}>{item.title}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, color: '#6B7280' }}>{item.desc}</Text>
                </div>
              </div>
              <Switch
                checked={notifications[item.key]}
                onChange={(checked) => updateNotifications({ [item.key]: checked })}
              />
            </div>
          ))}
        </div>
      </Card>

      <Text type="secondary" style={{ fontSize: 12, color: '#6B7280' }}>
        Настройки сохраняются автоматически. Управление email-рассылками также доступно через ссылку в письме.
      </Text>
    </div>
  );
}
