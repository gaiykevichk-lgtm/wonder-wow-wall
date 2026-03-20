import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CostSummary } from '../ui/CostSummary';
import type { CostBreakdown } from '../model/types';

function makeCost(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    panelsBySize: { '30x30': 4, '30x60': 2, '60x60': 1 },
    totalPanels: 7,
    coveredAreaM2: 1.08,
    basePanelsCost: 890 * 4 + 1490 * 2 + 2490,
    overlaysCost: 7 * 1200,
    overlayDiscount: 0,
    totalCost: 890 * 4 + 1490 * 2 + 2490 + 7 * 1200,
    ...overrides,
  };
}

describe('CostSummary', () => {
  it('renders panel counts and cost', () => {
    render(
      <CostSummary
        cost={makeCost()}
        hasSubscription={false}
        onAddToCart={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/Стоимость/)).toBeInTheDocument();
    expect(screen.getByText(/30×30 см × 4/)).toBeInTheDocument();
    expect(screen.getByText(/30×60 см × 2/)).toBeInTheDocument();
    expect(screen.getByText(/60×60 см × 1/)).toBeInTheDocument();
    expect(screen.getByText(/1[.,]08 м²/)).toBeInTheDocument();
  });

  it('shows subscription discount', () => {
    render(
      <CostSummary
        cost={makeCost({ overlayDiscount: 8400 })}
        hasSubscription={true}
        onAddToCart={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/Подписка/)).toBeInTheDocument();
    expect(screen.getByText(/−8 400 ₽/)).toBeInTheDocument();
  });

  it('calls onAddToCart when button clicked', () => {
    const onAddToCart = vi.fn();
    render(
      <CostSummary
        cost={makeCost()}
        hasSubscription={false}
        onAddToCart={onAddToCart}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('В корзину'));
    expect(onAddToCart).toHaveBeenCalledOnce();
  });

  it('disables buttons when no panels', () => {
    render(
      <CostSummary
        cost={makeCost({ totalPanels: 0 })}
        hasSubscription={false}
        onAddToCart={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('В корзину').closest('button')).toBeDisabled();
    expect(screen.getByText('Сохранить проект').closest('button')).toBeDisabled();
  });
});
