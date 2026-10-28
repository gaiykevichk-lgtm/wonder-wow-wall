import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColorSelector from '../ui/ColorSelector';
import type { TextureColor } from '../model/types';

const colors: TextureColor[] = [
  { id: '1', name: 'Белый', hex: '#FFFFFF', swatchImage: '' },
  { id: '2', name: 'Чёрный', hex: '#000000', swatchImage: '' },
  { id: '3', name: 'Дуб', hex: '#8B6914', swatchImage: '/textures/oak.jpg' },
];

describe('ColorSelector', () => {
  it('returns null when colors array is empty', () => {
    const { container } = render(
      <ColorSelector colors={[]} activeId="1" onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the active color name', () => {
    render(<ColorSelector colors={colors} activeId="2" onChange={vi.fn()} />);
    expect(screen.getByText('Чёрный')).toBeInTheDocument();
  });

  it('calls onChange with the color id when a swatch button is clicked', () => {
    const onChange = vi.fn();
    render(<ColorSelector colors={colors} activeId="1" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Чёрный' }));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('shows checkmark SVG only for the active color', () => {
    render(<ColorSelector colors={colors} activeId="2" onChange={vi.fn()} />);

    const radios = screen.getAllByRole('radio');
    const svgs = radios.map((btn) => btn.querySelector('svg'));

    // Only the active button (index 1, id "2") should contain the checkmark SVG
    expect(svgs[0]).toBeNull();
    expect(svgs[1]).not.toBeNull();
    expect(svgs[2]).toBeNull();
  });
});
