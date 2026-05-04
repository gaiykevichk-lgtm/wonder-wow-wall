import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
// @ts-expect-error — global polyfill for jsdom
globalThis.IntersectionObserver = IntersectionObserverStub;

const mockUseDesigns = vi.fn();

vi.mock('../api/catalogApi', () => ({
  useDesigns: () => mockUseDesigns(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import CatalogPage from '../ui/CatalogPage';

function makeDesign(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    slug: id,
    category_id: 'cat-1',
    style: 'Минимализм',
    image: `/img/${id}.jpg`,
    preview_image: `/img/${id}-preview.png`,
    description: 'desc',
    price: 1200,
    colors: [{ hex: '#000', name: 'Чёрный' }],
    rating: 4.5,
    reviews_count: 10,
    is_new: false,
    is_popular: false,
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
});

describe('CatalogPage', () => {
  it('renders loading skeletons while data is loading', () => {
    mockUseDesigns.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByText('Выберите форму панели')).toBeTruthy();
  });

  it('renders form cards from API data', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [
          makeDesign('wave', 'Волна', { is_new: true }),
          makeDesign('hex', 'Гексагон', { is_popular: true }),
          makeDesign('triangle', 'Треугольник'),
        ],
        total: 3,
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('Волна')).toBeTruthy();
    expect(screen.getByText('Гексагон')).toBeTruthy();
    expect(screen.getByText('Треугольник')).toBeTruthy();
  });

  it('shows preview_image in card image src', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [makeDesign('wave', 'Волна')],
        total: 1,
      },
      isLoading: false,
    });
    renderPage();

    const img = screen.getByAltText('Волна') as HTMLImageElement;
    expect(img.src).toContain('/img/wave-preview.png');
  });

  it('falls back to image when preview_image is empty', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [makeDesign('wave', 'Волна', { preview_image: '' })],
        total: 1,
      },
      isLoading: false,
    });
    renderPage();

    const img = screen.getByAltText('Волна') as HTMLImageElement;
    expect(img.src).toContain('/img/wave.jpg');
  });

  it('navigates to /product/:id on card click', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [makeDesign('wave', 'Волна')],
        total: 1,
      },
      isLoading: false,
    });
    renderPage();

    fireEvent.click(screen.getByText('Волна'));
    expect(mockNavigate).toHaveBeenCalledWith('/product/wave');
  });

  it('shows badge for new and popular designs', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [
          makeDesign('wave', 'Волна', { is_new: true }),
          makeDesign('hex', 'Гексагон', { is_popular: true }),
        ],
        total: 2,
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('Новинка')).toBeTruthy();
    expect(screen.getByText('Популярное')).toBeTruthy();
  });

  it('shows empty state when no products match search', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [makeDesign('wave', 'Волна')],
        total: 1,
      },
      isLoading: false,
    });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Поиск по названию формы...');
    fireEvent.change(searchInput, { target: { value: 'xyz-not-found' } });

    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });

  it('filters products by search query', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [
          makeDesign('wave', 'Волна'),
          makeDesign('hex', 'Гексагон'),
        ],
        total: 2,
      },
      isLoading: false,
    });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Поиск по названию формы...');
    fireEvent.change(searchInput, { target: { value: 'Волна' } });

    expect(screen.getByText('Волна')).toBeTruthy();
    expect(screen.queryByText('Гексагон')).toBeNull();
  });

  it('displays price with "от" prefix', () => {
    mockUseDesigns.mockReturnValue({
      data: {
        items: [makeDesign('wave', 'Волна', { price: 2500 })],
        total: 1,
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText(/от\s.*2[\s ]?500\s*₽/)).toBeTruthy();
  });
});
