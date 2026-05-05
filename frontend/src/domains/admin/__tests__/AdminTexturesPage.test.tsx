import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type {
  ApiTexture,
  ApiTextureColor,
  ApiVariantImage,
} from '../api/texturesAdminApi';
import type { ApiAdminDesign } from '../api/catalogAdminApi';

// ─── Mocks ─────────────────────────────────────────────────────────────

const mockUseTextures = vi.fn();
const mockUseColors = vi.fn();
const mockUseVariantImages = vi.fn();
const mockUseDesigns = vi.fn();

const mockCreateTextureMutate = vi.fn();
const mockUpdateTextureMutate = vi.fn();
const mockDeleteTextureMutate = vi.fn();
const mockCreateColorMutate = vi.fn();
const mockUpdateColorMutate = vi.fn();
const mockDeleteColorMutate = vi.fn();
const mockCreateVariantMutate = vi.fn();
const mockDeleteVariantMutate = vi.fn();

vi.mock('../api/texturesAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/texturesAdminApi')>(
    '../api/texturesAdminApi',
  );
  return {
    ...actual,
    useAdminTextures: () => mockUseTextures(),
    useAdminTextureColors: (_id: unknown) => mockUseColors(),
    useAdminVariantImages: (_p: unknown) => mockUseVariantImages(),
    useCreateTexture: () => ({
      mutate: mockCreateTextureMutate,
      isPending: false,
      variables: undefined,
    }),
    useUpdateTexture: () => ({
      mutate: mockUpdateTextureMutate,
      isPending: false,
      variables: undefined,
    }),
    useDeleteTexture: () => ({
      mutate: mockDeleteTextureMutate,
      isPending: false,
      variables: undefined,
    }),
    useCreateTextureColor: () => ({
      mutate: mockCreateColorMutate,
      isPending: false,
      variables: undefined,
    }),
    useUpdateTextureColor: () => ({
      mutate: mockUpdateColorMutate,
      isPending: false,
      variables: undefined,
    }),
    useDeleteTextureColor: () => ({
      mutate: mockDeleteColorMutate,
      isPending: false,
      variables: undefined,
    }),
    useCreateVariantImage: () => ({
      mutate: mockCreateVariantMutate,
      isPending: false,
      variables: undefined,
    }),
    useDeleteVariantImage: () => ({
      mutate: mockDeleteVariantMutate,
      isPending: false,
      variables: undefined,
    }),
  };
});

vi.mock('../api/catalogAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/catalogAdminApi')>(
    '../api/catalogAdminApi',
  );
  return {
    ...actual,
    useAdminDesigns: (_q: unknown) => mockUseDesigns(),
  };
});

vi.mock('../../../shared/ui/AdminFileUpload', () => ({
  AdminFileUpload: () => <div data-testid="admin-file-upload" />,
}));

import AdminTexturesPage from '../ui/AdminTexturesPage';

// ─── Fixtures ──────────────────────────────────────────────────────────

function makeTexture(over: Partial<ApiTexture> = {}): ApiTexture {
  return {
    id: 'tex-1',
    name: 'Бетон',
    slug: 'concrete',
    swatch_image: '',
    sort_order: 0,
    is_active: true,
    created_at: '2026-05-04T10:00:00Z',
    ...over,
  };
}

function makeColor(over: Partial<ApiTextureColor> = {}): ApiTextureColor {
  return {
    id: 'col-1',
    texture_id: 'tex-1',
    name: 'Серый',
    hex: '#808080',
    swatch_image: '',
    sort_order: 0,
    is_active: true,
    created_at: '2026-05-04T10:00:00Z',
    ...over,
  };
}

function makeDesign(over: Partial<ApiAdminDesign> = {}): ApiAdminDesign {
  return {
    id: 'd-1',
    name: 'Волна',
    slug: 'wave',
    category_id: 'cat-1',
    style: '',
    image: '',
    preview_image: '',
    description: '',
    price: 1200,
    colors: [],
    rating: 0,
    reviews_count: 0,
    is_new: false,
    is_popular: false,
    is_published: true,
    created_at: '2026-05-04T10:00:00Z',
    ...over,
  };
}

