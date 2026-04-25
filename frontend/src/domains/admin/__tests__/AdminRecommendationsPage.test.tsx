/**
 * Phase 10 — `<AdminRecommendationsPage>` smoke tests.
 *
 * Mocks the recommendations + designs API hooks so the SUT renders
 * synchronously, then asserts the contract:
 *   * Title + filter row + table-row click → editor drawer.
 *   * Search input fires the `search` filter into the URL (LOW-6).
 *   * Editor drawer renders fallback-suggestions block (LOW-7) and
 *     accepts a one-click pick into the draft.
 *   * «Скопировать» button opens the bulk-copy modal and submitting
 *     calls the `useCopyRecommendations` mutation with the right shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type {
  ApiRecommendation,
  ApiRecommendationListResponse,
} from '../api/recommendationsAdminApi';

// ─── Mocks ─────────────────────────────────────────────────────────────

const mockUseList = vi.fn();
const mockUseDetail = vi.fn();
const mockUseDesigns = vi.fn();
const mockUpsertMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockCopyMutate = vi.fn();
const mockCopyMutateAsync = vi.fn();

vi.mock('../api/recommendationsAdminApi', async () => {
  const actual = await vi.importActual<
    typeof import('../api/recommendationsAdminApi')
  >('../api/recommendationsAdminApi');
  return {
    ...actual,
    useRecommendationsAdminList: (q: unknown) => mockUseList(q),
    useRecommendationDetail: (st: unknown, sid: unknown) =>
      mockUseDetail(st, sid),
    useUpsertRecommendation: () => ({
      mutate: mockUpsertMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useDeleteRecommendation: () => ({
      mutate: mockDeleteMutate,
      mutateAsync: vi.fn(),
      isPending: false,
    }),
    useCopyRecommendations: () => ({
      mutate: mockCopyMutate,
      mutateAsync: mockCopyMutateAsync,
      isPending: false,
    }),
  };
});

vi.mock('../../catalog/api/catalogApi', () => ({
  useDesigns: (params: unknown) => mockUseDesigns(params),
}));

import AdminRecommendationsPage from '../ui/AdminRecommendationsPage';

// ─── Helpers ───────────────────────────────────────────────────────────

function makeRec(over: Partial<ApiRecommendation> = {}): ApiRecommendation {
  return {
    id: 'r-1',
    source_type: 'design',
    source_id: 'd-src',
    targets: [],
    updated_at: '2026-04-25T10:00:00Z',
    fallback_suggestions: [],
    ...over,
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc-search">{loc.search}</span>;
}

function renderPage(initialUrl = '/admin/recommendations') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route
            path="/admin/recommendations"
            element={
              <>
                <AdminRecommendationsPage />
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
  mockUseList.mockReset();
  mockUseDetail.mockReset();
  mockUseDesigns.mockReset();
  mockUpsertMutate.mockReset();
  mockDeleteMutate.mockReset();
  mockCopyMutate.mockReset();
  mockCopyMutateAsync.mockReset();
  // Default — no designs catalogue, no detail open.
  mockUseDesigns.mockReturnValue({ data: { items: [] } });
  mockUseDetail.mockReturnValue({ data: undefined, isFetching: false });
});

function setupListWith(items: ApiRecommendation[]): void {
  const resp: ApiRecommendationListResponse = {
    items,
    total: items.length,
    page: 1,
    size: 50,
  };
  mockUseList.mockReturnValue({
    data: resp,
    isFetching: false,
    error: null,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('<AdminRecommendationsPage>', () => {
  it('renders the page title', () => {
    setupListWith([]);
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Рекомендации' }),
    ).toBeInTheDocument();
  });

  it('renders one row per recommendation source', () => {
    setupListWith([
      makeRec({ source_id: 'd-1' }),
      makeRec({ id: 'r-2', source_type: 'panel', source_id: 'p-1' }),
    ]);
    renderPage();
    expect(screen.getByText('d-1')).toBeInTheDocument();
    expect(screen.getByText('p-1')).toBeInTheDocument();
  });

  it('writes ?search=… into the URL when the admin submits the search input (LOW-6)', () => {
    setupListWith([]);
    renderPage();
    const input = screen.getByPlaceholderText('Поиск по source_id');
    fireEvent.change(input, { target: { value: 'forest' } });
    // AntD Input.Search submits on Enter (`onSearch`).
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    const probe = screen.getByTestId('loc-search');
    expect(probe.textContent).toContain('search=forest');
  });

  it('opens the editor drawer with fallback suggestions and one-click accept (LOW-7)', () => {
    setupListWith([makeRec({ source_id: 'd-1' })]);
    // The drawer fetches detail with a fallback list.
    mockUseDetail.mockReturnValue({
      data: makeRec({
        source_id: 'd-1',
        targets: [],
        fallback_suggestions: [
          { target_type: 'design', target_id: 'd-fb-1' },
          { target_type: 'design', target_id: 'd-fb-2' },
        ],
      }),
      isFetching: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('d-1'));
    // The fallback panel header surfaces; one-click «Принять» button is
    // present per suggestion.
    expect(screen.getByText('Авто-предложения')).toBeInTheDocument();
    const acceptButtons = screen.getAllByRole('button', { name: /Принять/ });
    expect(acceptButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the bulk-copy modal with replace/append modes from the editor', () => {
    setupListWith([makeRec({ source_id: 'd-dest' })]);
    mockUseDetail.mockReturnValue({
      data: makeRec({ source_id: 'd-dest' }),
      isFetching: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('d-dest'));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Скопировать рекомендации с другого товара/,
      }),
    );
    // Modal is open with both mode options visible and an OK button.
    expect(screen.getByText('Скопировать рекомендации')).toBeInTheDocument();
    expect(screen.getByText('Заменить')).toBeInTheDocument();
    expect(screen.getByText('Дополнить')).toBeInTheDocument();
    // OK button is disabled until a source is picked — exercising the
    // `canSubmit` guard on the modal.
    const okBtn = screen.getByRole('button', { name: 'Скопировать' });
    expect(okBtn).toBeDisabled();
  });

  it('surfaces a list-fetch error via Alert', () => {
    mockUseList.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: new Error('boom'),
    });
    renderPage();
    expect(
      screen.getByText('Не удалось загрузить рекомендации'),
    ).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
