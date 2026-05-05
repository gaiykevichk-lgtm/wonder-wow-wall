import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfiguratorPanel from '../ui/ConfiguratorPanel';
import type { FullConfig, Texture } from '../model/types';
import { useCartStore } from '../../order/model/cartStore';

vi.mock('../../order/model/cartStore', () => ({
  useCartStore: vi.fn(),
}));

const defaultTextures: Texture[] = [
  {
    id: 'tex-1',
    name: 'Бетон',
    slug: 'concrete',
    swatchImage: '/swatch.jpg',
    colors: [
      { id: 'col-1', name: 'Серый', hex: '#8C8C8C', swatchImage: '' },
      { id: 'col-2', name: 'Белый', hex: '#F5F5F5', swatchImage: '' },
    ],
  },
];

const makeConfig = (textures = defaultTextures): FullConfig => ({
  designId: 'design-1',
  designName: 'Волна',
  previewImage: '/preview.jpg',
  description: 'Test',
  price: 1200,
  textures,
  variantImages: [],
});

let mockAddItemWithQuantity: ReturnType<typeof vi.fn>;
let mockSetOpen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAddItemWithQuantity = vi.fn();
  mockSetOpen = vi.fn();
  (useCartStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector?: any) => {
      const state = {
        addItemWithQuantity: mockAddItemWithQuantity,
        setOpen: mockSetOpen,
      };
      return selector ? selector(state) : state;
    },
  );
});

describe('ConfiguratorPanel', () => {
  it('renders texture, color, and size selectors when config has textures', () => {
    render(
      <ConfiguratorPanel
        config={makeConfig()}
        designId="design-1"
        designImage="/design.jpg"
        onVariantImageChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Текстура')).toBeInTheDocument();
    expect(screen.getByText('Бетон')).toBeInTheDocument();
    expect(screen.getByText('Серый')).toBeInTheDocument();
    expect(screen.getByText('Размер')).toBeInTheDocument();
  });

  it('does not render texture/color selectors when config has no textures', () => {
    render(
      <ConfiguratorPanel
        config={makeConfig([])}
        designId="design-1"
        designImage="/design.jpg"
        onVariantImageChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Текстура')).not.toBeInTheDocument();
    expect(screen.getByText('Размер')).toBeInTheDocument();
  });

  it('shows correct total price for default size (300x300: 890 + config.price) * 1', () => {
    render(
      <ConfiguratorPanel
        config={makeConfig()}
        designId="design-1"
        designImage="/design.jpg"
        onVariantImageChange={vi.fn()}
      />,
    );

    // 890 (base for 300x300) + 1200 (config.price) = 2090
    // The price appears both in SizeSelector and in the total display;
    // target the total via its large font-size wrapper.
    const matches = screen.getAllByText(/2\s?090\s*₽/);
    const totalEl = matches.find(
      (el) => el.style?.fontSize === '28px',
    );
    expect(totalEl).toBeDefined();
  });

  it('"В корзину" button triggers addItemWithQuantity', () => {
    render(
      <ConfiguratorPanel
        config={makeConfig()}
        designId="design-1"
        designImage="/design.jpg"
        onVariantImageChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('В корзину'));

    expect(mockAddItemWithQuantity).toHaveBeenCalledTimes(1);
    expect(mockAddItemWithQuantity).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'design-1',
        name: 'Волна',
        price: 2090,
        sizeKey: '300x300',
      }),
      1,
    );
  });
});