function setupDefaults(
  textures: ApiTexture[] = [makeTexture()],
  colors: ApiTextureColor[] = [makeColor()],
  designs: ApiAdminDesign[] = [makeDesign()],
  variantImages: ApiVariantImage[] = [],
): void {
  mockUseTextures.mockReturnValue({
    data: textures,
    isFetching: false,
    error: null,
  });
  mockUseColors.mockReturnValue({
    data: colors,
    isFetching: false,
    error: null,
  });
  mockUseDesigns.mockReturnValue({
    data: { items: designs, total: designs.length, offset: 0, limit: 200 },
    isFetching: false,
    error: null,
  });
  mockUseVariantImages.mockReturnValue({
    data: variantImages,
    isFetching: false,
    error: null,
  });
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc-search">{loc.search}</span>;
}

function renderPage(initialUrl = '/admin/textures') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route
            path="/admin/textures"
            element={
              <>
                <AdminTexturesPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

describe('AdminTexturesPage', () => {
  describe('Textures tab (default)', () => {
    it('renders textures table with data', () => {
      renderPage();
      expect(screen.getByText('Бетон')).toBeInTheDocument();
      expect(screen.getByText('concrete')).toBeInTheDocument();
    });

    it('shows «Добавить текстуру» button', () => {
      renderPage();
      expect(
        screen.getByRole('button', { name: /добавить текстуру/i }),
      ).toBeInTheDocument();
    });

    it('opens create drawer when clicking «Добавить текстуру»', async () => {
      renderPage();
      fireEvent.click(
        screen.getByRole('button', { name: /добавить текстуру/i }),
      );
      await waitFor(() => {
        expect(screen.getByText('Новая текстура')).toBeInTheDocument();
      });
    });

    it('opens edit drawer when clicking edit button', async () => {
      renderPage();
      const editBtn = screen.getByRole('button', {
        name: 'Редактировать',
      });
      fireEvent.click(editBtn);
      await waitFor(() => {
        expect(
          screen.getByText('Редактировать текстуру'),
        ).toBeInTheDocument();
      });
    });

    it('renders sort_order column', () => {
      setupDefaults([makeTexture({ sort_order: 5 })]);
      renderPage();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders active toggle switch', () => {
      renderPage();
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThanOrEqual(1);
    });

    it('shows error alert when textures query fails', () => {
      mockUseTextures.mockReturnValue({
        data: undefined,
        isFetching: false,
        error: new Error('Network error'),
      });
      renderPage();
      expect(
        screen.getByText('Не удалось загрузить текстуры'),
      ).toBeInTheDocument();
    });
  });

  describe('Colors tab', () => {
    it('switches to colors tab via URL', () => {
      renderPage('/admin/textures?tab=colors');
      expect(
        screen.getByRole('button', { name: /добавить цвет/i }),
      ).toBeInTheDocument();
    });

    it('shows color data when texture selected', () => {
      renderPage('/admin/textures?tab=colors');
      expect(screen.getByText('Серый')).toBeInTheDocument();
    });

    it('shows hex tag for colors with hex value', () => {
      renderPage('/admin/textures?tab=colors');
      expect(screen.getByText('#808080')).toBeInTheDocument();
    });

    it('opens color create drawer', async () => {
      renderPage('/admin/textures?tab=colors');
      fireEvent.click(
        screen.getByRole('button', { name: /добавить цвет/i }),
      );
      await waitFor(() => {
        expect(screen.getByText('Новый цвет')).toBeInTheDocument();
      });
    });
  });

  describe('Variant images tab', () => {
    it('switches to images tab via URL', () => {
      renderPage('/admin/textures?tab=images');
      expect(
        screen.getByText(/выберите форму и текстуру/i),
      ).toBeInTheDocument();
    });

    it('shows design and texture dropdowns', () => {
      renderPage('/admin/textures?tab=images');
      expect(
        screen.getByText('Выберите форму (дизайн)'),
      ).toBeInTheDocument();
      expect(screen.getByText('Выберите текстуру')).toBeInTheDocument();
    });
  });

  describe('Tab navigation', () => {
    it('defaults to textures tab', () => {
      renderPage();
      expect(screen.getByText('Бетон')).toBeInTheDocument();
    });

    it('URL reflects tab state', async () => {
      renderPage();
      const colorsTab = screen.getByRole('tab', { name: 'Цвета' });
      fireEvent.click(colorsTab);
      await waitFor(() => {
        expect(
          screen.getByTestId('loc-search').textContent,
        ).toContain('tab=colors');
      });
    });
  });
});
