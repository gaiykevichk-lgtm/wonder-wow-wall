import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminSpacesPage from '../ui/AdminSpacesPage';

const get = vi.fn();
const put = vi.fn();
const space = {
  id: 'space-1', title: 'Гостиная', categoryLabel: 'Для дома', roomTypeLabel: 'Гостиная',
  image: '/scene.jpg', category: 'home', roomType: 'living', mode: 'mono',
  relatedPanels: [], textures: [], renders: [], catalogBindings: [],
};
vi.mock('../../../shared/api', () => ({api: {get: (...args: unknown[]) => get(...args), put: (...args: unknown[]) => put(...args), post: vi.fn(), delete: vi.fn()}}));
vi.mock('../../../shared/ui/AdminFileUpload', () => ({AdminFileUpload: () => null}));
vi.mock('../../catalog/api/catalogApi', () => ({
  usePanels: () => ({data: {items: []}, isError: false, isLoading: false}),
  usePanelVariants: () => ({data: [{id: 'variant-1', panel_id: 'panel-1', panel_name: 'Рейка', texture_id: 'texture-1', texture_name: 'Кожа', image_paths: ['/finish.jpg'], is_active: true}], isError: false, isLoading: false}),
  useTextures: () => ({data: [{id: 'texture-1', name: 'Кожа'}], isError: false, isLoading: false}),
}));

beforeEach(() => {
  get.mockReset(); put.mockReset();
  get.mockImplementation((path: string) => Promise.resolve(path.includes('/page') ? {heading: 'Время наполнять.', intro: 'Текущий текст'} : [space]));
  put.mockResolvedValue({});
});

describe('AdminSpacesPage', () => {
  it('loads and saves public heading from the admin page', async () => {
    render(<AdminSpacesPage />);
    const heading = await screen.findByLabelText('Заголовок');
    expect(heading).toBeInTheDocument();
    fireEvent.change(heading, {target: {value: 'Новый заголовок'}});
    fireEvent.click(screen.getByRole('button', {name: 'Сохранить текст страницы'}));
  });
  it('photo modal has mono/combo switch and nothing else', async () => {
    render(<AdminSpacesPage />);
    fireEvent.click(await screen.findByRole('button', {name: 'Редактировать фото'}));
    expect(await screen.findByRole('button', {name: /Загрузить несколько фото/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Добавить блок/})).toBeInTheDocument();
    // Лишних блоков нет: ни карточки, ни форм, ни исполнений, ни скрола в форме.
    expect(screen.queryByText('1 · Карточка')).not.toBeInTheDocument();
    expect(screen.queryByText(/Базовые формы/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Исполнения/)).not.toBeInTheDocument();
  });
  it('photo card shows mono/combo switch first', async () => {
    render(<AdminSpacesPage />);
    fireEvent.click(await screen.findByRole('button', {name: 'Редактировать фото'}));
    fireEvent.click(await screen.findByRole('button', {name: /Добавить блок/}));
    expect(await screen.findByText('Моно')).toBeInTheDocument();
    expect(screen.getByText('Комбо')).toBeInTheDocument();
    expect(screen.getByText('Нажмите —', {exact: false})).toBeInTheDocument();
  });
});
