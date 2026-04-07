import { useState } from 'react';
import { Button, Drawer, Typography } from 'antd';
import { MessageOutlined, MailOutlined, PhoneOutlined, SendOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const ACCENT = '#4CAF50';

export function SupportFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        icon={<MessageOutlined style={{ fontSize: 24 }} />}
        aria-label="Открыть поддержку"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 999,
          width: 56,
          height: 56,
          background: ACCENT,
          border: 'none',
          boxShadow: '0 4px 16px rgba(76,175,80,0.4)',
        }}
      />

      <Drawer
        title={
          <Title level={4} style={{ margin: 0 }}>
            Поддержка
          </Title>
        }
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={340}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Text style={{ fontSize: 15, color: '#6B7280' }}>
            Мы всегда рады помочь! Свяжитесь с нами любым удобным способом:
          </Text>

          <a
            href="mailto:support@wonderwowwall.ru"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12, background: '#F5F5F5',
              textDecoration: 'none', color: '#2D2D2D', transition: 'background 0.2s',
            }}
          >
            <MailOutlined style={{ fontSize: 20, color: ACCENT }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Email</div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>support@wonderwowwall.ru</div>
            </div>
          </a>

          <a
            href="tel:+78005553535"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12, background: '#F5F5F5',
              textDecoration: 'none', color: '#2D2D2D',
            }}
          >
            <PhoneOutlined style={{ fontSize: 20, color: ACCENT }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Телефон</div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>+7 (800) 555-35-35</div>
            </div>
          </a>

          <a
            href="https://t.me/wonderwowwall"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12, background: '#F5F5F5',
              textDecoration: 'none', color: '#2D2D2D',
            }}
          >
            <SendOutlined style={{ fontSize: 20, color: ACCENT }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Telegram</div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>@wonderwowwall</div>
            </div>
          </a>

          <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
            Пн-Пт: 9:00 — 20:00 МСК
          </Text>
        </div>
      </Drawer>
    </>
  );
}
