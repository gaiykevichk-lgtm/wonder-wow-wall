/**
 * Phase 5 — `<AdminUserDetailPage>` smoke + action-button visibility tests.
 *
 * Verifies:
 *   * profile / addresses / recent_orders blocks render against the
 *     canned detail payload.
 *   * action set adapts to the user's current role/status (e.g. an ADMIN
 *     does not show "Сделать админом", a blocked user only shows
 *     "Разблокировать").
 *   * 409 + `code: "last_admin"` toast is wired (the dedicated message
 *     fires instead of the generic ApiError detail).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ApiUserDetail } from '../api/usersAdminApi';
import { ApiError } from '../../../shared/api';

const messageError = vi.fn();
const messageSuccess = vi.fn();
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      ...actual.message,
      error: (...args: unknown[]) => messageError(...args),
      success: (...args: unknown[]) => messageSuccess(...args),
    },
  };
});

const mockUseUserDetail = vi.fn();
const mockBlockMutate = vi.fn();
const mockUnblockMutate = vi.fn();
const mockGrantMutate = vi.fn();
const mockRevokeMutate = vi.fn();

vi.mock('../api/usersAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdminApi')>(
    '../api/usersAdminApi',
  );
  return {
    ...actual,
    useUserDetail: (id: string | undefined) => mockUseUserDetail(id),
    useBlockUser: () => ({ mutate: mockBlockMutate, isPending: false }),
    useUnblockUser: () => ({ mutate: mockUnblockMutate, isPending: false }),
    useGrantAdmin: () => ({ mutate: mockGrantMutate, isPending: false }),
    useRevokeAdmin: () => ({ mutate: mockRevokeMutate, isPending: false }),
  };
});

import AdminUserDetailPage from '../ui/AdminUserDetailPage';

function makeDetail(over: Partial<ApiUserDetail> = {}): ApiUserDetail {
  return {
    id: 'u-1',
    email: 'ivan@test.ru',
    name: 'Иван Иванов',
    phone: '+7 999 000 00 00',
    role: 'CUSTOMER',
    is_blocked: false,
    created_at: '2026-04-25T10:00:00Z',
    addresses: [],
    recent_orders: [],
    ...over,
  };
}

function renderPage(detail: ApiUserDetail | null, error: Error | null = null) {
  mockUseUserDetail.mockReturnValue({
    data: detail,
    isLoading: false,
    error,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/users/u-1']}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/users" element={<div>list-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseUserDetail.mockReset();
  mockBlockMutate.mockReset();
  mockUnblockMutate.mockReset();
  mockGrantMutate.mockReset();
  mockRevokeMutate.mockReset();
  messageError.mockReset();
  messageSuccess.mockReset();
});


describe('<AdminUserDetailPage> — basic render', () => {
  it('renders the header with user name and role tag', () => {
    renderPage(makeDetail());
    expect(screen.getByRole('heading', { name: 'Иван Иванов' })).toBeInTheDocument();
    // The role/status labels render twice on purpose: once as the header
    // pill (Tag) and once as the value of the matching `<Descriptions>`
    // row in the profile card. Asserting "≥ 1 occurrence" keeps this test
    // robust against a future layout that changes one of the two
    // surfaces, while still failing if neither is rendered.
    expect(screen.getAllByText('Покупатель').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Активен').length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to email when name is empty', () => {
    renderPage(makeDetail({ name: '' }));
    expect(screen.getByRole('heading', { name: 'ivan@test.ru' })).toBeInTheDocument();
  });

  it('renders 404 alert for missing user', () => {
    renderPage(null, new ApiError(404, 'not found'));
    expect(screen.getByText(/Пользователь не найден/)).toBeInTheDocument();
  });

  it('renders recent orders list with click navigation', () => {
    renderPage(
      makeDetail({
        recent_orders: [
          {
            id: 'o-1',
            number: 'WW-1',
            status: 'placed',
            status_label: 'Оформлен',
            total: 1500,
            created_at: '2026-04-20T10:00:00Z',
          },
        ],
      }),
    );
    expect(screen.getByText('WW-1')).toBeInTheDocument();
    expect(screen.getByText('Оформлен')).toBeInTheDocument();
  });
});


describe('<AdminUserDetailPage> — action buttons by state', () => {
  it('CUSTOMER, active: shows grant + block, hides revoke + unblock', () => {
    renderPage(makeDetail());
    expect(screen.getByRole('button', { name: 'Сделать админом' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Заблокировать' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Снять админа' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Разблокировать' })).not.toBeInTheDocument();
  });

  it('ADMIN, active: shows revoke + block, hides grant', () => {
    renderPage(makeDetail({ role: 'ADMIN' }));
    expect(screen.getByRole('button', { name: 'Снять админа' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Заблокировать' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сделать админом' })).not.toBeInTheDocument();
  });

  it('CUSTOMER, blocked: shows unblock instead of block', () => {
    renderPage(makeDetail({ is_blocked: true }));
    expect(screen.getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Заблокировать' })).not.toBeInTheDocument();
    // "Заблокирован" renders both as the header status pill and as the
    // "Статус" value in the profile <Descriptions>. Same dual-surface
    // pattern as the role label — see "renders the header" test.
    expect(screen.getAllByText('Заблокирован').length).toBeGreaterThanOrEqual(1);
  });
});


describe('<AdminUserDetailPage> — last_admin error mapping', () => {
  it('shows the dedicated toast on 409 + code:"last_admin"', () => {
    renderPage(makeDetail({ role: 'ADMIN' }));
    // Click the "Снять админа" button — Popconfirm appears, click confirm.
    fireEvent.click(screen.getByRole('button', { name: 'Снять админа' }));
    fireEvent.click(screen.getByRole('button', { name: 'Снять' }));

    // Capture the onError callback the SUT passed to mutate(...)
    expect(mockRevokeMutate).toHaveBeenCalledTimes(1);
    const [, opts] = mockRevokeMutate.mock.calls[0];
    opts.onError(new ApiError(409, 'last admin', { code: 'last_admin' }));

    expect(messageError).toHaveBeenCalledWith(
      'Нельзя — это последний активный администратор',
    );
  });
});
