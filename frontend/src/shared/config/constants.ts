// ─── Pricing constants (shared across domains) ─────────────────────────────

export const PANEL_SIZES = [
  { width: 300, height: 300, label: '30×30 см', labelShort: '30×30' },
  { width: 300, height: 600, label: '30×60 см', labelShort: '30×60' },
  { width: 600, height: 600, label: '60×60 см', labelShort: '60×60' },
] as const;

export const BASE_PANEL_PRICES: Record<string, number> = {
  '300x300': 890,
  '300x600': 1490,
  '600x600': 2490,
};

export const DESIGN_OVERLAY_PRICE = 1200;
