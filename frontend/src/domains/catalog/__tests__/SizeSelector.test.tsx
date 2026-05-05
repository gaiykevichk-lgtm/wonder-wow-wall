import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SizeSelector from '../ui/SizeSelector';

describe('SizeSelector', () => {
  it('renders all three size options', () => {
    render(<SizeSelector activeSizeKey="300x300" onChange={() => {}} />);

    expect(screen.getByText('Размер')).toBeDefined();
    expect(screen.getByText('30×30 см')).toBeDefined();
    expect(screen.getByText('30×60 см')).toBeDefined();
    expect(screen.getByText('60×60 см')).toBeDefined();
  });

  it('shows correct prices (base + design overlay)', () => {
    render(<SizeSelector activeSizeKey="300x300" onChange={() => {}} />);

    // 890 + 1200 = 2 090, 1490 + 1200 = 2 690, 2490 + 1200 = 3 690
    expect(screen.getByText(/2\s?090\s*₽/)).toBeDefined();
    expect(screen.getByText(/2\s?690\s*₽/)).toBeDefined();
    expect(screen.getByText(/3\s?690\s*₽/)).toBeDefined();
  });

  it('calls onChange with correct size key when clicked', () => {
    const handleChange = vi.fn();
    render(<SizeSelector activeSizeKey="300x300" onChange={handleChange} />);

    fireEvent.click(screen.getByText('30×60 см'));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('300x600');
  });

  it('active size button has green background', () => {
    render(<SizeSelector activeSizeKey="300x600" onChange={() => {}} />);

    const activeButton = screen.getByText('30×60 см').closest('button')!;
    expect(activeButton.style.background).toBe('rgb(76, 175, 80)');
    expect(activeButton.style.color).toBe('rgb(255, 255, 255)');

    const inactiveButton = screen.getByText('30×30 см').closest('button')!;
    expect(inactiveButton.style.background).toBe('rgb(255, 255, 255)');
  });
});
