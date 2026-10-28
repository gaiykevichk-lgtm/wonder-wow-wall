/**
 * Phase 8D — `<AdminShopPage>` smoke tests.
 *
 * Mocks the admin hooks so the SUT renders synchronously, then asserts
 * the page contract:
 *   * Title + 3 tabs visible.
 *   * Settings tab loads price inputs from API and saves with PATCH.
 *   * Banners tab opens drawer on «+ Добавить баннер».
 *   * Plans tab renders seeded rows + handles in-use 409 from delete.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ApiError } from '../../../shared/api';
import type {
  ApiAdminBanner,
  ApiAdminPlan,
  ApiAdminShopSettings,
} from '../api/shopAdminApi';

const mockSettings = vi.fn();
const mockBanners = vi.fn();
const mockPlans = vi.fn();
const mockUpdateSettings = vi.fn();
const mockCreateBanner = vi.fn();
const mockUpdateBanner = vi.fn();
const mockDeleteBanner = vi.fn();
const mockCreatePlan = vi.fn();
const mockUpdatePlan = vi.fn();
const mockDeletePlan = vi.fn();

vi.mock('../api/shopAdminApi', async () => {
  const actual = await vi.importActual<typeof import('../api/shopAdminApi')>(
    '../api/shopAdminApi',
  );
  return {
    ...actual,
    useAdminShopSettings: () => mockSettings(),
    useAdminBanners: () => mockBanners(),
    useAdminPlans: () => mockPlans(),
    useUpdateShopSettings: () => ({
      mutate: mockUpdateSettings,
      isPending: false,
      variables: undefined,
    }),
    useCreateBanner: () => ({
      mutate: mockCreateBanner,
      isPending: false,
      variables: undefined,
    }),
    useUpdateBanner: () => ({
      mutate: mockUpdateBanner,
      isPending: false,
      variables: undefined,
    }),
    useDeleteBanner: () => ({
      mutate: mockDeleteBanner,
      isPending: false,
      variables: undefined,
    }),
    useCreatePlan: () => ({
      mutate: mockCreatePlan,
      isPending: false,
      variables: undefined,
    }),
    useUpdatePlan: () => ({
      mutate: mockUpdatePlan,
      isPending: false,
      variables: undefined,
    }),
    useDeletePlan: () => ({
      mutate: mockDeletePlan,
      isPending: false,
      variables: undefined,
    }),
  };
});

vi.mock('../../../shared/ui/AdminFileUpload', () => ({
  AdminFileUpload: () => <div data-testid="admin-file-upload" />,
}));

import AdminShopPage from '../ui/AdminShopPage';

function makeSettings(over: Partial<ApiAdminShopSettings> = {}): ApiAdminShopSettings {
  return {
    id: 'singleton',
    design_overlay_price: 1200,
    installation_price: 0,
    min_order_amount: 0,
    recommendations_limit_per_source: 12,
    updated_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function makeBanner(over: Partial<ApiAdminBanner> = {}): ApiAdminBanner {
  return {
    id: 'b-1',
    title: 'Hero',
    subtitle: 'Subtitle',
    image_path: 'hero.jpg',
    cta_label: 'Купить',
    cta_url: '/catalog',
    position: 'homepage_hero',
    priority: 0,
    is_active: true,
    created_at: '2026-04-25T10:00:00Z',
    updated_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function makePlan(over: Partial<ApiAdminPlan> = {}): ApiAdminPlan {
  return {
    id: 'starter',
    name: 'Стартовый',
    price: 7000,
    period: 'мес',
    area_limit_m2: 15,
    popular: false,
    is_active: true,
    sort_order: 0,
    features: ['F1', 'F2'],
    created_at: '2026-04-25T10:00:00Z',
    updated_at: '2026-04-25T10:00:00Z',
    ...over,
  };
}

function setup({
  settings = makeSettings(),
  banners = [] as ApiAdminBanner[],
  plans = [] as ApiAdminPlan[],
}: {
  settings?: ApiAdminShopSettings | undefined;
  banners?: ApiAdminBanner[];
  plans?: ApiAdminPlan[];
} = {}) {
  mockSettings.mockReturnValue({
    data: settings, isFetching: false, error: null,
  });
  mockBanners.mockReturnValue({
    data: { items: banners }, isFetching: false, error: null,
  });
  mockPlans.mockReturnValue({
    data: { items: plans }, isFetching: false, error: null,
  });
}

function renderPage(initialUrl = '/admin/shop') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <AdminShopPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockSettings.mockReset();
  mockBanners.mockReset();
  mockPlans.mockReset();
  mockUpdateSettings.mockReset();
  mockCreateBanner.mockReset();
  mockUpdateBanner.mockReset();
  mockDeleteBanner.mockReset();
  mockCreatePlan.mockReset();
  mockUpdatePlan.mockReset();
  mockDeletePlan.mockReset();
});

describe('<AdminShopPage>', () => {
  it('renders the title and three tabs', () => {
    setup();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Магазин' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Настройки' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Баннеры' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Тарифы' })).toBeInTheDocument();
  });

  it('settings tab pre-fills price input from API data', async () => {
    setup({ settings: makeSettings({ design_overlay_price: 1888 }) });
    renderPage();
    await waitFor(() => {
      // The InputNumber renders the value as a string in the input
      // (formatted by AntD). 1888 stays plain.
      expect(screen.getByDisplayValue('1888')).toBeInTheDocument();
    });
  });

  it('settings tab saves with PATCH on click', async () => {
    setup({ settings: makeSettings() });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/i }));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });
  });

  it('switches to banners tab via ?tab=banners and shows row data', () => {
    setup({ banners: [makeBanner({ title: 'B1' })] });
    renderPage('/admin/shop?tab=banners');
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Добавить баннер/i }),
    ).toBeInTheDocument();
  });

  it('opens the create-banner drawer', () => {
    setup({ banners: [] });
    renderPage('/admin/shop?tab=banners');
    fireEvent.click(screen.getByRole('button', { name: /Добавить баннер/i }));
    expect(screen.getByText('Новый баннер')).toBeInTheDocument();
    expect(screen.getByLabelText('Заголовок')).toBeInTheDocument();
  });

  it('plans tab renders rows with admin actions', () => {
    setup({
      plans: [
        makePlan(),
        makePlan({ id: 'popular', name: 'Популярный', price: 12000 }),
      ],
    });
    renderPage('/admin/shop?tab=plans');
    expect(screen.getByText('Стартовый')).toBeInTheDocument();
    expect(screen.getByText('Популярный')).toBeInTheDocument();
  });

  it('plan delete confirms and fires useDeletePlan with row id', async () => {
    setup({ plans: [makePlan({ id: 'p-del' })] });
    renderPage('/admin/shop?tab=plans');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить тариф' }));
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
      expect(mockDeletePlan).toHaveBeenCalledTimes(1);
    });
    expect(mockDeletePlan.mock.calls[0][0]).toBe('p-del');
  });

  it('plan delete surfaces in-use 409 message', async () => {
    setup({ plans: [makePlan({ id: 'busy' })] });
    mockDeletePlan.mockImplementation((_id, opts) => {
      opts?.onError?.(
        new ApiError(409, 'In use', { code: 'subscription_plan_in_use' }),
      );
    });
    renderPage('/admin/shop?tab=plans');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить тариф' }));
    const popconfirmOk = await waitFor(() => {
      const candidates = screen.getAllByRole('button', { name: 'Удалить' });
      const inPopover = candidates.find((b) =>
        b.closest('.ant-popconfirm-buttons') !== null,
      );
      return inPopover!;
    });
    fireEvent.click(popconfirmOk);
    expect(
      await screen.findByText(/Нельзя удалить тариф/),
    ).toBeInTheDocument();
  });
});
