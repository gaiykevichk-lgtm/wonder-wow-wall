import { useState } from 'react';
import { Layout, Menu, Button, Drawer, Avatar, Typography } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ShopOutlined,
  UploadOutlined,
  BulbOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../auth/model/authStore';
import { useAdminNavigation } from '../model/useAdminNavigation';
import {
  ADMIN_SECTIONS,
  adminPath,
  type AdminSectionKey,
} from '../model/navigation';

const { Sider, Header, Content } = Layout;
const { Title, Text } = Typography;

const DARK = '#2D2D2D';
const GREEN = '#4CAF50';
const GRAY_TEXT = '#6B7280';
const FONT = 'Inter, sans-serif';

const ICONS: Record<AdminSectionKey, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  orders: <ShoppingCartOutlined />,
  users: <TeamOutlined />,
  catalog: <AppstoreOutlined />,
  shop: <ShopOutlined />,
  upload: <UploadOutlined />,
  recommendations: <BulbOutlined />,
  audit: <AuditOutlined />,
};

const MENU_ITEMS = ADMIN_SECTIONS.map((s) => ({
  key: s.key,
  icon: ICONS[s.key],
  label: s.label,
}));

/**
 * Phase 2 admin shell.
 *
 * Structure:
 *   ┌─── Sider ───┬───── Header (user + logout) ─────┐
 *   │ sections    │                                   │
 *   │ (AntD Menu) ├───────── Outlet (section) ────────┤
 *   │             │                                   │
 *   └─────────────┴───────────────────────────────────┘
 *
 * On ≤768px the <Sider> is hidden (CSS) and replaced by a <Drawer>
 * triggered from a hamburger button in the header — matches the
 * ShopHeader/AccountLayout pattern already used in the app.
 *
 * `<RequireAdmin>` wraps this component at the router level (in
 * `shared/router.tsx`), so here we can assume `user` is a non-null admin.
 */
export default function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { activeKey, sections } = useAdminNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (key: string) => {
    const target = sections.find((s) => s.key === key);
    if (!target) return;
    navigate(adminPath(target));
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const sidebarBody = (
    <>
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 2, color: GREEN, marginBottom: 6 }}>
          WONDER WOW WALL
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
          Админ-панель
        </div>
      </div>

      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={[activeKey]}
        items={MENU_ITEMS}
        onClick={({ key }) => handleSelect(key)}
        style={{ background: 'transparent', border: 'none', marginTop: 8 }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', fontFamily: FONT }}>
      {/* Desktop sider — hidden on ≤768px via <style> below */}
      <Sider
        className="admin-desktop-sider"
        width={240}
        theme="dark"
        style={{ background: DARK, borderRight: '1px solid rgba(0,0,0,0.08)' }}
      >
        {sidebarBody}
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#FFFFFF',
            padding: '0 24px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              className="admin-mobile-menu-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Открыть меню"
              style={{ display: 'none' }}
            />
            <Title level={5} style={{ margin: 0, color: DARK, fontWeight: 600 }}>
              Админ-панель
            </Title>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={32} icon={<UserOutlined />} style={{ background: GREEN }} />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>
                  {user?.name ?? 'Администратор'}
                </div>
                <Text type="secondary" style={{ fontSize: 12, color: GRAY_TEXT }}>
                  {user?.email}
                </Text>
              </div>
            </div>
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              aria-label="Выйти"
            >
              Выйти
            </Button>
          </div>
        </Header>

        <Content style={{ padding: 24, background: '#F5F5F5' }}>
          <Outlet />
        </Content>
      </Layout>

      {/* Mobile drawer — shown only via media query */}
      <Drawer
        placement="left"
        width={260}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        closeIcon={null}
        styles={{ body: { padding: 0, background: DARK } }}
        rootClassName="admin-mobile-drawer"
      >
        {sidebarBody}
      </Drawer>

      <style>{`
        @media (max-width: 768px) {
          .admin-desktop-sider { display: none !important; }
          .admin-mobile-menu-btn { display: inline-flex !important; }
        }
      `}</style>
    </Layout>
  );
}
