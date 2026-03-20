import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountStore } from './accountStore';

const reset = () =>
  useAccountStore.setState({
    projects: [],
    favoriteIds: [],
    // keep mock orders
  });

describe('accountStore', () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  describe('orders', () => {
    it('has pre-populated mock orders', () => {
      const orders = useAccountStore.getState().orders;
      expect(orders.length).toBeGreaterThanOrEqual(2);
      expect(orders[0].number).toBe('WW-2026-001');
    });

    it('mock orders have correct structure', () => {
      const order = useAccountStore.getState().orders[0];
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('number');
      expect(order).toHaveProperty('date');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('total');
      expect(order).toHaveProperty('items');
      expect(order.items.length).toBeGreaterThan(0);
    });
  });

  describe('projects', () => {
    it('starts with no projects', () => {
      expect(useAccountStore.getState().projects).toEqual([]);
    });

    it('saveProject creates a project and returns id', () => {
      const id = useAccountStore.getState().saveProject({
        name: 'Тестовый проект',
        wallCols: 5,
        wallRows: 3,
        wallColor: '#ffffff',
        panels: [],
        totalPrice: 12000,
      });

      expect(id).toMatch(/^proj-/);
      const projects = useAccountStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Тестовый проект');
      expect(projects[0].wallCols).toBe(5);
      expect(projects[0].totalPrice).toBe(12000);
      expect(projects[0].createdAt).toBeTruthy();
      expect(projects[0].updatedAt).toBeTruthy();
    });

    it('saveProject prepends (newest first)', () => {
      const store = useAccountStore.getState();
      store.saveProject({ name: 'Первый', wallCols: 3, wallRows: 2, wallColor: '#fff', panels: [], totalPrice: 1000 });
      store.saveProject({ name: 'Второй', wallCols: 4, wallRows: 3, wallColor: '#000', panels: [], totalPrice: 2000 });

      const projects = useAccountStore.getState().projects;
      expect(projects[0].name).toBe('Второй');
      expect(projects[1].name).toBe('Первый');
    });

    it('updateProject updates fields', () => {
      const id = useAccountStore.getState().saveProject({
        name: 'Old', wallCols: 3, wallRows: 2, wallColor: '#fff', panels: [], totalPrice: 500,
      });

      useAccountStore.getState().updateProject(id, { name: 'New Name', totalPrice: 9000 });

      const p = useAccountStore.getState().projects[0];
      expect(p.name).toBe('New Name');
      expect(p.totalPrice).toBe(9000);
      expect(p.wallCols).toBe(3); // unchanged
      expect(p.updatedAt).toBeTruthy(); // updatedAt is set
    });

    it('deleteProject removes by id', () => {
      const store = useAccountStore.getState();
      const id1 = store.saveProject({ name: 'A', wallCols: 3, wallRows: 2, wallColor: '#fff', panels: [], totalPrice: 100 });
      store.saveProject({ name: 'B', wallCols: 4, wallRows: 3, wallColor: '#000', panels: [], totalPrice: 200 });

      expect(useAccountStore.getState().projects).toHaveLength(2);

      useAccountStore.getState().deleteProject(id1);

      const projects = useAccountStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('B');
    });
  });

  describe('favorites', () => {
    it('starts with no favorites', () => {
      expect(useAccountStore.getState().favoriteIds).toEqual([]);
    });

    it('toggleFavorite adds product id', () => {
      useAccountStore.getState().toggleFavorite('prod-1');
      expect(useAccountStore.getState().favoriteIds).toContain('prod-1');
    });

    it('toggleFavorite removes if already present', () => {
      useAccountStore.getState().toggleFavorite('prod-1');
      useAccountStore.getState().toggleFavorite('prod-1');
      expect(useAccountStore.getState().favoriteIds).not.toContain('prod-1');
    });

    it('isFavorite returns correct status', () => {
      useAccountStore.getState().toggleFavorite('prod-1');
      expect(useAccountStore.getState().isFavorite('prod-1')).toBe(true);
      expect(useAccountStore.getState().isFavorite('prod-2')).toBe(false);
    });

    it('multiple favorites are tracked independently', () => {
      const store = useAccountStore.getState();
      store.toggleFavorite('prod-1');
      store.toggleFavorite('prod-2');
      store.toggleFavorite('prod-3');

      expect(useAccountStore.getState().favoriteIds).toHaveLength(3);

      useAccountStore.getState().toggleFavorite('prod-2');
      const ids = useAccountStore.getState().favoriteIds;
      expect(ids).toHaveLength(2);
      expect(ids).toContain('prod-1');
      expect(ids).not.toContain('prod-2');
      expect(ids).toContain('prod-3');
    });
  });
});
