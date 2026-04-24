/**
 * Admin navigation — single source of truth for sections, paths, labels.
 *
 * Kept in `model/` (not `ui/`) so future bits of admin infra (breadcrumbs,
 * audit-log filters) can enumerate sections without pulling in React/AntD.
 * Icons are defined next to the menu markup in `ui/AdminLayout.tsx`
 * (keyed by `AdminSectionKey`) — keeping JSX out of this module so any
 * non-UI consumer can import it without pulling `@ant-design/icons`.
 */

export type AdminSectionKey =
  | 'dashboard'
  | 'orders'
  | 'users'
  | 'catalog'
  | 'shop'
  | 'upload'
  | 'recommendations'
  | 'audit';

export interface AdminSection {
  key: AdminSectionKey;
  /** Route segment appended to `/admin`. Empty string for the index page. */
  path: string;
  label: string;
}

/** Order here determines order in the sidebar menu. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: 'dashboard', path: '', label: 'Дашборд' },
  { key: 'orders', path: 'orders', label: 'Заказы' },
  { key: 'users', path: 'users', label: 'Пользователи' },
  { key: 'catalog', path: 'catalog', label: 'Каталог' },
  { key: 'shop', path: 'shop', label: 'Магазин' },
  { key: 'upload', path: 'upload', label: 'Загрузка' },
  { key: 'recommendations', path: 'recommendations', label: 'Рекомендации' },
  { key: 'audit', path: 'audit', label: 'Аудит' },
] as const;

export const adminPath = (section: AdminSection): string =>
  section.path ? `/admin/${section.path}` : '/admin';
