import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Form,
  Radio,
  Steps,
  message,
} from 'antd';
import {
  UserOutlined,
  EnvironmentOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useCartStore } from '../../shared/store/cartStore';

// ─── Style constants ──────────────────────────────────────────────────────────

const GREEN = '#4CAF50';
const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';

const MAX_WIDTH: React.CSSProperties = { maxWidth: 1280, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut', delay: i * 0.08 },
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

  const subtotal = total();
  const deliveryCost = subtotal >= 50000 ? 0 : 2500;
  const grandTotal = subtotal + deliveryCost;

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
          transition={{ duration: 0.5 }}
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
              fontWeight: 800,
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
              borderRadius: 10,
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
      message.success('Заказ успешно оформлен! Мы свяжемся с вами в ближайшее время.');
      clearCart();
      navigate('/');
    } catch {
      // validation error — antd shows inline
    }
  };

  const handleNext = async () => {
    const fieldsToValidate: string[][] = [
      ['firstName', 'lastName', 'phone', 'email'],
      ['address'],
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
                border: `1.5px solid ${delivery === opt.value ? DARK : '#E5E7EB'}`,
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
          { value: 'installment', label: 'Рассрочка', desc: 'На 12 месяцев без переплат' },
          { value: 'cash', label: 'Наличные', desc: 'При получении или самовывозе' },
        ].map((opt) => (
          <Radio
            key={opt.value}
            value={opt.value}
            style={{
              border: `1.5px solid ${payment === opt.value ? DARK : '#E5E7EB'}`,
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
      <div style={{ ...MAX_WIDTH }}>
        {/* Page title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(28px, 3vw, 36px)',
            fontWeight: 800,
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
          transition={{ duration: 0.4, delay: 0.1 }}
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
                border: '1px solid #E5E7EB',
                boxShadow: 'none',
              }}
              styles={{ body: { padding: '32px 32px 24px' } }}
            >
              <h2
                style={{
                  fontFamily: FONT,
                  fontSize: 20,
                  fontWeight: 700,
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
                      border: '1px solid #E5E7EB',
                      borderRadius: 10,
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
                    borderRadius: 10,
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
                border: '1px solid #E5E7EB',
                boxShadow: 'none',
              }}
              styles={{ body: { padding: '28px 24px' } }}
            >
              <h3
                style={{
                  fontFamily: FONT,
                  fontSize: 17,
                  fontWeight: 700,
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
                        border: '1px solid #E5E7EB',
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
                      <div style={{ fontFamily: FONT, fontSize: 12, color: GRAY_TEXT, marginTop: 2 }}>
                        {item.quantity} × {item.price.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                    <div
                      style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: DARK, flexShrink: 0 }}
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
                    <span style={{ fontFamily: FONT, fontSize: 14, color: GREEN, fontWeight: 600 }}>
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
                  <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: DARK }}>
                    Итого
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: DARK }}>
                    {grandTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Trust badges */}
              <div
                style={{
                  marginTop: 20,
                  background: '#F9FAFB',
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
                    <CheckCircleOutlined style={{ color: GREEN, fontSize: 14 }} />
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
