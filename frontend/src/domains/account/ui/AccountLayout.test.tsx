import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../auth/model/authStore';
import AccountLayout from './AccountLayout';

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

function renderAccount() {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<div>Личный кабинет</div>} />
        </Route>
        <Route path="/admin/catalog" element={<CurrentPath />} />
        <Route path="/configurator" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  act(() => useAuthStore.getState().logout());
});

describe('ссылка в ЛК на админ-каталог', () => {
  it('видна только авторизованному admin@wow.ru с ролью ADMIN и ведёт на локальный маршрут', () => {
    act(() => useAuthStore.getState().setAuth({ id: '1', name: 'Admin', email: 'admin@wow.ru', phone: '', role: 'ADMIN' }, 'test-token'));
    renderAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть каталог админ-панели' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/catalog');
  });

  it.each([
    ['другой администратор', 'other@wow.ru', 'ADMIN'],
    ['обычный пользователь с тем же email', 'admin@wow.ru', 'CUSTOMER'],
  ] as const)('скрыта: %s', (_description, email, role) => {
    act(() => useAuthStore.getState().setAuth({ id: '2', name: 'User', email, phone: '', role }, 'test-token'));
    renderAccount();
    expect(screen.queryByRole('button', { name: 'Открыть каталог админ-панели' })).not.toBeInTheDocument();
  });

  it('скрыта без авторизации', () => {
    renderAccount();
    expect(screen.queryByRole('button', { name: 'Открыть каталог админ-панели' })).not.toBeInTheDocument();
  });
});

 describe('конфигуратор в личном кабинете', () => {
  it('заменяет старый пункт конструктора и открывает существующий конфигуратор', () => {
    renderAccount();
    expect(screen.queryByRole('menuitem', { name: 'Конструктор' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /Конфигуратор/ }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/configurator');
  });
});
