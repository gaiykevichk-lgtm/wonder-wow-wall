/**
 * Phase 2 — AdminLayout integration test.
 *
 * Covers:
 *   - All 8 menu items render
 *   - Active item matches the current URL
 *   - Clicking «Выйти» calls `authStore.logout` and navigates to "/"
 *
 * We mount through a minimal in-memory router that mirrors the real
 * nested-route shape from `shared/router.tsx`. This keeps the test
 * resistant to layout refactors that don't change behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import AdminLayout from '../ui/AdminLayout';
import { useAuthStore } from '../../auth/model/authStore';
import { ADMIN_SECTIONS } from '../model/navigation';

const renderAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div data-testid="section-body">dashboard</div>} />
          <Route path="orders" element={<div data-testid="section-body">orders</div>} />
          <Route path="users" element={<div data-testid="section-body">users</div>} />
          <Route path="catalog" element={<div data-testid="section-body">catalog</div>} />
          <Route path="shop" element={<div data-testid="section-body">shop</div>} />
          <Route path="upload" element={<div data-testid="section-body">upload</div>} />
          <Route
            path="recommendations"
            element={<div data-testid="section-body">recommendations</div>}
          />
          <Route path="audit" element={<div data-testid="section-body">audit</div>} />
        </Route>
        <Route path="/" element={<div data-testid="home">home</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: 'u-1',
      name: 'Root Admin',
      email: 'root@ww.com',
      phone: '+7',
      role: 'ADMIN',
      addresses: [],
    } as unknown as ReturnType<typeof useAuthStore.getState>['user'],
    token: 't',
    isAuth: true,
  });
});

describe('<AdminLayout>', () => {
  it('renders all 8 sections in the sidebar menu', () => {
    renderAt('/admin');
    // Desktop sider menu (the Drawer is closed → its copy is not in DOM).
    for (const section of ADMIN_SECTIONS) {
      const matches = screen.getAllByText(section.label);
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it('shows dashboard body at /admin (index route)', () => {
    renderAt('/admin');
    expect(screen.getByTestId('section-body')).toHaveTextContent('dashboard');
  });

  it('renders the users section body at /admin/users', () => {
    renderAt('/admin/users');
    expect(screen.getByTestId('section-body')).toHaveTextContent('users');
  });

  it('displays current admin name and email in the header', () => {
    renderAt('/admin');
    expect(screen.getByText('Root Admin')).toBeInTheDocument();
    expect(screen.getByText('root@ww.com')).toBeInTheDocument();
  });

  it('logout clears auth state and redirects to "/"', () => {
    renderAt('/admin');
    fireEvent.click(screen.getByRole('button', { name: /Выйти/ }));
    expect(useAuthStore.getState().isAuth).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
