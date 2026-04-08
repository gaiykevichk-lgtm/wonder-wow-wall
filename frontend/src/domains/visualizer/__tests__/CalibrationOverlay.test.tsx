import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalibrationOverlay } from '../ui/CalibrationOverlay';
import type { CalibrationPoints } from '../model/types';

const basePoints: CalibrationPoints = {
  start: null,
  end: null,
  referenceCm: 200,
};

describe('CalibrationOverlay', () => {
  it('renders with test id', () => {
    render(
      <CalibrationOverlay
        points={basePoints}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('calibration-overlay')).toBeInTheDocument();
  });

  it('shows instruction to click start point when no points set', () => {
    render(
      <CalibrationOverlay
        points={basePoints}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Кликните на начало/)).toBeInTheDocument();
  });

  it('shows instruction to click end point when start is set', () => {
    render(
      <CalibrationOverlay
        points={{ ...basePoints, start: { x: 10, y: 20 } }}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Кликните на конец/)).toBeInTheDocument();
  });

  it('shows distance when both points are set', () => {
    render(
      <CalibrationOverlay
        points={{
          start: { x: 0, y: 0 },
          end: { x: 300, y: 400 },
          referenceCm: 200,
        }}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // hypot(300,400) = 500
    expect(screen.getByText(/500 px/)).toBeInTheDocument();
  });

  it('disables apply when points incomplete', () => {
    render(
      <CalibrationOverlay
        points={basePoints}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const applyBtn = screen.getByText('Применить').closest('button');
    expect(applyBtn).toBeDisabled();
  });

  it('enables apply when both points and reference are set', () => {
    render(
      <CalibrationOverlay
        points={{
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          referenceCm: 200,
        }}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const applyBtn = screen.getByText('Применить').closest('button');
    expect(applyBtn).not.toBeDisabled();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <CalibrationOverlay
        points={basePoints}
        onReferenceChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('Отмена'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onApply when apply button clicked', () => {
    const onApply = vi.fn();
    render(
      <CalibrationOverlay
        points={{
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          referenceCm: 200,
        }}
        onReferenceChange={vi.fn()}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Применить'));
    expect(onApply).toHaveBeenCalledOnce();
  });
});
