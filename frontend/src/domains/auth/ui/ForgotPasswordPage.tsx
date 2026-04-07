import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Result, message } from 'antd';
import { MailOutlined, ArrowLeftOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForgotPasswordMutation, useResetPasswordMutation } from '../api/authApi';
import { ApiError } from '../../../shared/api';

const { Title, Text } = Typography;
const ACCENT = '#4CAF50';

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const forgotMutation = useForgotPasswordMutation();
  const resetMutation = useResetPasswordMutation();

  const onSendEmail = async (values: { email: string }) => {
    try {
      await forgotMutation.mutateAsync({ email: values.email });
      setEmail(values.email);
      message.success('Код отправлен на почту');
      setStep('reset');
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : 'Ошибка отправки';
      message.error(detail);
    }
  };

  const onResetPassword = async (values: { token: string; new_password: string }) => {
    try {
      await resetMutation.mutateAsync({
        email,
        token: values.token,
        new_password: values.new_password,
      });
      message.success('Пароль успешно изменён');
      setStep('done');
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : 'Ошибка сброса пароля';
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
          {step === 'done' ? (
            <Result
              status="success"
              title="Пароль изменён"
              subTitle="Теперь вы можете войти с новым паролем"
              extra={
                <Link to="/login">
                  <Button type="primary" style={{ background: ACCENT, borderColor: ACCENT, borderRadius: 8 }}>
                    Вернуться ко входу
                  </Button>
                </Link>
              }
            />
          ) : step === 'reset' ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#2D2D2D' }}>Введите код</Title>
                <Text style={{ color: '#6B7280' }}>Код отправлен на {email}</Text>
              </div>

              <Form layout="vertical" onFinish={onResetPassword} size="large" requiredMark={false}>
                <Form.Item
                  name="token"
                  rules={[
                    { required: true, message: 'Введите код' },
                    { len: 6, message: 'Код должен содержать 6 цифр' },
                  ]}
                >
                  <Input prefix={<SafetyOutlined />} placeholder="6-значный код" maxLength={6} />
                </Form.Item>

                <Form.Item
                  name="new_password"
                  rules={[
                    { required: true, message: 'Введите новый пароль' },
                    { min: 6, message: 'Минимум 6 символов' },
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Новый пароль" />
                </Form.Item>

                <Form.Item
                  name="confirm_password"
                  dependencies={['new_password']}
                  rules={[
                    { required: true, message: 'Подтвердите пароль' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                        return Promise.reject(new Error('Пароли не совпадают'));
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Подтвердите пароль" />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={resetMutation.isPending}
                    style={{ background: ACCENT, borderColor: ACCENT, borderRadius: 8, height: 44 }}
                  >
                    Сбросить пароль
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#6B7280', fontSize: 14 }}>
                  <ArrowLeftOutlined style={{ marginRight: 6 }} />
                  Вернуться ко входу
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#2D2D2D' }}>Восстановление пароля</Title>
                <Text style={{ color: '#6B7280' }}>Введите email, привязанный к аккаунту</Text>
              </div>

              <Form layout="vertical" onFinish={onSendEmail} size="large" requiredMark={false}>
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
                    loading={forgotMutation.isPending}
                    style={{ background: ACCENT, borderColor: ACCENT, borderRadius: 8, height: 44 }}
                  >
                    Отправить код
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#6B7280', fontSize: 14 }}>
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
