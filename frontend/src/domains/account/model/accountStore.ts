import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order, SavedProject, SavedProjectPanel } from './types';

interface AccountState {
  // Orders (mock)
  orders: Order[];

  // Saved constructor projects
  projects: SavedProject[];
  saveProject: (project: Omit<SavedProject, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateProject: (id: string, data: Partial<Pick<SavedProject, 'name' | 'wallCols' | 'wallRows' | 'wallColor' | 'panels' | 'totalPrice'>>) => void;
  deleteProject: (id: string) => void;

  // Favorites
  favoriteIds: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

let projectCounter = 0;

const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-1',
    number: 'WW-2026-001',
    date: '2026-03-15',
    status: 'in_progress',
    total: 18_400,
    address: 'Москва, ул. Пушкина, д. 10, кв. 5',
    items: [
      { id: '1', name: 'Тропический лес', image: '/images/design-1.jpg', size: '30×30 см', color: 'Зелёный', quantity: 6, price: 2_090 },
      { id: '2', name: 'Горный пейзаж', image: '/images/design-2.jpg', size: '60×60 см', color: 'Серый', quantity: 2, price: 3_690 },
    ],
  },
  {
    id: 'ord-2',
    number: 'WW-2026-002',
    date: '2026-03-01',
    status: 'installed',
    total: 12_600,
    address: 'Москва, Ленинский пр-т, д. 42',
    items: [
      { id: '3', name: 'Абстракция', image: '/images/design-3.jpg', size: '30×60 см', color: 'Белый', quantity: 4, price: 2_690 },
      { id: '4', name: 'Минимализм', image: '/images/design-4.jpg', size: '30×30 см', color: 'Чёрный', quantity: 2, price: 2_090 },
    ],
  },
];

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      orders: MOCK_ORDERS,
      projects: [],
      favoriteIds: [],

      saveProject: (project) => {
        const id = `proj-${++projectCounter}-${Date.now()}`;
        const now = new Date().toISOString();
        const saved: SavedProject = {
          ...project,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ projects: [saved, ...s.projects] }));
        return id;
      },

      updateProject: (id, data) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      },

      toggleFavorite: (productId) => {
        set((s) => {
          const has = s.favoriteIds.includes(productId);
          return {
            favoriteIds: has
              ? s.favoriteIds.filter((id) => id !== productId)
              : [...s.favoriteIds, productId],
          };
        });
      },

      isFavorite: (productId) => get().favoriteIds.includes(productId),
    }),
    { name: 'wow-wall-account' }
  )
);
