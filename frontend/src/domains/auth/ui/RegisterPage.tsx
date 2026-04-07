import { Form, Input, Button, Card, Typography, Divider, message, Tooltip, Checkbox } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, GoogleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRegisterMutation } from '../api/authApi';
import { ApiError } from '../../../shared/api';

const { Title, Text } = Typography;
const ACCENT = '#4CAF50';

export default function RegisterPage() {
  const registerMutation = useRegisterMutation();
  const navigate = useNavigate();

  const onFinish = async (values: { name: string; email: string; phone: string; password: string }) => {
    try {
      await registerMutation.mutateAsync(values);
      message.success('Аккаунт создан!');
      navigate('/account');
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : 'Ошибка регистрации';
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
            <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#2D2D2D' }}>Регистрация</Title>
            <Text style={{ color: '#6B7280' }}>Создайте аккаунт для сохранения проектов</Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
            <Form.Item
              name="name"
              rules={[{ required: true, message: 'Введите имя' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Имя" />
            </Form.Item>

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
              name="phone"
              rules={[{ required: true, message: 'Введите телефон' }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="Телефон" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Введите пароль' },
                { min: 6, message: 'Минимум 6 символов' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Подтвердите пароль' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Пароли не совпадают'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Подтвердите пароль" />
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
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  Я даю согласие на{' '}
                  <Link to="/privacy-policy" target="_blank" style={{ color: ACCENT }}>
                    обработку персональных данных
                  </Link>
                </span>
              </Checkbox>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={registerMutation.isPending}
                style={{ background: ACCENT, borderColor: ACCENT, borderRadius: 8, height: 44 }}
              >
                Создать аккаунт
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
            <Text style={{ color: '#6B7280' }}>Уже есть аккаунт? </Text>
            <Link to="/login" style={{ color: ACCENT, fontWeight: 600 }}>
              Войти
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
