import { useAuthStore } from '../../auth/model/authStore';

const DARK = '#1a1a1a';
const GREEN = '#4CAF50';
const GRAY_TEXT = '#666';
const FONT = '"Inter", system-ui, -apple-system, sans-serif';

/**
 * Phase 1 placeholder. Replaced by the real `<AdminLayout>` + dashboard in
 * Phase 2. Kept deliberately minimal — the point of Phase 1 is to prove the
 * full guard chain (JWT `role` claim → `<RequireAdmin>` → `/api/admin/me`).
 */
export default function AdminPlaceholderPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        color: DARK,
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 14, color: GREEN, letterSpacing: 2, marginBottom: 12 }}>
          WONDER WOW WALL · ADMIN
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 16px' }}>
          Админ-панель — Фаза 1 OK
        </h1>
        <p style={{ fontSize: 16, color: GRAY_TEXT, lineHeight: 1.6, margin: 0 }}>
          Вход админа подтверждён. UI-каркас появится в Фазе 2.
        </p>
        {user && (
          <div
            style={{
              marginTop: 24,
              padding: '12px 16px',
              background: '#f6f7f8',
              borderRadius: 8,
              fontSize: 14,
              color: DARK,
            }}
          >
            Вы вошли как <strong>{user.name}</strong> ({user.email}) — роль {user.role}
          </div>
        )}
      </div>
    </div>
  );
}
