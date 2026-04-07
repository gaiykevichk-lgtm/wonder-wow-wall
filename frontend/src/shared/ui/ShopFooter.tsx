import { Input, Button } from 'antd';
import { SendOutlined, PhoneOutlined, MailOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

export function ShopFooter() {
  return (
    <footer style={{ background: '#F5F5F7', color: '#1d1d1f', padding: '48px 24px 24px' }}>
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
              style={{ height: 48, marginBottom: 16 }}
            />
            <p style={{ fontSize: 12, color: '#86868b', lineHeight: 1.6, marginBottom: 20 }}>
              Инновационный сервис отделки стен модульными пластинами.
              100 000+ вариантов дизайна.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {['VK', 'TG', 'YT'].map((s) => (
                <div
                  key={s}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: '#86868b',
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#1d1d1f')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#86868b')}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 16,
                color: '#1d1d1f',
              }}
            >
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
                  color: '#424245',
                  textDecoration: 'none',
                  fontSize: 12,
                  marginBottom: 10,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1d1d1f')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#424245')}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Contacts */}
          <div>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 16,
                color: '#1d1d1f',
              }}
            >
              Контакты
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#86868b', fontSize: 12 }}>
                <PhoneOutlined /> +7 (800) 555-35-35
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#86868b', fontSize: 12 }}>
                <MailOutlined /> info@wonderwowwall.ru
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#86868b', fontSize: 12 }}>
                <EnvironmentOutlined /> Москва, ул. Дизайна, 1
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 16,
                color: '#1d1d1f',
              }}
            >
              Подписка на новинки
            </h4>
            <p style={{ fontSize: 12, color: '#86868b', marginBottom: 12, lineHeight: 1.5 }}>
              Получайте информацию о новых дизайнах и акциях
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder="Ваш email"
                style={{
                  background: '#fff',
                  border: '1px solid #d2d2d7',
                  color: '#1d1d1f',
                  borderRadius: 980,
                }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                style={{
                  background: '#0071e3',
                  border: 'none',
                  borderRadius: 980,
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            borderTop: '1px solid #d2d2d7',
            paddingTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 12, color: '#86868b' }}>
            &copy; 2026 Wonder Wow Wall. Все права защищены.
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            <span style={{ fontSize: 12, color: '#86868b', cursor: 'pointer' }}>
              Политика конфиденциальности
            </span>
            <span style={{ fontSize: 12, color: '#86868b', cursor: 'pointer' }}>
              Пользовательское соглашение
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
