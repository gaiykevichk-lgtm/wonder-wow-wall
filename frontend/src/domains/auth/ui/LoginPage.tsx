import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Divider, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../model/authStore';

const { Title, Text } = Typography;
const GREEN = '#4CAF50';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const ok = await login(values);
      if (ok) {
        message.success('Добро пожаловать!');
        navigate(redirect);
      }
    } finally {
      setLoading(false);
    }
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
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/logo.png" alt="Wonder Wow Wall" style={{ height: 48, marginBottom: 16 }} />
            <Title level={3} style={{ margin: 0 }}>Вход в аккаунт</Title>
            <Text type="secondary">Войдите, чтобы управлять заказами и проектами</Text>
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

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>

            <div style={{ textAlign: 'right', marginTop: -16, marginBottom: 16 }}>
              <Link to="/forgot-password" style={{ color: GREEN, fontSize: 13 }}>
                Забыли пароль?
              </Link>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{ background: GREEN, borderColor: GREEN, borderRadius: 8, height: 44 }}
              >
                Войти
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '16px 0', fontSize: 13, color: '#999' }}>или</Divider>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">Нет аккаунта? </Text>
            <Link to="/register" style={{ color: GREEN, fontWeight: 600 }}>
              Зарегистрироваться
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
