import { Input, Button } from 'antd';
import { SendOutlined, PhoneOutlined, MailOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

export function ShopFooter() {
  return (
    <footer style={{ background: '#1A1A1A', color: '#fff', padding: '64px 24px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 48,
            marginBottom: 48,
          }}
        >
          {/* Brand */}
          <div>
            <img
              src="/logo.png"
              alt="Wonder Wow Wall"
              style={{ height: 40, filter: 'brightness(10)', marginBottom: 16 }}
            />
            <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 20 }}>
              Инновационный сервис отделки стен модульными пластинами.
              100 000+ вариантов дизайна.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {['VK', 'TG', 'YT'].map((s) => (
                <div
                  key={s}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
              Навигация
            </h4>
            {[
              { to: '/catalog', label: 'Каталог' },
              { to: '/constructor', label: 'Конструктор' },
              { to: '/pricing', label: 'Тарифы' },
              { to: '/portfolio', label: 'Портфолио' },
              { to: '/about', label: 'О компании' },
              { to: '/faq', label: 'FAQ' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'block',
                  color: '#9CA3AF',
                  textDecoration: 'none',
                  fontSize: 14,
                  marginBottom: 10,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Contacts */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
              Контакты
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF', fontSize: 14 }}>
                <PhoneOutlined /> +7 (800) 555-35-35
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF', fontSize: 14 }}>
                <MailOutlined /> info@wonderwowwall.ru
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9CA3AF', fontSize: 14 }}>
                <EnvironmentOutlined /> Москва, ул. Дизайна, 1
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#fff' }}>
              Подписка на новинки
            </h4>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12, lineHeight: 1.5 }}>
              Получайте информацию о новых дизайнах и акциях
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder="Ваш email"
                style={{
                  background: '#2A2A2A',
                  border: '1px solid #333',
                  color: '#fff',
                  borderRadius: 8,
                }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                style={{
                  background: '#4CAF50',
                  border: 'none',
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            borderTop: '1px solid #2A2A2A',
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            &copy; 2026 Wonder Wow Wall. Все права защищены.
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            <span style={{ fontSize: 13, color: '#6B7280', cursor: 'pointer' }}>
              Политика конфиденциальности
            </span>
            <span style={{ fontSize: 13, color: '#6B7280', cursor: 'pointer' }}>
              Пользовательское соглашение
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
