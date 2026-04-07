import { Modal, Button, Input, Card, Tag, Form, message } from 'antd';
import { CheckOutlined, CrownOutlined, ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useSubscriptionStore,
  SUBSCRIPTION_PLANS,
} from '../../domains/subscription/model/subscriptionStore';
import type { SubscriptionPlan } from '../../domains/subscription/model/types';

const BLUE = '#0071e3';
const DARK = '#1d1d1f';
const FONT = 'Inter, sans-serif';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <ThunderboltOutlined style={{ fontSize: 22 }} />,
  popular: <CrownOutlined style={{ fontSize: 22 }} />,
  business: <RocketOutlined style={{ fontSize: 22 }} />,
};

// ─── Plan selector step ──────────────────────────────────────────────────────

function StepSelect({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 15, color: '#86868b', margin: '0 0 8px', textAlign: 'center' }}>
        Выберите план подписки на обновление накладок
      </p>
      {SUBSCRIPTION_PLANS.map((plan) => (
        <Card
          key={plan.id}
          hoverable
          onClick={() => onSelect(plan.id)}
          style={{
            borderRadius: 20,
            border: plan.popular ? `2px solid ${DARK}` : '1px solid rgba(0,0,0,0.04)',
            cursor: 'pointer',
            position: 'relative',
            transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
          }}
          styles={{ body: { padding: '18px 20px' } }}
        >
          {plan.popular && (
            <Tag
              style={{
                position: 'absolute',
                top: -10,
                right: 16,
                background: BLUE,
                color: '#fff',
                border: 'none',
                borderRadius: 980,
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 10px',
              }}
            >
              Популярный
            </Tag>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: plan.popular ? DARK : '#F5F5F7',
                color: plan.popular ? '#fff' : DARK,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {PLAN_ICONS[plan.id]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: DARK }}>{plan.name}</div>
              <div style={{ fontSize: 13, color: '#86868b' }}>{plan.desc}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 20, color: DARK }}>
                {plan.price.toLocaleString('ru-RU')} ₽
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>/ {plan.period}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Form step ───────────────────────────────────────────────────────────────

function StepForm({
  plan,
  onSubmit,
  onBack,
}: {
  plan: SubscriptionPlan;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const [form] = Form.useForm();

  const handleFinish = () => {
    onSubmit();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Plan summary */}
      <div
        style={{
          background: '#F5F5F7',
          borderRadius: 20,
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: DARK }}>{plan.name}</div>
          <div style={{ fontSize: 13, color: '#86868b' }}>{plan.desc}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, fontSize: 22, color: DARK }}>
            {plan.price.toLocaleString('ru-RU')} ₽
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>/ {plan.period}</div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
        {plan.features.slice(0, 4).map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: DARK }}>
            <CheckOutlined style={{ color: BLUE, fontSize: 11 }} />
            {f}
          </div>
        ))}
      </div>

      {/* Form */}
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item
          name="name"
          label={<span style={{ fontSize: 13, fontWeight: 500 }}>Имя</span>}
          rules={[{ required: true, message: 'Введите имя' }]}
        >
          <Input placeholder="Иван Иванов" style={{ borderRadius: 8, height: 40 }} />
        </Form.Item>

        <Form.Item
          name="phone"
          label={<span style={{ fontSize: 13, fontWeight: 500 }}>Телефон</span>}
          rules={[{ required: true, message: 'Введите телефон' }]}
        >
          <Input placeholder="+7 (999) 123-45-67" style={{ borderRadius: 8, height: 40 }} />
        </Form.Item>

        <Form.Item
          name="email"
          label={<span style={{ fontSize: 13, fontWeight: 500 }}>Email</span>}
          rules={[{ required: true, type: 'email', message: 'Введите email' }]}
        >
          <Input placeholder="ivan@example.com" style={{ borderRadius: 8, height: 40 }} />
        </Form.Item>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button
            onClick={onBack}
            style={{ flex: 1, height: 44, borderRadius: 980, fontWeight: 500 }}
          >
            Назад
          </Button>
          <Button
            htmlType="submit"
            style={{
              flex: 2,
              height: 44,
              borderRadius: 980,
              background: BLUE,
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Оформить подписку
          </Button>
        </div>
      </Form>

      <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
        Оформляя подписку, вы соглашаетесь с условиями сервиса.
        Отменить можно в любой момент без штрафов.
      </div>
    </div>
  );
}

// ─── Success step ────────────────────────────────────────────────────────────

function StepSuccess({ plan, onClose }: { plan: SubscriptionPlan; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: BLUE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <CheckOutlined style={{ fontSize: 32, color: '#fff' }} />
      </motion.div>

      <h2 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: DARK, margin: '0 0 8px' }}>
        Подписка оформлена!
      </h2>
      <p style={{ fontSize: 15, color: '#86868b', margin: '0 0 20px', lineHeight: 1.6 }}>
        План «{plan.name}» активирован. Вам доступно{' '}
        {plan.overlaysPerMonth === 0 ? 'неограниченное количество' : `до ${plan.overlaysPerMonth}`}{' '}
        накладок в месяц.
      </p>

      <div
        style={{
          background: '#F5F5F7',
          borderRadius: 20,
          padding: '16px',
          marginBottom: 20,
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: BLUE, marginBottom: 8 }}>
          Что дальше:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'Накладки из подписки бесплатны в конструкторе',
            'Статус подписки виден в шапке сайта',
            'Управление подпиской — в личном кабинете',
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: BLUE }}>
              <CheckOutlined style={{ fontSize: 10 }} /> {t}
            </div>
          ))}
        </div>
      </div>

      <Button
        size="large"
        onClick={onClose}
        style={{
          background: DARK,
          color: '#fff',
          border: 'none',
          borderRadius: 980,
          height: 48,
          width: '100%',
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Отлично, начать!
      </Button>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function SubscriptionModal() {
  const { isModalOpen, closeModal, modalStep, selectedPlanId, selectPlan, subscribe, setModalStep } =
    useSubscriptionStore();

  const selectedPlan = SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId);

  const titles: Record<string, string> = {
    select: 'Выберите план подписки',
    form: 'Оформление подписки',
    success: '',
  };

  return (
    <Modal
      open={isModalOpen}
      onCancel={closeModal}
      footer={null}
      title={titles[modalStep] || ''}
      width={520}
      centered
      destroyOnClose
      styles={{ body: { padding: '12px 4px' } }}
    >
      <AnimatePresence mode="wait">
        {modalStep === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <StepSelect onSelect={selectPlan} />
          </motion.div>
        )}

        {modalStep === 'form' && selectedPlan && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <StepForm
              plan={selectedPlan}
              onSubmit={() => {
                subscribe(selectedPlan.id);
                message.success('Подписка активирована!');
              }}
              onBack={() => setModalStep('select')}
            />
          </motion.div>
        )}

        {modalStep === 'success' && selectedPlan && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <StepSuccess plan={selectedPlan} onClose={closeModal} />
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
