/**
 * Phase 4B — `AdminOrderDetailPage` button-disabled-by-status invariants.
 *
 * Mocks the API hooks (no network) and asserts:
 *   * Each status renders the correct enabled/disabled action set per
 *     the `TRANSITIONS` matrix.
 *   * Items + customer info + notes block render against the canned
 *     detail payload (smoke).
 *
 * What this test deliberately does NOT cover:
 *   * The cancel/refund modal flow + ApiError 409 toast — that is the
 *     job of an e2e/integration test against the live mutation; mocking
 *     the toast in a unit test would only re-test the mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ApiOrderDetail, OrderStatusKey } from '../api/ordersAdminApi';
import { TRANSITIONS, TRANSITION_LABEL } from '../model/orderTransitions';

// Hook mocks — replace network calls with controllable shims. Order
// matters: `vi.mock` is hoisted ABOVE the imports below.
const mockUpdateMutate = vi.fn();
const mockAddNoteMutate = vi.fn();
const mockUseOrderDetail = vi.fn();
vi.mock('../api/ordersAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/ordersAdminApi')>(
    '../api/ordersAdminApi',
  );
  return {
    ...actual,
    useOrderDetail: (id: string) => mockUseOrderDetail(id),
    useUpdateOrderStatus: () => ({
      mutate: mockUpdateMutate,
      isPending: false,
    }),
    useAddOrderNote: () => ({
      mutate: mockAddNoteMutate,
      isPending: false,
    }),
  };
});

// Import AFTER the mock so the SUT picks up the shim.
import AdminOrderDetailPage from '../ui/AdminOrderDetailPage';

function makeOrder(status: OrderStatusKey): ApiOrderDetail {
  return {
    id: 'o-1',
    number: 'WW-1',
    user_id: 'u-1',
    user_email: 'cust@example.com',
    user_name: 'Иван Иванов',
    status,
    status_label: status,
    total: 3000,
    address: 'Москва, Пушкина, д. 1',
    address_full: {
      city: 'Москва',
      street: 'Пушкина',
      building: '1',
      apartment: '',
      postal_code: '',
    },
    installation_date: null,
    cancel_reason: null,
    items: [
      {
        id: 'it-1',
        design_id: 'd-1',
        design_name: 'Тест-панель',
        design_image: '',
        size_key: 'M',
        color: 'Белый',
        quantity: 2,
        unit_price: 1500,
        subtotal: 3000,
      },
    ],
    notes: [],
    created_at: '2026-04-25T10:00:00Z',
    updated_at: '2026-04-25T10:00:00Z',
  };
}

function renderAt(order: ApiOrderDetail) {
  mockUseOrderDetail.mockReturnValue({
    data: order,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/orders/${order.id}`]}>
        <Routes>
          <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="/admin/orders" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUpdateMutate.mockReset();
  mockAddNoteMutate.mockReset();
  mockUseOrderDetail.mockReset();
});


describe('<AdminOrderDetailPage>', () => {
  it('renders the header with order number and status label', () => {
    renderAt(makeOrder('placed'));
    expect(screen.getByText(/Заказ WW-1/)).toBeInTheDocument();
  });

  it('renders the items list with subtotal', () => {
    renderAt(makeOrder('confirmed'));
    expect(screen.getByText('Тест-панель')).toBeInTheDocument();
    // Both the item subtotal and the order total render as "3 000 ₽" — assert
    // we got at least one (we don't pin which DOM node, that's a layout detail).
    expect(screen.getAllByText(/3 000/).length).toBeGreaterThan(0);
  });

  it('renders customer info (name + email)', () => {
    renderAt(makeOrder('placed'));
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText('cust@example.com')).toBeInTheDocument();
  });

  // Drift detector: every status's enabled-button set must match the
  // `TRANSITIONS` matrix. Failure here = page logic and matrix disagree.
  describe.each(Object.keys(TRANSITIONS) as OrderStatusKey[])(
    'when status = %s',
    (status) => {
      it('disables forbidden actions, enables only legal targets', () => {
        renderAt(makeOrder(status));
        const allowed = new Set(TRANSITIONS[status]);
        for (const [target, label] of Object.entries(TRANSITION_LABEL)) {
          const btn = screen.getByRole('button', { name: label });
          if (allowed.has(target as keyof typeof TRANSITION_LABEL)) {
            expect(btn).not.toBeDisabled();
          } else {
            expect(btn).toBeDisabled();
          }
        }
      });
    },
  );

  it('shows the "terminal" notice for cancelled / refunded', () => {
    renderAt(makeOrder('cancelled'));
    expect(
      screen.getByText(/Заказ в финальном статусе/),
    ).toBeInTheDocument();
  });

  it('does NOT show the terminal notice for open statuses', () => {
    renderAt(makeOrder('placed'));
    expect(
      screen.queryByText(/Заказ в финальном статусе/),
    ).not.toBeInTheDocument();
  });

  it('renders cancel_reason in the sidebar when set', () => {
    const order = makeOrder('cancelled');
    order.cancel_reason = 'Клиент передумал';
    renderAt(order);
    expect(screen.getByText('Клиент передумал')).toBeInTheDocument();
  });

  it('renders empty-notes placeholder', () => {
    renderAt(makeOrder('placed'));
    expect(screen.getByText('Заметок пока нет')).toBeInTheDocument();
  });
});
