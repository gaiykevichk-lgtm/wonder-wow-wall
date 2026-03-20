import React from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import {
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';

// ─── Style constants ──────────────────────────────────────────────────────────

const DARK = '#2D2D2D';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1280, margin: '0 auto' };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut', delay: i * 0.1 },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Contact info items ───────────────────────────────────────────────────────

const contactItems = [
  {
    icon: <PhoneOutlined style={{ fontSize: 22, color: DARK }} />,
    title: 'Телефон',
    lines: ['+7 (800) 555-35-35', '+7 (495) 123-45-67'],
    note: 'Бесплатно по России',
  },
  {
    icon: <MailOutlined style={{ fontSize: 22, color: DARK }} />,
    title: 'Email',
    lines: ['info@wonderwowwall.ru', 'sales@wonderwowwall.ru'],
    note: 'Ответим в течение 2 часов',
  },
  {
    icon: <EnvironmentOutlined style={{ fontSize: 22, color: DARK }} />,
    title: 'Адрес',
    lines: ['Москва, ул. Дизайнерская, 14', 'офис 301, шоурум на 1 этаже'],
    note: 'Ближайшее метро: Дизайнерская',
  },
  {
    icon: <ClockCircleOutlined style={{ fontSize: 22, color: DARK }} />,
    title: 'Режим работы',
    lines: ['Пн–Пт: 9:00–20:00', 'Сб–Вс: 10:00–18:00'],
    note: 'Без перерывов и выходных',
  },
];

// ─── ContactsPage ─────────────────────────────────────────────────────────────

const ContactsPage: React.FC = () => {
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      message.success('Сообщение отправлено! Мы свяжемся с вами в ближайшее время.');
      form.resetFields();
    } catch {
      // validation errors shown inline
    }
  };

  const label = (text: string) => (
    <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: DARK }}>
      {text}
    </span>
  );

  const inputStyle: React.CSSProperties = {
    borderRadius: 8,
    fontFamily: FONT,
    height: 44,
  };

  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#fff' }}>
      {/* Header */}
      <section style={{ background: '#F5F5F5', padding: '80px 24px' }}>
        <div style={{ ...MAX_WIDTH, textAlign: 'center' }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                color: GRAY_TEXT,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Свяжитесь с нами
            </motion.span>
            <motion.h1
              variants={fadeUp}
              custom={1}
              style={{
                fontFamily: FONT,
                fontSize: 'clamp(36px, 4vw, 52px)',
                fontWeight: 800,
                color: DARK,
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: '-0.5px',
              }}
            >
              Контакты
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              style={{
                fontFamily: FONT,
                fontSize: 17,
                color: GRAY_TEXT,
                margin: 0,
                maxWidth: 520,
                lineHeight: 1.6,
              }}
            >
              Мы всегда рады ответить на ваши вопросы и помочь подобрать
              идеальное решение для вашего интерьера.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section style={{ padding: '80px 24px' }}>
        <div
          style={{
            ...MAX_WIDTH,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 40,
            alignItems: 'start',
          }}
        >
          {/* Left: contact info cards */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              style={{
                fontFamily: FONT,
                fontSize: 24,
                fontWeight: 700,
                color: DARK,
                margin: '0 0 8px',
              }}
            >
              Наши контакты
            </motion.h2>

            {contactItems.map((item, i) => (
              <motion.div key={item.title} variants={fadeUp} custom={i + 1}>
                <Card
                  style={{
                    borderRadius: 14,
                    border: '1px solid #E5E7EB',
                    boxShadow: 'none',
                  }}
                  styles={{ body: { padding: '20px 24px' } }}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: '#F5F5F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span
                        style={{
                          fontFamily: FONT,
                          fontSize: 12,
                          fontWeight: 600,
                          color: GRAY_TEXT,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}
                      >
                        {item.title}
                      </span>
                      {item.lines.map((line) => (
                        <span
                          key={line}
                          style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: DARK }}
                        >
                          {line}
                        </span>
                      ))}
                      <span style={{ fontFamily: FONT, fontSize: 13, color: GRAY_TEXT }}>
                        {item.note}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Right: contact form */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <Card
              style={{
                borderRadius: 16,
                border: '1px solid #E5E7EB',
                boxShadow: 'none',
              }}
              styles={{ body: { padding: '36px 32px' } }}
            >
              <h2
                style={{
                  fontFamily: FONT,
                  fontSize: 22,
                  fontWeight: 700,
                  color: DARK,
                  margin: '0 0 24px',
                }}
              >
                Напишите нам
              </h2>

              <Form form={form} layout="vertical">
                <Form.Item
                  name="name"
                  label={label('Ваше имя')}
                  rules={[{ required: true, message: 'Введите ваше имя' }]}
                >
                  <Input style={inputStyle} placeholder="Иван Иванов" />
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
                  name="phone"
                  label={label('Телефон')}
                  rules={[{ required: true, message: 'Введите номер телефона' }]}
                >
                  <Input style={inputStyle} placeholder="+7 (999) 000-00-00" />
                </Form.Item>

                <Form.Item
                  name="messageText"
                  label={label('Сообщение')}
                  rules={[{ required: true, message: 'Введите сообщение' }]}
                >
                  <Input.TextArea
                    rows={5}
                    style={{ borderRadius: 8, fontFamily: FONT }}
                    placeholder="Опишите ваш запрос, и мы ответим как можно скорее..."
                  />
                </Form.Item>

                <Button
                  size="large"
                  onClick={handleSubmit}
                  style={{
                    background: DARK,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    height: 52,
                    padding: '0 36px',
                    fontFamily: FONT,
                    fontWeight: 600,
                    fontSize: 15,
                    width: '100%',
                  }}
                >
                  Отправить сообщение
                </Button>
              </Form>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default ContactsPage;
