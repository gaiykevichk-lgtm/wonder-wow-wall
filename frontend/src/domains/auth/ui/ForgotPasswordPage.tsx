import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;
const GREEN = '#4CAF50';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFinish = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F8F9FA 0%, #E8F5E9 100%)',
        padding: '96px 16px 48px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            border: 'none',
          }}
        >
          {sent ? (
            <Result
              status="success"
              title="Письмо отправлено"
              subTitle="Проверьте почту — мы отправили ссылку для восстановления пароля"
              extra={
                <Link to="/login">
                  <Button type="primary" style={{ background: GREEN, borderColor: GREEN, borderRadius: 8 }}>
                    Вернуться ко входу
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <Title level={3} style={{ margin: 0 }}>Восстановление пароля</Title>
                <Text type="secondary">Введите email, привязанный к аккаунту</Text>
              </div>

              <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: 'Введите email' },
                    { type: 'email', message: 'Некорректный email' },
                  ]}
                >
                  <Input prefix={<MailOutlined />} placeholder="Email" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={loading}
                    style={{ background: GREEN, borderColor: GREEN, borderRadius: 8, height: 44 }}
                  >
                    Отправить ссылку
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#666', fontSize: 14 }}>
                  <ArrowLeftOutlined style={{ marginRight: 6 }} />
                  Вернуться ко входу
                </Link>
              </div>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
