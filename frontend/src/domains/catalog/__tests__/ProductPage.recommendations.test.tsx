/**
 * Phase 10 — `<ProductPage>` recommendation rail regression test.
 *
 * Pins the priority chain that drives the «Похожие товары» block:
 *   1. Server-curated `usePublicRecommendations` items mapped through
 *      the cached `useDesigns` catalogue → render those first.
 *   2. On API error / empty server response, fall back to the legacy
 *      same-category heuristic (matches pre-Phase-10 behaviour).
 *
 * The test mocks every catalog hook the page calls so the SUT renders
 * synchronously without spinning up an HTTP layer. We assert the
 * rendered «Похожие товары» rail in each branch separately.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// jsdom doesn't ship `IntersectionObserver`; framer-motion's viewport
// feature relies on it. A no-op stub is enough — these tests don't
// assert visibility, only the data-flow into the rail.
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
// @ts-expect-error — global polyfill for jsdom
globalThis.IntersectionObserver = IntersectionObserverStub;

const mockUseDesign = vi.fn();
const mockUseDesigns = vi.fn();
const mockUseDesignReviews = vi.fn();
const mockUsePublicRecommendations = vi.fn();
const mockUseAddReview = vi.fn();

vi.mock('../api/catalogApi', () => ({
  useDesign: (id: string) => mockUseDesign(id),
  useDesigns: (params: unknown) => mockUseDesigns(params),
  useDesignReviews: (id: string) => mockUseDesignReviews(id),
  useAddReview: (id: string) => mockUseAddReview(id),
  usePublicRecommendations: (vars: unknown) => mockUsePublicRecommendations(vars),
}));

import ProductPage from '../ui/ProductPage';

function makeApiDesign(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'd-source',
    name: 'Source Design',
    slug: 'source-design',
    category_id: 'cat-1',
    style: 'Минимализм',
    image: '/img/source.jpg',
    description: 'src',
    price: 1200,
    // Page reads `product.colors[selectedColor].name` unconditionally;
    // a non-empty list keeps the SUT renderable in the test env.
    colors: [{ hex: '#000000', name: 'Чёрный' }],
    rating: 4.5,
    reviews_count: 0,
    is_new: false,
    is_popular: false,
    ...over,
  };
}

function renderProductPage(productId: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/catalog/${productId}`]}>
        <Routes>
          <Route path="/catalog/:id" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseDesign.mockReset();
  mockUseDesigns.mockReset();
  mockUseDesignReviews.mockReset();
  mockUsePublicRecommendations.mockReset();
  mockUseAddReview.mockReset();
  mockUseDesignReviews.mockReturnValue({ data: [], isLoading: false });
  mockUseAddReview.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe('<ProductPage> recommendation rail', () => {
  it('renders server-curated targets first when the public API returns them', () => {
    // Source design.
    mockUseDesign.mockReturnValue({
      data: makeApiDesign({ id: 'd-source' }),
      isLoading: false,
      isError: false,
    });
    // Catalogue contains 1 curated target + 2 same-category siblings.
    mockUseDesigns.mockReturnValue({
      data: {
        items: [
          makeApiDesign({ id: 'd-curated', name: 'Curated Pick' }),
          makeApiDesign({ id: 'd-sibling-1', name: 'Sibling One' }),
          makeApiDesign({ id: 'd-sibling-2', name: 'Sibling Two' }),
        ],
        total: 3,
      },
    });
    mockUsePublicRecommendations.mockReturnValue({
      data: {
        items: [{ target_type: 'design', target_id: 'd-curated' }],
      },
      isError: false,
    });
    renderProductPage('d-source');
    // The curated pick wins — it surfaces in the rail.
    expect(screen.getByText('Curated Pick')).toBeInTheDocument();
  });

  it('falls back to same-category heuristic when the API returns an empty list', () => {
    mockUseDesign.mockReturnValue({
      data: makeApiDesign({ id: 'd-source', category_id: 'cat-X' }),
      isLoading: false,
      isError: false,
    });
    mockUseDesigns.mockReturnValue({
      data: {
        items: [
          makeApiDesign({ id: 'd-source', category_id: 'cat-X' }),
          makeApiDesign({ id: 'd-other', name: 'Other Cat', category_id: 'cat-Y' }),
          makeApiDesign({ id: 'd-same', name: 'Same Cat', category_id: 'cat-X' }),
        ],
        total: 3,
      },
    });
    // Empty server-side recommendation list.
    mockUsePublicRecommendations.mockReturnValue({
      data: { items: [] },
      isError: false,
    });
    renderProductPage('d-source');
    // Heuristic fallback — only same-category sibling renders.
    expect(screen.getByText('Same Cat')).toBeInTheDocument();
    // The cross-category design is excluded by the heuristic filter.
    expect(screen.queryByText('Other Cat')).toBeNull();
  });

  it('falls back to heuristic when the API errors out', () => {
    mockUseDesign.mockReturnValue({
      data: makeApiDesign({ id: 'd-source', category_id: 'cat-1' }),
      isLoading: false,
      isError: false,
    });
    mockUseDesigns.mockReturnValue({
      data: {
        items: [
          makeApiDesign({ id: 'd-source', category_id: 'cat-1' }),
          makeApiDesign({ id: 'd-fb', name: 'Fallback Item', category_id: 'cat-1' }),
        ],
        total: 2,
      },
    });
    mockUsePublicRecommendations.mockReturnValue({
      data: undefined,
      isError: true,
    });
    renderProductPage('d-source');
    expect(screen.getByText('Fallback Item')).toBeInTheDocument();
  });
});
