import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;
const BLUE = '#0071e3';

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
          {sent ? (
            <Result
              status="success"
              title="Письмо отправлено"
              subTitle="Проверьте почту — мы отправили ссылку для восстановления пароля"
              extra={
                <Link to="/login">
                  <Button type="primary" style={{ background: BLUE, borderColor: BLUE, borderRadius: 980 }}>
                    Вернуться ко входу
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <Title level={3} style={{ margin: 0, fontWeight: 600, color: '#1d1d1f' }}>Восстановление пароля</Title>
                <Text style={{ color: '#86868b' }}>Введите email, привязанный к аккаунту</Text>
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
                    style={{ background: BLUE, borderColor: BLUE, borderRadius: 980, height: 44 }}
                  >
                    Отправить ссылку
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#86868b', fontSize: 14 }}>
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
