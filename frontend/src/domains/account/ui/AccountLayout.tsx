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
const GREEN = '#4CAF50';

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
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          padding: '24px 0',
          height: 'fit-content',
          position: 'sticky',
          top: 96,
        }}
      >
        {/* User info */}
        <div style={{ padding: '0 24px 20px', borderBottom: '1px solid #F0F0F0', textAlign: 'center' }}>
          <Avatar
            size={64}
            icon={<UserOutlined />}
            style={{ background: GREEN, marginBottom: 12 }}
          />
          <Title level={5} style={{ margin: 0 }}>{user?.name || 'Пользователь'}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{user?.email}</Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', marginTop: 8 }}
        />

        <div style={{ padding: '16px 24px 0', borderTop: '1px solid #F0F0F0', marginTop: 8 }}>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            block
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
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
