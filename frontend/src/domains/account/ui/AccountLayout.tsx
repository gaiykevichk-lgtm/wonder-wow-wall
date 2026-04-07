import { Menu, Avatar, Typography, Button } from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  ProjectOutlined,
  HeartOutlined,
  CrownOutlined,
  AppstoreOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../auth/model/authStore';

const { Title, Text } = Typography;
const BLUE = '#0071e3';

const MENU_ITEMS = [
  { key: '/account', icon: <UserOutlined />, label: 'Профиль' },
  { key: '/account/orders', icon: <ShoppingOutlined />, label: 'Мои заказы' },
  { key: '/account/projects', icon: <ProjectOutlined />, label: 'Мои проекты' },
  { key: '/account/constructor', icon: <AppstoreOutlined />, label: 'Конструктор' },
  { key: '/account/favorites', icon: <HeartOutlined />, label: 'Избранное' },
  { key: '/account/subscription', icon: <CrownOutlined />, label: 'Подписка' },
];

export default function AccountLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '96px 24px 48px',
        display: 'flex',
        gap: 32,
        minHeight: '100vh',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: '#F5F5F7',
          borderRadius: 20,
          padding: '24px 0',
          height: 'fit-content',
          position: 'sticky',
          top: 96,
        }}
      >
        {/* User info */}
        <div style={{ padding: '0 24px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <Avatar
            size={64}
            icon={<UserOutlined />}
            style={{ background: BLUE, marginBottom: 12 }}
          />
          <Title level={5} style={{ margin: 0, color: '#1d1d1f', fontWeight: 600 }}>{user?.name || 'Пользователь'}</Title>
          <Text type="secondary" style={{ fontSize: 13, color: '#86868b' }}>{user?.email}</Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={MENU_ITEMS.map((item) => ({
            ...item,
            style: { fontSize: 14, borderRadius: 12, margin: '2px 8px', height: 40, lineHeight: '40px' },
          }))}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', marginTop: 8, background: 'transparent' }}
        />

        <div style={{ padding: '16px 24px 0', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 8 }}>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            block
            style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: 14, borderRadius: 980 }}
          >
            Выйти
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
