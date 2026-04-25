import { Form, Input, Button, Card, Typography, Divider, message, Tooltip } from 'antd';
import { MailOutlined, LockOutlined, GoogleOutlined } from '@ant-design/icons';
import { PageMeta } from '../../../shared/ui/PageMeta';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLoginMutation } from '../api/authApi';
import { ApiError } from '../../../shared/api';

const { Title, Text } = Typography;
const ACCENT = '#4CAF50';

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
      // Phase 5 — backend distinguishes blocked accounts (403 + code:
      // "user_blocked") from invalid creds (422 + plain detail). Surface
      // a dedicated message so the user knows it's not a typo and stops
      // retrying — the corresponding handler is in
      // backend/app/infrastructure/api/error_handlers.py:user_blocked_handler.
      if (err instanceof ApiError && err.body?.code === 'user_blocked') {
        message.error('Аккаунт заблокирован, обратитесь к поддержке');
        return;
      }
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
        background: '#FAFAFA',
        padding: '96px 16px 48px',
      }}
    >
      <PageMeta title="Вход" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            border: 'none',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/logo.png" alt="Wonder Wow Wall" style={{ height: 48, marginBottom: 16 }} />
            <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#2D2D2D' }}>Вход в аккаунт</Title>
            <Text style={{ color: '#6B7280' }}>Войдите, чтобы управлять заказами и проектами</Text>
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
              <Link to="/forgot-password" style={{ color: ACCENT, fontSize: 13 }}>
                Забыли пароль?
              </Link>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loginMutation.isPending}
                style={{ background: ACCENT, borderColor: ACCENT, borderRadius: 8, height: 44 }}
              >
                Войти
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '16px 0', fontSize: 13, color: '#999' }}>или</Divider>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <Tooltip title="Скоро">
              <Button
                disabled
                block
                size="large"
                style={{ borderRadius: 8, height: 44, fontWeight: 500, color: '#6B7280', borderColor: '#E5E7EB' }}
                icon={<GoogleOutlined />}
              >
                Войти через Google
              </Button>
            </Tooltip>
            <Tooltip title="Скоро">
              <Button
                disabled
                block
                size="large"
                style={{ borderRadius: 8, height: 44, fontWeight: 500, color: '#6B7280', borderColor: '#E5E7EB' }}
              >
                Войти через VK
              </Button>
            </Tooltip>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Text style={{ color: '#6B7280' }}>Нет аккаунта? </Text>
            <Link to="/register" style={{ color: ACCENT, fontWeight: 600 }}>
              Зарегистрироваться
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
