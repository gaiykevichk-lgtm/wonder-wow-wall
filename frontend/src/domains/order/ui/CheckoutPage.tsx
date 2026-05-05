import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageMeta } from '../../../shared/ui/PageMeta';
import {
  Button,
  Card,
  Input,
  Form,
  Radio,
  Steps,
  message,
  DatePicker,
  TimePicker,
  Checkbox,
} from 'antd';
import {
  UserOutlined,
  EnvironmentOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useCartStore } from '../model/cartStore';
import { BrandedFrame } from '../../../shared/ui/BrandedFrame';

// ─── Style constants ──────────────────────────────────────────────────────────

const ACCENT = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';

const MAX_WIDTH: React.CSSProperties = { maxWidth: 1080, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: i * 0.08 },
  }),
};

// ─── Label helper ─────────────────────────────────────────────────────────────

const label = (text: string) => (
  <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: DARK }}>
    {text}
  </span>
);

// ─── CheckoutPage ─────────────────────────────────────────────────────────────

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const total = useCartStore((s) => s.total);

  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [delivery, setDelivery] = useState<string>('courier');
  const [payment, setPayment] = useState<string>('card');
  // Phase 12 — post-submit "certificate" success state lives on the same
  // page (no new route) so wizard → success is animated locally and the
  // user keeps the order recap they just confirmed.
  const [submittedOrder, setSubmittedOrder] = useState<{
    number: string;
    total: number;
    items: typeof items;
  } | null>(null);

  const subtotal = total();
  const deliveryCost = subtotal >= 50000 ? 0 : 2500;
  const grandTotal = subtotal + deliveryCost;

  // ── Success state (post-submit) ──────────────────────────────────────────────
  if (submittedOrder) {
    return (
      <div
        style={{
          paddingTop: 72,
          minHeight: '100vh',
          background: '#F5F5F5',
          padding: '72px 24px 80px',
        }}
      >
        <PageMeta title="Заказ оформлен" />
        <div style={{ ...MAX_WIDTH, maxWidth: 760 }}>
          <BrandedFrame
            variant="full"
            animate
            padding="56px 56px 88px"
            logoHeight={56}
          >
            <div style={{ textAlign: 'center' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: ACCENT,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 38, color: '#fff' }} />
              </motion.div>
              <h1
                style={{
                  fontFamily: FONT,
                  fontSize: 32,
                  fontWeight: 700,
                  color: DARK,
                  margin: '0 0 8px',
                  letterSpacing: -0.4,
                }}
              >
                Спасибо за заказ!
              </h1>
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 15,
                  color: GRAY_TEXT,
                  margin: '0 0 32px',
                  lineHeight: 1.6,
                }}
              >
                Мы свяжемся с вами в ближайшее время для подтверждения
                деталей доставки и&nbsp;монтажа.
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 32,
                  padding: '20px 32px',
                  background: '#FAFAFA',
                  borderRadius: 12,
                  marginBottom: 28,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 12,
                      color: GRAY_TEXT,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    Номер заказа
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 22,
                      fontWeight: 700,
                      color: DARK,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {submittedOrder.number}
                  </div>
                </div>
                <div
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    background: 'rgba(0,0,0,0.08)',
                  }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 12,
                      color: GRAY_TEXT,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}
                  >
                    Сумма
                  </div>
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 22,
                      fontWeight: 700,
                      color: DARK,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {submittedOrder.total.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Link to="/account/orders">
                  <Button
                    size="large"
                    style={{
                      background: DARK,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      height: 48,
                      padding: '0 28px',
                      fontFamily: FONT,
                      fontWeight: 600,
                    }}
                  >
                    Мои заказы
                  </Button>
                </Link>
                <Link to="/catalog">
                  <Button
                    size="large"
                    style={{
                      background: '#fff',
                      color: DARK,
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 8,
                      height: 48,
                      padding: '0 28px',
                      fontFamily: FONT,
                      fontWeight: 600,
                    }}
                  >
                    Продолжить покупки
                  </Button>
                </Link>
              </div>
            </div>
          </BrandedFrame>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div
        style={{
          paddingTop: 72,
          minHeight: '100vh',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            textAlign: 'center',
            padding: '0 24px',
          }}
        >
          <ShoppingCartOutlined style={{ fontSize: 64, color: '#D1D5DB' }} />
          <h2
            style={{
              fontFamily: FONT,
              fontSize: 28,
              fontWeight: 600,
              color: DARK,
              margin: 0,
            }}
          >
            Корзина пуста
          </h2>
          <p style={{ fontFamily: FONT, fontSize: 15, color: GRAY_TEXT, margin: 0 }}>
            Добавьте панели из каталога, чтобы оформить заказ
          </p>
          <Button
            size="large"
            onClick={() => navigate('/catalog')}
            style={{
              background: DARK,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              height: 52,
              padding: '0 32px',
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Перейти в каталог
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Steps config ─────────────────────────────────────────────────────────────
  const stepItems = [
    {
      title: <span style={{ fontFamily: FONT, fontSize: 13 }}>Контакты</span>,
      icon: <UserOutlined />,
    },
    {
      title: <span style={{ fontFamily: FONT, fontSize: 13 }}>Доставка</span>,
      icon: <EnvironmentOutlined />,
    },
    {
      title: <span style={{ fontFamily: FONT, fontSize: 13 }}>Оплата</span>,
      icon: <CreditCardOutlined />,
    },
  ];

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      await form.validateFields();
      // Phase 12 — switch to success state in-place. The cart is cleared
      // AFTER capturing the items snapshot so the success view can still
      // recap the order. Real backend integration will replace the
      // synthetic order number with the server's response.
      const captured = items;
      const number =
        'WW-' +
        Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
      setSubmittedOrder({ number, total: grandTotal, items: captured });
      clearCart();
      message.success('Заказ оформлен!');
    } catch {
      // validation error — antd shows inline
    }
  };

  const handleNext = async () => {
    const fieldsToValidate: string[][] = [
      ['firstName', 'lastName', 'phone', 'email', 'privacyConsent'],
      delivery !== 'pickup' ? ['address', 'installationDate', 'installationTime'] : ['installationDate', 'installationTime'],
      [],
    ];
    try {
      await form.validateFields(fieldsToValidate[currentStep]);
      if (currentStep < 2) setCurrentStep((s) => s + 1);
      else handleSubmit();
    } catch {
      // validation error
    }
  };

  // ── Step forms ───────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    borderRadius: 8,
    fontFamily: FONT,
    height: 44,
  };

  const StepContacts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Form.Item
          name="firstName"
          label={label('Имя')}
          rules={[{ required: true, message: 'Введите имя' }]}
        >
          <Input style={inputStyle} placeholder="Иван" />
        </Form.Item>
        <Form.Item
          name="lastName"
          label={label('Фамилия')}
          rules={[{ required: true, message: 'Введите фамилию' }]}
        >
          <Input style={inputStyle} placeholder="Иванов" />
        </Form.Item>
      </div>
      <Form.Item
        name="phone"
        label={label('Телефон')}
        rules={[
          { required: true, message: 'Введите телефон' },
          { pattern: /^\+?[\d\s\-()]{10,}$/, message: 'Некорректный номер' },
        ]}
      >
        <Input style={inputStyle} placeholder="+7 (999) 000-00-00" />
      </Form.Item>
      <Form.Item
        name="email"
        label={label('Email')}
        rules={[
          { required: true, message: 'Введите email' },
          { type: 'email', message: 'Некорректный email' },
        ]}
      >
        <Input style={inputStyle} placeholder="ivan@example.com" />
      </Form.Item>
      <Form.Item
        name="privacyConsent"
        valuePropName="checked"
        rules={[
          {
            validator: (_, value) =>
              value ? Promise.resolve() : Promise.reject(new Error('Необходимо дать согласие')),
          },
        ]}
      >
        <Checkbox>
          <span style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT }}>
            Я даю согласие на{' '}
            <Link to="/privacy-policy" target="_blank" style={{ color: ACCENT }}>
              обработку персональных данных
            </Link>
          </span>
        </Checkbox>
      </Form.Item>
    </div>
  );

  const StepDelivery = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Form.Item name="deliveryType" label={label('Способ доставки')}>
        <Radio.Group
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {[
            { value: 'courier', label: 'Курьером', desc: 'Доставка до двери, 1-3 дня' },
            { value: 'pickup', label: 'Самовывоз', desc: 'Из нашего шоурума, бесплатно' },
            { value: 'transport', label: 'Транспортная компания', desc: 'По России, 3-7 дней' },
          ].map((opt) => (
            <Radio
              key={opt.value}
              value={opt.value}
              style={{
                border: `1.5px solid ${delivery === opt.value ? DARK : 'rgba(0,0,0,0.04)'}`,
                borderRadius: 10,
                padding: '12px 16px',
                margin: 0,
                fontFamily: FONT,
              }}
            >
              <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: DARK }}>
                {opt.label}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT, marginLeft: 8 }}>
                — {opt.desc}
              </span>
            </Radio>
          ))}
        </Radio.Group>
      </Form.Item>
      {delivery !== 'pickup' && (
        <Form.Item
          name="address"
          label={label('Адрес доставки')}
          rules={[{ required: true, message: 'Введите адрес' }]}
        >
          <Input style={inputStyle} placeholder="Город, улица, дом, квартира" />
        </Form.Item>
      )}
      <Form.Item name="comment" label={label('Комментарий к заказу')}>
        <Input.TextArea
          rows={3}
          style={{ borderRadius: 8, fontFamily: FONT }}
          placeholder="Дополнительная информация для курьера или мастера..."
        />
      </Form.Item>
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CalendarOutlined style={{ color: ACCENT, fontSize: 16 }} />
          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: DARK }}>
            Дата и время монтажа
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="installationDate"
            label={label('Дата')}
            rules={[{ required: true, message: 'Выберите дату монтажа' }]}
          >
            <DatePicker
              format="DD.MM.YYYY"
              placeholder="Выберите дату"
              disabledDate={(current: Dayjs) => current && current.isBefore(dayjs().endOf('day'))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="installationTime"
            label={label('Время')}
            rules={[{ required: true, message: 'Выберите время' }]}
          >
            <TimePicker
              format="HH:mm"
              minuteStep={30}
              placeholder="Выберите время"
              disabledHours={() => {
                const hours = [];
                for (let i = 0; i < 9; i++) hours.push(i);
                for (let i = 21; i < 24; i++) hours.push(i);
                return hours;
              }}
              disabledMinutes={(hour: number) => (hour === 20 ? [30] : [])}
              hideDisabledOptions
              style={{ ...inputStyle, width: '100%' }}
            />
          </Form.Item>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 12, color: GRAY_TEXT, margin: '-8px 0 0' }}>
          Доступное время: с 9:00 до 20:00, только будущие даты
        </p>
      </div>
    </div>
  );

  const StepPayment = (
    <Form.Item name="paymentType" label={label('Способ оплаты')}>
      <Radio.Group
        value={payment}
        onChange={(e) => setPayment(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {[
          { value: 'card', label: 'Банковская карта', desc: 'Visa, Mastercard, МИР' },
          { value: 'sbp', label: 'СБП', desc: 'Система Быстрых Платежей' },
          { value: 'installment', label: 'Рассрочка', desc: 'На 12 месяцев без переплат' },
          { value: 'cash', label: 'Наличные', desc: 'При получении или самовывозе' },
        ].map((opt) => (
          <Radio
            key={opt.value}
            value={opt.value}
            style={{
              border: `1.5px solid ${payment === opt.value ? DARK : 'rgba(0,0,0,0.04)'}`,
              borderRadius: 10,
              padding: '12px 16px',
              margin: 0,
              fontFamily: FONT,
            }}
          >
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: DARK }}>
              {opt.label}
            </span>
            <span style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT, marginLeft: 8 }}>
              — {opt.desc}
            </span>
          </Radio>
        ))}
      </Radio.Group>
    </Form.Item>
  );

  const stepContent = [StepContacts, StepDelivery, StepPayment];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#F5F5F5', padding: '72px 24px 80px' }}>
      <PageMeta title="Оформление заказа" />
      <div style={{ ...MAX_WIDTH }}>
        {/* Page title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(28px, 3vw, 36px)',
            fontWeight: 600,
            color: DARK,
            margin: '0 0 32px',
          }}
        >
          Оформление заказа
        </motion.h1>

        {/* Steps indicator */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0], delay: 0.1 }}
          style={{ marginBottom: 36 }}
        >
          <Steps
            current={currentStep}
            items={stepItems}
            style={{ fontFamily: FONT }}
          />
        </motion.div>

        {/* Two-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: 28,
            alignItems: 'start',
          }}
          className="checkout-layout"
        >
          {/* Left: form */}
          <motion.div
            key={currentStep}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            <Card
              style={{
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.04)',
                boxShadow: 'none',
              }}
              styles={{ body: { padding: '32px 32px 24px' } }}
            >
              <h2
                style={{
                  fontFamily: FONT,
                  fontSize: 20,
                  fontWeight: 600,
                  color: DARK,
                  margin: '0 0 24px',
                }}
              >
                {['Контактные данные', 'Способ доставки', 'Оплата'][currentStep]}
              </h2>

              <Form
                form={form}
                layout="vertical"
                initialValues={{ deliveryType: 'courier', paymentType: 'card' }}
              >
                {stepContent[currentStep]}
              </Form>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {currentStep > 0 && (
                  <Button
                    size="large"
                    onClick={() => setCurrentStep((s) => s - 1)}
                    style={{
                      background: '#fff',
                      color: DARK,
                      border: '1px solid rgba(0,0,0,0.04)',
                      borderRadius: 8,
                      height: 48,
                      padding: '0 24px',
                      fontFamily: FONT,
                      fontWeight: 600,
                    }}
                  >
                    Назад
                  </Button>
                )}
                <Button
                  size="large"
                  onClick={handleNext}
                  style={{
                    background: DARK,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    height: 48,
                    padding: '0 32px',
                    fontFamily: FONT,
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {currentStep < 2 ? 'Продолжить' : 'Подтвердить заказ'}
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Right: order summary */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            style={{ position: 'sticky', top: 88 }}
          >
            <Card
              style={{
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.04)',
                boxShadow: 'none',
              }}
              styles={{ body: { padding: '28px 24px' } }}
            >
              <h3
                style={{
                  fontFamily: FONT,
                  fontSize: 17,
                  fontWeight: 600,
                  color: DARK,
                  margin: '0 0 20px',
                }}
              >
                Ваш заказ
              </h3>

              {/* Items list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                {items.map((item) => (
                  <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 8,
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid rgba(0,0,0,0.04)',
                      }}
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#F3F4F6' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: FONT,
                          fontSize: 13,
                          fontWeight: 600,
                          color: DARK,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </div>
                      {(item.textureName || item.colorName || item.size) && (
                        <div style={{ fontFamily: FONT, fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                          {[item.textureName, item.colorName, item.size].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div style={{ fontFamily: FONT, fontSize: 12, color: GRAY_TEXT, marginTop: 2 }}>
                        {item.quantity} × {item.price.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                    <div
                      style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: DARK, flexShrink: 0 }}
                    >
                      {(item.price * item.quantity).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT }}>Товары</span>
                  <span style={{ fontFamily: FONT, fontSize: 14, color: DARK }}>
                    {subtotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontFamily: FONT, fontSize: 14, color: GRAY_TEXT }}>Доставка</span>
                  {deliveryCost === 0 ? (
                    <span style={{ fontFamily: FONT, fontSize: 14, color: ACCENT, fontWeight: 600 }}>
                      Бесплатно
                    </span>
                  ) : (
                    <span style={{ fontFamily: FONT, fontSize: 14, color: DARK }}>
                      {deliveryCost.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
                {deliveryCost > 0 && (
                  <p style={{ fontFamily: FONT, fontSize: 12, color: GRAY_TEXT, margin: '0 0 12px' }}>
                    Бесплатная доставка при заказе от 50 000 ₽
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid #F3F4F6',
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: DARK }}>
                    Итого
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, color: DARK }}>
                    {grandTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Trust badges */}
              <div
                style={{
                  marginTop: 20,
                  background: '#F5F5F5',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {[
                  'Безопасная оплата',
                  'Гарантия 5 лет',
                  'Профессиональный монтаж',
                ].map((text) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircleOutlined style={{ color: ACCENT, fontSize: 14 }} />
                    <span style={{ fontFamily: FONT, fontSize: 13, color: DARK }}>{text}</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
