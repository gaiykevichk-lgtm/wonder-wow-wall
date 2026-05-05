/**
 * Phase 7A — `<AdminCatalogPage>` smoke tests.
 *
 * Mocks the catalog admin hooks so the SUT renders synchronously, then
 * asserts the page contract:
 *   * Categories tab is the default and shows count column.
 *   * Designs tab can be reached via URL `?tab=designs`.
 *   * «+ Добавить категорию» / «+ Добавить дизайн» buttons open the
 *     respective drawer with the right title.
 *   * Inline `<Switch>` on the designs row fires `useToggleDesignVisibility`.
 *   * Delete on a category with `designs_count > 0` shows the «нельзя
 *     удалить» description in the popconfirm.
 *
 * `AdminFileUpload` is stubbed away — its own behaviour is covered by
 * `uploadFile.test.ts`; here it would just bring in unrelated XHR setup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ApiError } from '../../../shared/api';
import type {
  ApiAdminCategory,
  ApiAdminCategoryListResponse,
  ApiAdminDesign,
  ApiAdminDesignListResponse,
} from '../api/catalogAdminApi';

// ─── Mocks ─────────────────────────────────────────────────────────────

const mockUseCategories = vi.fn();
const mockUseDesigns = vi.fn();
const mockCreateCategoryMutate = vi.fn();
const mockUpdateCategoryMutate = vi.fn();
const mockDeleteCategoryMutate = vi.fn();
const mockCreateDesignMutate = vi.fn();
const mockUpdateDesignMutate = vi.fn();
const mockDeleteDesignMutate = vi.fn();
const mockToggleVisibilityMutate = vi.fn();

vi.mock('../api/catalogAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/catalogAdminApi')>(
    '../api/catalogAdminApi',
  );
  return {
    ...actual,
    useAdminCategories: () => mockUseCategories(),
    useAdminDesigns: (q: unknown) => mockUseDesigns(q),
    useCreateCategory: () => ({
      mutate: mockCreateCategoryMutate,
      isPending: false,
      variables: undefined,
    }),
    useUpdateCategory: () => ({
      mutate: mockUpdateCategoryMutate,
      isPending: false,
      variables: undefined,
    }),
    useDeleteCategory: () => ({
      mutate: mockDeleteCategoryMutate,
      isPending: false,
      variables: undefined,
    }),
    useCreateDesign: () => ({
      mutate: mockCreateDesignMutate,
      isPending: false,
      variables: undefined,
    }),
    useUpdateDesign: () => ({
      mutate: mockUpdateDesignMutate,
      isPending: false,
      variables: undefined,
    }),
    useDeleteDesign: () => ({
      mutate: mockDeleteDesignMutate,
      isPending: false,
      variables: undefined,
    }),
    useToggleDesignVisibility: () => ({
      mutate: mockToggleVisibilityMutate,
      isPending: false,
      variables: undefined,
    }),
  };
});

vi.mock('../../../shared/ui/AdminFileUpload', () => ({
  AdminFileUpload: () => <div data-testid="admin-file-upload" />,
}));

import AdminCatalogPage from '../ui/AdminCatalogPage';

// ─── Fixture builders ─────────────────────────────────────────────────

function makeCategory(over: Partial<ApiAdminCategory> = {}): ApiAdminCategory {
  return {
    id: 'cat-1',
    name: 'Природа',
    slug: 'nature',
    image: '',
    designs_count: 0,
    ...over,
  };
}

function makeDesign(over: Partial<ApiAdminDesign> = {}): ApiAdminDesign {
  return {
    id: 'd-1',
    name: 'Лес на рассвете',
    slug: 'forest-sunrise',
    category_id: 'cat-1',
    style: 'Минимализм',
    image: '',
    preview_image: '',
    description: '',
    price: 1500,
    colors: [],
    rating: 0,
    reviews_count: 0,
    is_new: false,
    is_popular: false,
    is_published: true,
    created_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function setupQueries(
  categories: ApiAdminCategory[],
  designs: ApiAdminDesign[],
): void {
  const catResp: ApiAdminCategoryListResponse = { items: categories };
  const desResp: ApiAdminDesignListResponse = {
    items: designs,
    total: designs.length,
    offset: 0,
    limit: 50,
  };
  mockUseCategories.mockReturnValue({
    data: catResp,
    isFetching: false,
    error: null,
  });
  mockUseDesigns.mockReturnValue({
    data: desResp,
    isFetching: false,
    error: null,
  });
}

// `LocationProbe` exposes the current URL into the DOM so a test can
// pin assertions on URL transitions (tab-switch, deep-link round-trip).
function LocationProbe() {
  const loc = useLocation();
  return (
    <span data-testid="loc-search">{loc.search}</span>
  );
}

function renderPage(initialUrl = '/admin/catalog') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route
            path="/admin/catalog"
            element={
              <>
                <AdminCatalogPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseCategories.mockReset();
  mockUseDesigns.mockReset();
  mockCreateCategoryMutate.mockReset();
  mockUpdateCategoryMutate.mockReset();
  mockDeleteCategoryMutate.mockReset();
  mockCreateDesignMutate.mockReset();
  mockUpdateDesignMutate.mockReset();
  mockDeleteDesignMutate.mockReset();
  mockToggleVisibilityMutate.mockReset();
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe('<AdminCatalogPage>', () => {
  it('renders the page title', () => {
    setupQueries([], []);
    renderPage();
    expect(screen.getByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
  });

  it('shows the categories tab by default with category rows', () => {
    setupQueries(
      [makeCategory({ designs_count: 3 }), makeCategory({ id: 'cat-2', name: 'Город', slug: 'city' })],
      [],
    );
    renderPage();
    expect(screen.getByText('Природа')).toBeInTheDocument();
    expect(screen.getByText('Город')).toBeInTheDocument();
    // designs_count column shows the value
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens the category create drawer on «+ Добавить категорию»', () => {
    setupQueries([], []);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /Добавить категорию/i }),
    );
    expect(screen.getByText('Новая категория')).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
  });

  it('switches to the designs tab when ?tab=designs is in the URL', () => {
    setupQueries(
      [makeCategory()],
      [makeDesign(), makeDesign({ id: 'd-2', name: 'Берег моря', slug: 'sea-shore' })],
    );
    renderPage('/admin/catalog?tab=designs');
    expect(screen.getByText('Лес на рассвете')).toBeInTheDocument();
    expect(screen.getByText('Берег моря')).toBeInTheDocument();
    // Both fixture designs use the default price of 1500 — assert ≥1 cell.
    expect(screen.getAllByText('1 500 ₽').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the design category column resolved to a category name, not the id', () => {
    setupQueries(
      [makeCategory({ id: 'cat-9', name: 'Море', slug: 'sea' })],
      [makeDesign({ category_id: 'cat-9' })],
    );
    renderPage('/admin/catalog?tab=designs');
    expect(screen.getByText('Море')).toBeInTheDocument();
  });

  it('toggling the inline Switch fires useToggleDesignVisibility', () => {
    setupQueries([makeCategory()], [makeDesign()]);
    renderPage('/admin/catalog?tab=designs');
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    expect(mockToggleVisibilityMutate).toHaveBeenCalledTimes(1);
    expect(mockToggleVisibilityMutate.mock.calls[0][0]).toBe('d-1');
  });

  it('opens the edit-design drawer pre-filled with the design name', () => {
    setupQueries([makeCategory()], [makeDesign({ name: 'Уникальное Имя 42' })]);
    renderPage('/admin/catalog?tab=designs');
    fireEvent.click(
      screen.getByRole('button', { name: 'Редактировать дизайн' }),
    );
    expect(screen.getByText('Редактировать дизайн')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Уникальное Имя 42')).toBeInTheDocument();
  });

  it('opens the design create drawer with «+ Добавить дизайн»', () => {
    setupQueries([makeCategory()], []);
    renderPage('/admin/catalog?tab=designs');
    fireEvent.click(screen.getByRole('button', { name: /Добавить дизайн/i }));
    expect(screen.getByText('Новый дизайн')).toBeInTheDocument();
    expect(screen.getByLabelText('Категория')).toBeInTheDocument();
    expect(screen.getByLabelText('Цена (₽)')).toBeInTheDocument();
    expect(screen.getAllByTestId('admin-file-upload').length).toBeGreaterThanOrEqual(1);
  });

  it('surfaces a fetch error via Alert', () => {
    mockUseCategories.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: new Error('Категории недоступны'),
    });
    mockUseDesigns.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Не удалось загрузить категории')).toBeInTheDocument();
    expect(screen.getByText('Категории недоступны')).toBeInTheDocument();
  });

  // ─── N4 follow-ups (post-audit) ─────────────────────────────────────

  it('renders the empty-state for the categories tab without crashing (N4)', () => {
    setupQueries([], []);
    const { container } = renderPage();
    expect(screen.getByText('Категории')).toBeInTheDocument();
    // Zero rows under tbody — AntD shows a placeholder, but no data rows.
    const dataRows = container.querySelectorAll(
      'tbody.ant-table-tbody tr.ant-table-row',
    );
    expect(dataRows.length).toBe(0);
  });

  it('renders the empty-state for the designs tab without crashing (N4)', () => {
    setupQueries([], []);
    const { container } = renderPage('/admin/catalog?tab=designs');
    // The designs tab is active — its bespoke «Добавить дизайн» button
    // is in the DOM, and the table renders zero data rows.
    expect(
      screen.getByRole('button', { name: /Добавить дизайн/i }),
    ).toBeInTheDocument();
    const dataRows = container.querySelectorAll(
      'tbody.ant-table-tbody tr.ant-table-row',
    );
    expect(dataRows.length).toBe(0);
  });

  it('preserves designs filters in the URL across tab=designs deep-link (N4 tab-persistence)', async () => {
    setupQueries([makeCategory({ id: 'cat-9', name: 'Море' })], [makeDesign()]);
    renderPage('/admin/catalog?tab=designs&category_id=cat-9&search=forest&page=2');
    // Filters survive F5 — the URL we landed on is reflected in the
    // location probe verbatim.
    const probe = await screen.findByTestId('loc-search');
    expect(probe.textContent).toContain('tab=designs');
    expect(probe.textContent).toContain('category_id=cat-9');
    expect(probe.textContent).toContain('search=forest');
    expect(probe.textContent).toContain('page=2');
  });

  it('strips designs-only params when switching back to the categories tab (N1)', async () => {
    setupQueries([makeCategory()], [makeDesign()]);
    renderPage('/admin/catalog?tab=designs&page=3&category_id=cat-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Категории' }));
    await waitFor(() => {
      const probe = screen.getByTestId('loc-search');
      // After the switch the URL is bare — no `?tab`, `?page`,
      // `?category_id`, `?search`, `?sort` left over.
      expect(probe.textContent).toBe('');
    });
  });

  it('renders an inline slug error on slug_conflict 409 (N4)', async () => {
    setupQueries([], []);
    // Make the create-category mutation reject with the API error
    // envelope shape the page branches on.
    mockCreateCategoryMutate.mockImplementation((_payload, opts) => {
      opts?.onError?.(
        new ApiError(409, 'Slug taken', { code: 'category_slug_conflict' }),
      );
    });
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: /Добавить категорию/i }),
    );
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Природа' },
    });
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'nature' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Создать/i }));
    expect(await screen.findByText('Slug уже занят')).toBeInTheDocument();
  });

  it('disables the Popconfirm OK button on a category with attached designs (N4)', async () => {
    setupQueries([makeCategory({ designs_count: 4 })], []);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Удалить категорию' }),
    );
    // Description renders the count + the «удаление запрещено» message.
    expect(
      await screen.findByText(/К категории привязано дизайнов: 4/),
    ).toBeInTheDocument();
    // The OK button (label «Удалить» inside the popconfirm) is disabled.
    const popconfirmOk = screen
      .getAllByRole('button', { name: 'Удалить' })
      .find((b) => b.classList.contains('ant-btn-dangerous'));
    expect(popconfirmOk).toBeDefined();
    expect(popconfirmOk).toBeDisabled();
  });
});
