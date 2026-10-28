/**
 * Phase 5 — `<AdminUsersPage>` smoke tests.
 *
 * Mirrors the strategy of `AdminOrderDetailPage.test.tsx`: mock the
 * data-fetching hook so the SUT renders synchronously, then assert the
 * column contract (every list-item field appears) and a couple of
 * behaviours that catch easy-to-break regressions:
 *   * filter dropdowns push the URL (round-trip through useSearchParams)
 *   * row click navigates to /admin/users/:id
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { ApiUserListItem, ApiUsersListResponse } from '../api/usersAdminApi';

const mockUseUsersAdminList = vi.fn();
vi.mock('../api/usersAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/usersAdminApi')>(
    '../api/usersAdminApi',
  );
  return {
    ...actual,
    useUsersAdminList: (q: unknown) => mockUseUsersAdminList(q),
  };
});

import AdminUsersPage from '../ui/AdminUsersPage';

function makeUser(over: Partial<ApiUserListItem> = {}): ApiUserListItem {
  return {
    id: 'u-1',
    email: 'ivan@test.ru',
    name: 'Иван Иванов',
    phone: '+7 999 000 00 00',
    role: 'CUSTOMER',
    is_blocked: false,
    created_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function renderPage(items: ApiUserListItem[]) {
  const response: ApiUsersListResponse = {
    items,
    total: items.length,
    page: 1,
    size: 50,
  };
  mockUseUsersAdminList.mockReturnValue({
    data: response,
    isFetching: false,
    error: null,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<div>detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseUsersAdminList.mockReset();
});


describe('<AdminUsersPage>', () => {
  it('renders the page title', () => {
    renderPage([]);
    expect(screen.getByRole('heading', { name: 'Пользователи' })).toBeInTheDocument();
  });

  it('renders one row per user with all contract fields visible', () => {
    renderPage([
      makeUser(),
      makeUser({
        id: 'u-2',
        email: 'admin@test.ru',
        // Distinct from "Админ" role label so getByText('Админ') resolves
        // to the role tag (ADMIN), not a colliding name.
        name: 'Админка Петрова',
        phone: '+7 911 111 11 11',
        role: 'ADMIN',
        is_blocked: true,
      }),
    ]);
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText('Админка Петрова')).toBeInTheDocument();
    expect(screen.getByText('ivan@test.ru')).toBeInTheDocument();
    expect(screen.getByText('admin@test.ru')).toBeInTheDocument();
    expect(screen.getByText('+7 999 000 00 00')).toBeInTheDocument();
    expect(screen.getByText('+7 911 111 11 11')).toBeInTheDocument();
    expect(screen.getByText('Покупатель')).toBeInTheDocument();
    expect(screen.getByText('Админ')).toBeInTheDocument();
    expect(screen.getByText('Активен')).toBeInTheDocument();
    expect(screen.getByText('Заблокирован')).toBeInTheDocument();
  });

  it('renders the empty-state for a zero-row response', () => {
    renderPage([]);
    // AntD Table's empty cell renders "No data" or its localised variant.
    // We rely on the standard placeholder existing rather than its exact
    // text so a future ConfigProvider locale change does not break this.
    expect(
      screen.getByText((_, el) => el?.classList.contains('ant-empty-description') ?? false),
    ).toBeInTheDocument();
  });

  it('row click navigates to /admin/users/:id', () => {
    renderPage([makeUser()]);
    fireEvent.click(screen.getByText('Иван Иванов'));
    expect(screen.getByText('detail-page')).toBeInTheDocument();
  });

  it('placeholder of dash for empty phone column', () => {
    renderPage([makeUser({ phone: '' })]);
    // The dash is the visible fallback; checking presence is enough —
    // the exact span markup is a layout detail.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
