import { Card, Typography, Button, Tag, Space, Empty, Descriptions } from 'antd';
import { CrownOutlined, CheckCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../../subscription/model/subscriptionStore';

const { Title, Text } = Typography;
const GREEN = '#4CAF50';

export default function AccountSubscriptionSection() {
  const activePlan = useSubscriptionStore((s) => s.getActivePlan);
  const subscribedAt = useSubscriptionStore((s) => s.subscribedAt);
  const overlaysUsed = useSubscriptionStore((s) => s.overlaysUsedThisMonth);
  const remaining = useSubscriptionStore((s) => s.getRemainingOverlays);
  const cancelSubscription = useSubscriptionStore((s) => s.cancelSubscription);
  const openModal = useSubscriptionStore((s) => s.openModal);

  const plan = activePlan();

  if (!plan) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Подписка</Title>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <Empty
            description={
              <div>
                <Text type="secondary" style={{ fontSize: 15 }}>У вас нет активной подписки</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Подписка даёт бесплатные накладки, эксклюзивные дизайны и приоритетную доставку
                </Text>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<CrownOutlined />}
              onClick={() => openModal()}
              style={{ background: GREEN, borderColor: GREEN, borderRadius: 8, marginTop: 8 }}
              size="large"
            >
              Выбрать план
            </Button>
          </Empty>
        </Card>

        {/* Plans overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {SUBSCRIPTION_PLANS.map((p) => (
            <Card
              key={p.id}
              hoverable
              style={{
                borderRadius: 12,
                border: p.popular ? `2px solid ${GREEN}` : undefined,
              }}
              onClick={() => openModal(p.id)}
            >
              {p.popular && (
                <Tag color="green" style={{ position: 'absolute', top: -1, right: 16 }}>Популярный</Tag>
              )}
              <Title level={4} style={{ margin: '0 0 4px' }}>{p.name}</Title>
              <Text type="secondary">{p.desc}</Text>
              <div style={{ margin: '16px 0 12px' }}>
                <Text style={{ fontSize: 28, fontWeight: 700, color: GREEN }}>
                  {p.price.toLocaleString('ru-RU')} ₽
                </Text>
                <Text type="secondary"> / {p.period}</Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.features.slice(0, 4).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircleOutlined style={{ color: GREEN, fontSize: 13 }} />
                    <Text style={{ fontSize: 13 }}>{f}</Text>
                  </div>
                ))}
                {p.features.length > 4 && (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                    + ещё {p.features.length - 4} преимуществ
                  </Text>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const remainingCount = remaining();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title level={3} style={{ margin: 0 }}>Подписка</Title>

      {/* Active plan */}
      <Card
        style={{
          borderRadius: 12,
          background: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
          border: `1px solid ${GREEN}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <CrownOutlined style={{ fontSize: 28, color: GREEN }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{plan.name}</Title>
                <Text type="secondary">{plan.desc}</Text>
              </div>
            </div>
            <Text style={{ fontSize: 24, fontWeight: 700, color: GREEN }}>
              {plan.price.toLocaleString('ru-RU')} ₽
            </Text>
            <Text type="secondary"> / {plan.period}</Text>
          </div>
          <Tag color="green" style={{ fontSize: 13, padding: '4px 12px' }}>Активна</Tag>
        </div>
      </Card>

      {/* Stats */}
      <Card title="Использование" style={{ borderRadius: 12 }}>
        <Descriptions column={2}>
          <Descriptions.Item label="Подписка с">
            {subscribedAt ? new Date(subscribedAt).toLocaleDateString('ru-RU') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Следующее списание">
            {subscribedAt
              ? new Date(new Date(subscribedAt).getTime() + 30 * 86400000).toLocaleDateString('ru-RU')
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Использовано накладок">
            {overlaysUsed} шт.
          </Descriptions.Item>
          <Descriptions.Item label="Осталось">
            {remainingCount === Infinity ? 'Безлимит' : `${remainingCount} шт.`}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Features */}
      <Card title="Ваши преимущества" style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plan.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircleOutlined style={{ color: GREEN, fontSize: 16 }} />
              <Text>{f}</Text>
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <Card style={{ borderRadius: 12 }}>
        <Space>
          <Button
            icon={<SwapOutlined />}
            onClick={() => openModal()}
            style={{ borderColor: GREEN, color: GREEN }}
          >
            Сменить план
          </Button>
          <Button danger onClick={cancelSubscription}>
            Отменить подписку
          </Button>
        </Space>
      </Card>
    </div>
  );
}
