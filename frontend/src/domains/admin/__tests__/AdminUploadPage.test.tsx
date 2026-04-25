/**
 * Phase 7B — `<AdminUploadPage>` (panels SKU) smoke tests.
 *
 * Mirrors the strategy of `AdminUsersPage.test.tsx`: mock the data
 * hooks so the SUT renders synchronously, then assert:
 *   * column contract (every list-item field appears),
 *   * the «+ Добавить панель» button opens the create drawer,
 *   * the inline `<Switch>` calls the update mutation.
 *
 * AdminFileUpload is mocked away — its own behaviour is covered by
 * `uploadFile.test.ts`; here it would just bring in unrelated XHR setup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ApiError } from '../../../shared/api';
import type {
  ApiPanel,
  ApiPanelListResponse,
} from '../api/panelsAdminApi';

// ─── Mocks ─────────────────────────────────────────────────────────────

const mockUseList = vi.fn();
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('../api/panelsAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/panelsAdminApi')>(
    '../api/panelsAdminApi',
  );
  return {
    ...actual,
    usePanelsAdminList: (q: unknown) => mockUseList(q),
    useCreatePanel: () => ({
      mutate: mockCreateMutate,
      isPending: false,
      variables: undefined,
    }),
    useUpdatePanel: () => ({
      mutate: mockUpdateMutate,
      isPending: false,
      variables: undefined,
    }),
    useDeletePanel: () => ({
      mutate: mockDeleteMutate,
      isPending: false,
      variables: undefined,
    }),
  };
});

// AdminFileUpload pulls in XHR-dependent code; stub it to a marker div
// so we can assert it renders inside the drawer without bringing the
// whole upload pipeline along.
vi.mock('../../../shared/ui/AdminFileUpload', () => ({
  AdminFileUpload: () => <div data-testid="admin-file-upload" />,
}));

import AdminUploadPage from '../ui/AdminUploadPage';

// ─── Helpers ───────────────────────────────────────────────────────────

function makePanel(over: Partial<ApiPanel> = {}): ApiPanel {
  return {
    id: 'p-1',
    name: 'Панель 30×30',
    slug: 'panel-30x30',
    width_mm: 300,
    height_mm: 300,
    size_label: '30×30 см',
    base_price: 890,
    description: '',
    photo_path: '',
    is_active: true,
    created_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function renderPage(items: ApiPanel[]) {
  const response: ApiPanelListResponse = {
    items,
    total: items.length,
    offset: 0,
    limit: 50,
  };
  mockUseList.mockReturnValue({
    data: response,
    isFetching: false,
    error: null,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/upload']}>
        <AdminUploadPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseList.mockReset();
  mockCreateMutate.mockReset();
  mockUpdateMutate.mockReset();
  mockDeleteMutate.mockReset();
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe('<AdminUploadPage>', () => {
  it('renders the page title', () => {
    renderPage([]);
    expect(screen.getByRole('heading', { name: 'Панели' })).toBeInTheDocument();
  });

  it('renders one row per panel with all contract fields visible', () => {
    renderPage([
      makePanel(),
      makePanel({
        id: 'p-2',
        name: 'Панель 60×60',
        slug: 'panel-60x60',
        width_mm: 600,
        height_mm: 600,
        size_label: '60×60 см',
        base_price: 2490,
        is_active: false,
      }),
    ]);
    expect(screen.getByText('Панель 30×30')).toBeInTheDocument();
    expect(screen.getByText('Панель 60×60')).toBeInTheDocument();
    expect(screen.getByText('panel-30x30')).toBeInTheDocument();
    expect(screen.getByText('panel-60x60')).toBeInTheDocument();
    expect(screen.getByText('30×30 см')).toBeInTheDocument();
    expect(screen.getByText('60×60 см')).toBeInTheDocument();
    expect(screen.getByText('890 ₽')).toBeInTheDocument();
    expect(screen.getByText('2 490 ₽')).toBeInTheDocument();
  });

  it('renders the empty-state for a zero-row response', () => {
    renderPage([]);
    expect(
      screen.getByText((_, el) =>
        el?.classList.contains('ant-empty-description') ?? false,
      ),
    ).toBeInTheDocument();
  });

  it('opens the create drawer on «Добавить панель»', () => {
    renderPage([]);
    fireEvent.click(screen.getByRole('button', { name: /Добавить панель/i }));
    expect(screen.getByText('Новая панель')).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
    expect(screen.getByLabelText('Базовая цена (₽)')).toBeInTheDocument();
    expect(screen.getByTestId('admin-file-upload')).toBeInTheDocument();
  });

  it('toggling the inline Switch fires useUpdatePanel with is_active patch', () => {
    renderPage([makePanel()]);
    // The Switch is the only checkbox role rendered in the table row.
    const sw = screen.getByRole('switch');
    expect(sw).toBeInTheDocument();
    fireEvent.click(sw);
    expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutate.mock.calls[0][0]).toEqual({
      panelId: 'p-1',
      body: { is_active: false },
    });
  });

  it('opens the edit drawer pre-filled when the edit button is clicked', () => {
    renderPage([makePanel({ name: 'Уникальное Имя 42' })]);
    // The edit button is rendered with aria-label="Редактировать".
    const editBtn = screen.getByRole('button', { name: 'Редактировать' });
    fireEvent.click(editBtn);
    expect(screen.getByText('Редактировать панель')).toBeInTheDocument();
    // Form should be pre-populated with the panel's name.
    expect(screen.getByDisplayValue('Уникальное Имя 42')).toBeInTheDocument();
  });

  // ─── N-test-7B follow-ups (post-audit) ──────────────────────────────

  it('renders inline slug error on panel_slug_conflict 409 (N-test-7B)', async () => {
    renderPage([]);
    // Make the create-panel mutation reject with the API error envelope
    // shape the page branches on (`code: panel_slug_conflict`).
    mockCreateMutate.mockImplementation((_payload, opts) => {
      opts?.onError?.(
        new ApiError(409, 'Slug taken', { code: 'panel_slug_conflict' }),
      );
    });
    fireEvent.click(screen.getByRole('button', { name: /Добавить панель/i }));
    fireEvent.change(screen.getByLabelText('Название'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'taken' },
    });
    // Drawer's primary button is «Сохранить» in edit mode; «Создать»
    // in create mode. Match by exact text inside the drawer.
    fireEvent.click(screen.getByRole('button', { name: /Создать/i }));
    expect(await screen.findByText('Slug уже занят')).toBeInTheDocument();
  });

  it('delete Popconfirm: confirm fires useDeletePanel with row id (N-test-7B)', async () => {
    renderPage([makePanel({ id: 'p-del' })]);
    // Trigger: row's icon-only «Удалить» button (aria-label).
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    // Popover OK: a NEW button with name «Удалить» appears inside the
    // `.ant-popover` overlay. We disambiguate from the trigger by
    // requiring the parent `.ant-popconfirm-buttons` container.
    const popconfirmOk = await waitFor(() => {
      const candidates = screen.getAllByRole('button', { name: 'Удалить' });
      const inPopover = candidates.find((b) =>
        b.closest('.ant-popconfirm-buttons') !== null,
      );
      expect(inPopover).toBeDefined();
      return inPopover!;
    });
    fireEvent.click(popconfirmOk);
    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    });
    expect(mockDeleteMutate.mock.calls[0][0]).toBe('p-del');
  });

  it('delete Popconfirm: cancel does NOT fire delete (N-test-7B)', async () => {
    renderPage([makePanel({ id: 'p-del' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    const cancelBtn = await screen.findByRole('button', { name: 'Отмена' });
    fireEvent.click(cancelBtn);
    // Allow microtask flush so an erroneous mutate call would land.
    await waitFor(() => {
      expect(mockDeleteMutate).not.toHaveBeenCalled();
    });
  });
});
