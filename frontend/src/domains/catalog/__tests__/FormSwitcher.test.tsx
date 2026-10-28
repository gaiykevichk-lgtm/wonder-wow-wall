import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormSwitcher from '../ui/FormSwitcher';
import type { PanelProduct } from '../model/types';

const makeProduct = (id: string, name: string): PanelProduct => ({
  id,
  name,
  category: 'cat1',
  categoryLabel: 'Cat',
  style: 'modern',
  material: 'Бетон',
  price: 2090,
  priceUnit: '/шт',
  image: `/img/${id}.jpg`,
  previewImage: '',
  gallery: [],
  description: 'desc',
  specs: {},
  colors: [],
  sizes: [],
  rating: 4.5,
  reviews: 10,
  inStock: true,
  room: [],
});

describe('FormSwitcher', () => {
  it('returns null if only the current form exists', () => {
    const forms = [makeProduct('a', 'Форма А')];
    const { container } = render(
      <FormSwitcher forms={forms} currentId="a" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders other forms excluding the current one', () => {
    const forms = [
      makeProduct('a', 'Форма А'),
      makeProduct('b', 'Форма Б'),
      makeProduct('c', 'Форма В'),
    ];
    render(
      <FormSwitcher forms={forms} currentId="a" onSelect={vi.fn()} />,
    );

    expect(screen.getByText('Другие формы')).toBeInTheDocument();
    expect(screen.getByText('Форма Б')).toBeInTheDocument();
    expect(screen.getByText('Форма В')).toBeInTheDocument();
    expect(screen.queryByText('Форма А')).not.toBeInTheDocument();
  });

  it('calls onSelect with the form id when a card is clicked', () => {
    const onSelect = vi.fn();
    const forms = [
      makeProduct('a', 'Форма А'),
      makeProduct('b', 'Форма Б'),
    ];
    render(
      <FormSwitcher forms={forms} currentId="a" onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByText('Форма Б'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
