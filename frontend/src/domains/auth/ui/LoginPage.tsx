import { Form, Input, Button, Card, Typography, Divider, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLoginMutation } from '../api/authApi';
import { ApiError } from '../../../shared/api';

const { Title, Text } = Typography;
const BLUE = '#0071e3';

export default function LoginPage() {
  const loginMutation = useLoginMutation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await loginMutation.mutateAsync(values);
      message.success('Добро пожаловать!');
      navigate(redirect);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : 'Ошибка входа';
      message.error(detail);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FBFBFD',
        padding: '96px 16px 48px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <Card
          style={{
            borderRadius: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            border: 'none',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/logo.png" alt="Wonder Wow Wall" style={{ height: 48, marginBottom: 16 }} />
            <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#1d1d1f' }}>Вход в аккаунт</Title>
            <Text style={{ color: '#86868b' }}>Войдите, чтобы управлять заказами и проектами</Text>
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
              <Link to="/forgot-password" style={{ color: BLUE, fontSize: 13 }}>
                Забыли пароль?
              </Link>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loginMutation.isPending}
                style={{ background: BLUE, borderColor: BLUE, borderRadius: 980, height: 44 }}
              >
                Войти
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '16px 0', fontSize: 13, color: '#999' }}>или</Divider>

          <div style={{ textAlign: 'center' }}>
            <Text style={{ color: '#86868b' }}>Нет аккаунта? </Text>
            <Link to="/register" style={{ color: BLUE, fontWeight: 600 }}>
              Зарегистрироваться
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
