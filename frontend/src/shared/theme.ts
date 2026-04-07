import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1d1d1f',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#FBFBFD',
    colorText: '#1d1d1f',
    colorTextSecondary: '#86868b',
    colorBorder: '#d2d2d7',
    borderRadius: 12,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    colorLink: '#0071e3',
    colorSuccess: '#34C759',
    fontSize: 15,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  components: {
    Button: {
      borderRadius: 980,
      controlHeight: 50,
      fontWeight: 400,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: 20,
      boxShadowTertiary: '0 2px 12px rgba(0,0,0,0.04)',
    },
    Input: {
      borderRadius: 12,
      controlHeight: 50,
    },
    Select: {
      borderRadius: 12,
      controlHeight: 50,
    },
    Tag: {
      borderRadiusSM: 980,
    },
  },
};

export default theme;
