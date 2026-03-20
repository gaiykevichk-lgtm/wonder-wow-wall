import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacementControls } from '../ui/PlacementControls';

describe('PlacementControls', () => {
  it('renders all placement mode options', () => {
    render(
      <PlacementControls
        mode="manual"
        panelCount={0}
        onModeChange={vi.fn()}
        onAutoFill={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(screen.getByText(/Вручную/)).toBeInTheDocument();
    expect(screen.getByText(/Авто/)).toBeInTheDocument();
    expect(screen.getByText(/Зона/)).toBeInTheDocument();
  });

  it('calls onAutoFill when button clicked', () => {
    const onAutoFill = vi.fn();
    render(
      <PlacementControls
        mode="manual"
        panelCount={0}
        onModeChange={vi.fn()}
        onAutoFill={onAutoFill}
        onClearAll={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Заполнить стену'));
    expect(onAutoFill).toHaveBeenCalledOnce();
  });

  it('disables clear button when no panels', () => {
    render(
      <PlacementControls
        mode="manual"
        panelCount={0}
        onModeChange={vi.fn()}
        onAutoFill={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    // The delete button (last button) should be disabled
    const buttons = screen.getAllByRole('button');
    const deleteBtn = buttons[buttons.length - 1];
    expect(deleteBtn).toBeDisabled();
  });
});
