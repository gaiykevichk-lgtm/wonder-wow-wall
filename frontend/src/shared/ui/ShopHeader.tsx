import { useState, useEffect } from 'react';
import { Badge, Button, Drawer, Tag, Tooltip } from 'antd';
import {
  ShoppingOutlined,
  HeartOutlined,
  UserOutlined,
  MenuOutlined,
  CloseOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../domains/order/model/cartStore';
import { useSubscriptionStore } from '../../domains/subscription/model/subscriptionStore';
import { useAuthStore } from '../../domains/auth/model/authStore';

const NAV_ITEMS = [
  { path: '/catalog', label: 'Каталог' },
  { path: '/constructor', label: 'Конструктор' },
  { path: '/visualizer', label: 'Фото-редактор' },
  { path: '/how-it-works', label: 'Как это работает' },
  { path: '/portfolio', label: 'Портфолио' },
  { path: '/about', label: 'О нас' },
  { path: '/contacts', label: 'Контакты' },
];

export function ShopHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const setCartOpen = useCartStore((s) => s.setOpen);
  const totalItems = useCartStore((s) => s.totalItems);
  const activePlan = useSubscriptionStore((s) => s.getActivePlan);
  const openSubModal = useSubscriptionStore((s) => s.openModal);
  const isAuth = useAuthStore((s) => s.isAuth);
  const user = useAuthStore((s) => s.user);
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const headerBg = scrolled || !isHome ? '#FFFFFF' : 'transparent';
  const textColor = scrolled || !isHome ? '#2D2D2D' : '#FFFFFF';
  const borderBottom = scrolled ? '1px solid #E5E7EB' : '1px solid transparent';

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: headerBg,
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom,
          transition: 'all 0.3s ease',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 72,
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: textColor,
              transition: 'color 0.3s',
            }}
          >
            <img
              src="/logo.png"
              alt="Wonder Wow Wall"
              style={{
                height: 52,
                filter: scrolled || !isHome ? 'none' : 'brightness(10)',
                transition: 'filter 0.3s',
              }}
            />
          </Link>

          {/* Desktop Nav */}
          <nav
            style={{
              display: 'flex',
              gap: 32,
              alignItems: 'center',
            }}
            className="desktop-nav"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  color: location.pathname === item.path
                    ? (scrolled || !isHome ? '#4CAF50' : '#FFFFFF')
                    : textColor,
                  transition: 'color 0.3s',
                  position: 'relative',
                }}
              >
                {item.label}
                {location.pathname === item.path && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: '#4CAF50',
                      borderRadius: 1,
                    }}
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activePlan() ? (
              <Tag
                icon={<CrownOutlined />}
                color="#4CAF50"
                style={{
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 11,
                  padding: '2px 10px',
                  cursor: 'pointer',
                  margin: 0,
                }}
                onClick={() => openSubModal()}
              >
                {activePlan()!.name}
              </Tag>
            ) : (
              <Button
                size="small"
                onClick={() => openSubModal()}
                className="sub-btn-desktop"
                style={{
                  borderRadius: 20,
                  border: `1px solid ${scrolled || !isHome ? '#4CAF50' : 'rgba(255,255,255,0.6)'}`,
                  color: scrolled || !isHome ? '#4CAF50' : '#fff',
                  background: 'transparent',
                  fontWeight: 600,
                  fontSize: 12,
                  transition: 'all 0.3s',
                }}
              >
                Подписка
              </Button>
            )}
            <Button
              type="text"
              icon={<HeartOutlined style={{ fontSize: 20 }} />}
              style={{ color: textColor, transition: 'color 0.3s' }}
            />
            <Badge count={totalItems()} size="small" color="#4CAF50">
              <Button
                type="text"
                icon={<ShoppingOutlined style={{ fontSize: 20 }} />}
                onClick={() => setCartOpen(true)}
                style={{ color: textColor, transition: 'color 0.3s' }}
              />
            </Badge>
            {isAuth ? (
              <Tooltip title={user?.name || 'Кабинет'}>
                <Button
                  type="text"
                  onClick={() => navigate('/account')}
                  style={{
                    color: textColor,
                    transition: 'color 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <UserOutlined style={{ fontSize: 20 }} />
                </Button>
              </Tooltip>
            ) : (
              <Button
                type="text"
                icon={<UserOutlined style={{ fontSize: 20 }} />}
                onClick={() => navigate('/login')}
                style={{ color: textColor, transition: 'color 0.3s' }}
              />
            )}
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setMobileOpen(true)}
              style={{ color: textColor, display: 'none' }}
              className="mobile-menu-btn"
            />
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <Drawer
        title={
          <img src="/logo.png" alt="Wonder Wow Wall" style={{ height: 44 }} />
        }
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        placement="right"
        width={300}
        closeIcon={<CloseOutlined />}
      >
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              style={{
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: location.pathname === item.path ? 600 : 400,
                color: location.pathname === item.path ? '#4CAF50' : '#2D2D2D',
                padding: '12px 16px',
                borderRadius: 8,
                background: location.pathname === item.path ? 'rgba(76,175,80,0.08)' : 'transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Drawer>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}
