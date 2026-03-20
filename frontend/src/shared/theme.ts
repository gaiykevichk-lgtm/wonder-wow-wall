import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2D2D2D',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F5F5F5',
    colorText: '#2D2D2D',
    colorTextSecondary: '#6B7280',
    colorBorder: '#E5E7EB',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    colorLink: '#2D2D2D',
    colorSuccess: '#4CAF50',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 44,
      fontWeight: 500,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: 12,
      boxShadowTertiary: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Tag: {
      borderRadiusSM: 6,
    },
  },
};

export default theme;
