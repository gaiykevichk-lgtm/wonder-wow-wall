import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalibrationOverlay } from '../ui/CalibrationOverlay';
import type { CalibrationPoints } from '../model/types';
import type { ReferenceCandidate } from '../lib/scaleEstimator';

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

  describe('auto-candidate section (Phase 4)', () => {
    it('does not render the auto block when no candidates supplied', () => {
      render(
        <CalibrationOverlay
          points={basePoints}
          onReferenceChange={vi.fn()}
          onApply={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('auto-candidate-block')).not.toBeInTheDocument();
    });

    it('does not render the auto block when candidates is empty', () => {
      render(
        <CalibrationOverlay
          points={basePoints}
          onReferenceChange={vi.fn()}
          onApply={vi.fn()}
          onCancel={vi.fn()}
          candidates={[]}
          onApplyCandidate={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('auto-candidate-block')).not.toBeInTheDocument();
    });

    it('renders the auto block when candidates are present', () => {
      const candidates: ReferenceCandidate[] = [
        {
          type: 'outlet',
          bbox: { x: 0, y: 0, width: 80, height: 80 },
          confidence: 0.9,
        },
      ];
      render(
        <CalibrationOverlay
          points={basePoints}
          onReferenceChange={vi.fn()}
          onApply={vi.fn()}
          onCancel={vi.fn()}
          candidates={candidates}
          onApplyCandidate={vi.fn()}
        />,
      );
      expect(screen.getByTestId('auto-candidate-block')).toBeInTheDocument();
      expect(screen.getByText(/Розетка/)).toBeInTheDocument();
      // Catalog says outlet = 8 cm — must appear in the apply button label.
      expect(screen.getByTestId('apply-auto-candidate')).toHaveTextContent('8 см');
    });

    it('passes the picked best candidate to onApplyCandidate on click', () => {
      const onApplyCandidate = vi.fn();
      const outlet: ReferenceCandidate = {
        type: 'outlet',
        bbox: { x: 0, y: 0, width: 80, height: 80 },
        confidence: 0.9,
      };
      const door: ReferenceCandidate = {
        type: 'door',
        bbox: { x: 100, y: 0, width: 100, height: 410 },
        confidence: 0.6,
      };
      render(
        <CalibrationOverlay
          points={basePoints}
          onReferenceChange={vi.fn()}
          onApply={vi.fn()}
          onCancel={vi.fn()}
          candidates={[door, outlet]}
          onApplyCandidate={onApplyCandidate}
        />,
      );
      fireEvent.click(screen.getByTestId('apply-auto-candidate'));
      // pickBestCandidate should select outlet (catalog trust 0.95 × 0.9 =
      // 0.855 vs door 0.7 × 0.6 = 0.42).
      expect(onApplyCandidate).toHaveBeenCalledTimes(1);
      expect(onApplyCandidate.mock.calls[0]![0]).toBe(outlet);
    });

    it('hides the auto block when onApplyCandidate is not provided (defensive)', () => {
      const candidates: ReferenceCandidate[] = [
        {
          type: 'outlet',
          bbox: { x: 0, y: 0, width: 80, height: 80 },
          confidence: 0.9,
        },
      ];
      render(
        <CalibrationOverlay
          points={basePoints}
          onReferenceChange={vi.fn()}
          onApply={vi.fn()}
          onCancel={vi.fn()}
          candidates={candidates}
        />,
      );
      expect(screen.queryByTestId('auto-candidate-block')).not.toBeInTheDocument();
    });
  });
});
