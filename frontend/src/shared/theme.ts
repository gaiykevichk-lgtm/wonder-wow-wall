import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2D2D2D',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F5F5F5',
    colorText: '#2D2D2D',
    colorTextSecondary: '#6B7280',
    colorBorder: '#E5E7EB',
    borderRadius: 12,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    colorLink: '#4CAF50',
    colorSuccess: '#4CAF50',
    fontSize: 15,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 50,
      fontWeight: 400,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    },
    Input: {
      borderRadius: 8,
      controlHeight: 50,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 50,
    },
    Tag: {
      borderRadiusSM: 6,
    },
  },
};

export default theme;
