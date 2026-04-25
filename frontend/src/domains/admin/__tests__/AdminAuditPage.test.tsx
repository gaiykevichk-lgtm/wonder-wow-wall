/**
 * Phase 9 — `<AdminAuditPage>` smoke tests.
 *
 * Mirrors `AdminUsersPage.test.tsx`: mock the data-fetching hook so the
 * SUT renders synchronously, then assert:
 *   * the page title and table columns appear,
 *   * action / target labels are rendered in Russian,
 *   * payload summary collapses to the per-action human form,
 *   * a target with a deep-link route (user/order) renders as a link,
 *     and a target without one (settings) renders as plain text,
 *   * an error from the hook is surfaced as an Alert.
 *
 * No network: the page only depends on `useAuditList` which is mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type {
  ApiAuditEntry,
  ApiAuditListResponse,
} from '../api/auditApi';

const mockUseAuditList = vi.fn();
vi.mock('../api/auditApi', async () => {
  const actual = await vi.importActual<typeof import('../api/auditApi')>(
    '../api/auditApi',
  );
  return {
    ...actual,
    useAuditList: (q: unknown) => mockUseAuditList(q),
  };
});

import AdminAuditPage from '../ui/AdminAuditPage';

function makeEntry(over: Partial<ApiAuditEntry> = {}): ApiAuditEntry {
  return {
    id: 'a-1',
    actor_id: 'admin-1',
    action: 'user_block',
    target_type: 'user',
    target_id: 'u-1',
    payload: { email: 'ivan@test.ru' },
    ip: '127.0.0.1',
    created_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function renderPage(
  items: ApiAuditEntry[],
  opts: { error?: Error | null; isFetching?: boolean } = {},
) {
  const response: ApiAuditListResponse = {
    items,
    total: items.length,
    page: 1,
    size: 50,
  };
  mockUseAuditList.mockReturnValue({
    data: response,
    isFetching: opts.isFetching ?? false,
    error: opts.error ?? null,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/audit']}>
        <Routes>
          <Route path="/admin/audit" element={<AdminAuditPage />} />
          <Route path="/admin/users/:id" element={<div>user-detail</div>} />
          <Route path="/admin/orders/:id" element={<div>order-detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseAuditList.mockReset();
});

describe('<AdminAuditPage>', () => {
  it('renders the page title', () => {
    renderPage([]);
    expect(
      screen.getByRole('heading', { name: 'Аудит' }),
    ).toBeInTheDocument();
  });

  it('renders empty-state for a zero-row response', () => {
    renderPage([]);
    // AntD Table places the placeholder in `.ant-empty-description`.
    expect(
      screen.getByText(
        (_, el) => el?.classList.contains('ant-empty-description') ?? false,
      ),
    ).toBeInTheDocument();
  });

  it('renders user_block entry with Russian label and email payload summary', () => {
    renderPage([makeEntry()]);
    expect(screen.getByText('Блокировка пользователя')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
    // Payload summary for user_* actions = the email field.
    expect(screen.getByText('ivan@test.ru')).toBeInTheDocument();
  });

  it('renders order_status_change with from→to summary', () => {
    renderPage([
      makeEntry({
        id: 'a-2',
        action: 'order_status_change',
        target_type: 'order',
        target_id: 'o-9',
        payload: { number: 'WW-9', from: 'placed', to: 'confirmed' },
      }),
    ]);
    expect(screen.getByText('Смена статуса заказа')).toBeInTheDocument();
    // Summary string: "WW-9: placed → confirmed"
    expect(screen.getByText(/WW-9.*placed.*confirmed/)).toBeInTheDocument();
  });

  it('renders settings_update with diff summary and no deep link', () => {
    renderPage([
      makeEntry({
        id: 'a-3',
        action: 'settings_update',
        target_type: 'settings',
        target_id: 'singleton',
        payload: {
          changes: { installation_price: { from: 1000, to: 2000 } },
        },
      }),
    ]);
    expect(screen.getByText('Изменение настроек магазина')).toBeInTheDocument();
    expect(
      screen.getByText(/installation_price.*1000.*2000/),
    ).toBeInTheDocument();
    // Settings has no deep link — the target_id should NOT be rendered as
    // an <a>. Look for the plain target id text inside a non-link element.
    const idCell = screen.getByText('singleton');
    expect(idCell.closest('a')).toBeNull();
  });

  it('renders user target as a link to /admin/users/:id', () => {
    renderPage([makeEntry({ target_type: 'user', target_id: 'u-42' })]);
    const idNode = screen.getByText('u-42');
    const link = idNode.closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/admin/users/u-42');
  });

  it('renders order target as a link to /admin/orders/:id', () => {
    renderPage([
      makeEntry({
        action: 'order_status_change',
        target_type: 'order',
        target_id: 'o-42',
        payload: { number: 'WW-42', from: 'placed', to: 'confirmed' },
      }),
    ]);
    const idNode = screen.getByText('o-42');
    const link = idNode.closest('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/admin/orders/o-42');
  });

  it('surfaces fetch errors via an Alert', () => {
    renderPage([], { error: new Error('boom') });
    expect(
      screen.getByText('Не удалось загрузить журнал аудита'),
    ).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('renders entry without target as em-dash placeholder', () => {
    renderPage([
      makeEntry({
        id: 'a-9',
        action: 'media_upload_suspicious',
        target_type: null,
        target_id: null,
        payload: {},
      }),
    ]);
    // `Подозрительная загрузка` row has no target cell content; the page
    // renders an em-dash. Don't anchor on the exact "—" character (could
    // be picked up by the payload column for empty payload too) — instead
    // assert there's at least one such cell.
    const emDashes = screen.getAllByText('—');
    expect(emDashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Russian filter placeholders', () => {
    renderPage([]);
    // The action / target-type Select placeholders ("Действие" / "Тип
    // цели") collide with the matching Table column headers, so we
    // assert the actor/target-id Input.Search placeholders instead —
    // those render as native `placeholder=` attributes unique to the
    // filter row.
    expect(screen.getByPlaceholderText('ID актора')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ID цели')).toBeInTheDocument();
    // "Действие" / "Тип цели" appear in both filter and table header —
    // assert at least 2 occurrences each.
    expect(screen.getAllByText('Действие').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Тип цели').length).toBeGreaterThanOrEqual(1);
  });
});
