import type { ThemeConfig } from 'antd';

const FONT_FAMILY =
  "'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2D2D2D',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F5F5F5',
    colorText: '#2D2D2D',
    colorTextSecondary: '#6B7280',
    colorBorder: '#E5E7EB',
    borderRadius: 12,
    fontFamily: FONT_FAMILY,
    colorLink: '#4CAF50',
    colorSuccess: '#4CAF50',
    fontSize: 15,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.06)',
    lineHeight: 1.47,
    paddingLG: 24,
    paddingXL: 32,
    marginLG: 24,
    marginXL: 32,
  },
  components: {
    Button: {
      borderRadius: 12,
      controlHeight: 50,
      fontWeight: 500,
      primaryShadow: 'none',
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.04)',
      paddingLG: 24,
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
      borderRadiusSM: 8,
    },
    Typography: {
      fontWeightStrong: 600,
    },
  },
};

export { FONT_FAMILY };
export default theme;
