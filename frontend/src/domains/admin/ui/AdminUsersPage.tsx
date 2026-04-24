import { AdminSectionPlaceholder } from './AdminSectionPlaceholder';

export default function AdminUsersPage() {
  return (
    <AdminSectionPlaceholder
      phase="Фаза 5"
      title="Пользователи"
      description="Управление пользователями: поиск, роли (назначение/снятие admin), блокировка. Use cases GrantAdminRole / RevokeAdminRole."
    />
  );
}
