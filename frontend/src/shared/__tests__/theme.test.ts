import { describe, it, expect } from 'vitest';
import theme, { FONT_FAMILY } from '../theme';

describe('theme', () => {
  it('matches snapshot', () => {
    expect(theme).toMatchSnapshot();
  });

  it('font family prioritises Apple system fonts then Inter', () => {
    expect(FONT_FAMILY).toMatch(/^-apple-system/);
    expect(FONT_FAMILY).toContain('Inter');
    expect(FONT_FAMILY).toContain('system-ui');
  });

  it('preserves brand green #4CAF50', () => {
    expect(theme.token?.colorLink).toBe('#4CAF50');
    expect(theme.token?.colorSuccess).toBe('#4CAF50');
  });

  it('uses Apple-style border radii', () => {
    expect(theme.token?.borderRadius).toBe(12);
    expect(theme.components?.Card?.borderRadiusLG).toBe(16);
    expect(theme.components?.Button?.borderRadius).toBe(12);
    expect(theme.components?.Input?.borderRadius).toBe(12);
  });
});
