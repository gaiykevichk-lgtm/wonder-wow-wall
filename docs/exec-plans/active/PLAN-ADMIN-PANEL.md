# Plan: Админ-панель Wonder Wow Wall

> Пофазный план создания **внутренней админ-панели** для управления сервисом: статистика, заказы, профили пользователей, витрина (каталог), магазин (настройки/тарифы), загрузка панелей и их дизайнов.
> Bounded Context: новый `admin` (frontend) + расширения существующих доменов (backend) + новый домен `media` для файлов.
> Связано: [Frontend Conventions](../../../frontend/CONVENTIONS.md) | [Backend Conventions](../../../backend/CONVENTIONS.md) | [Architecture](../../../ARCHITECTURE.md) | [Plan Photo Editor](./PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO.md)
> **Создан: 24.04.2026**

---

## Контекст и проблема

На текущий момент в проекте **нет ни одного административного интерфейса**. Все данные либо seed-фикстуры (`backend/app/seed_data.py`), либо создаются клиентом (заказы, профили, проекты визуализатора). Управление контентом каталога/тарифов возможно только через прямую правку seed-файлов и redeploy.

**Что уже есть и нужно учесть:**

| Что есть | Файл | Замечание |
|---|---|---|
| `User` (Aggregate Root) | `backend/app/domain/user/entities.py` | **Нет поля `role`** — нет различия admin / customer |
| `Design`, `Category`, `Color`, `DesignReview` | `backend/app/domain/catalog/{entities,value_objects}.py` | `Design.image` — строка-URL (внешний Unsplash). Нет инфры загрузки файлов |
| `Order`, `OrderStatus`, `OrderItem`, `Address` | `backend/app/domain/order/{entities,value_objects}.py` | Переходы `confirm → start_work` есть, но нет `complete/cancel/refund` |
| Subscription домен | `backend/app/domain/subscription/` | Тарифы — статичные? Проверить в Фазе 0 |
| JWT auth, bcrypt | `backend/app/infrastructure/security/jwt.py` | Payload содержит только `sub=user_id`. **Роль в токене не зашита** |
| API роутеры | `backend/app/infrastructure/api/{auth,catalog,contacts,orders,projects,subscriptions,visualizer}.py` | Плоская структура. Префиксы — в `main.py` |
| Frontend домены (DDD) | `frontend/src/domains/{account,auth,catalog,constructor,content,order,subscription,visualizer}` | Нет `admin/`. Все страницы — для конечного пользователя |
| Тесты | `backend/tests/{api,application,domain}/` | Структура по слоям DDD |
| Хранилище файлов | — | **Не существует**. Нужно ввести (S3-совместимое или локальный volume через nginx) |

**Что НЕ работает / отсутствует:**

1. Нет роли пользователя (`role: 'customer' | 'admin'`) — нет авторизации админ-эндпоинтов.
2. Нет инфраструктуры загрузки и хранения изображений (превью дизайнов, фото панелей).
3. Нет API для CRUD дизайнов / категорий — `catalog.py` содержит только GET-эндпоинты.
4. Нет операций админа над заказами (изменение статуса, отмена, заметка).
5. Нет агрегирующих запросов для статистики (revenue, MAU, конверсия каталог→корзина→заказ).
6. Нет аудит-лога админ-действий — критично для разбора инцидентов.
7. Нет «магазинных» настроек как сущности (баннеры главной, промокоды, базовая цена панели — сейчас в `frontend/src/shared/config/constants.ts`, что нарушает SoC).
8. Нет понятия «панель как товар» — `Panel` существует только как `PanelSize` (см. `constants.ts`). Загрузка «новых панелей» (физических SKU) требует нового агрегата.

---

## Цель плана

Построить **внутреннюю админ-панель**, которая закрывает операционные нужды:

- Безопасный вход с разделением ролей (`admin` / `customer`).
- Дашборд с ключевыми метриками (revenue, заказы по статусам, новые юзеры, топ-дизайны).
- Управление заказами (просмотр, фильтр, смена статуса, заметка, отмена/возврат).
- Просмотр и модерация профилей пользователей (поиск, блокировка, история заказов).
- Управление витриной (каталог): CRUD дизайнов, категорий, цветов; модерация отзывов.
- Управление магазином: тарифы подписки, базовые цены панелей, промо-баннеры, контент главной.
- Загрузка новых панелей (SKU: размер, базовая цена, фото) и дизайнов (превью + варианты цветов).
- Аудит-лог критичных действий.

---

## Принципы плана

- **Инкрементально** — каждая фаза самодостаточна и даёт ценность; можно остановиться после любой.
- **Атомарность фаз** — фазы 4/6/7 разбиты на под-фазы (4A/4B, 6A/6B, 7A/7B) для независимых релизов.
- **Backend-first внутри фазы, но не глобально** — внутри фазы сначала domain → use cases → API → frontend → тесты. Между фазами — не «весь бэк, потом весь фронт».
- **Тесты в каждой фазе**, а не в конце. По слоям DDD: `tests/domain/`, `tests/application/`, `tests/api/` + `frontend/__tests__/` для логики store/lib.
- **Безопасность по умолчанию** — все админ-эндпоинты под guard `require_admin`, frontend route guard, audit-log на критичные операции (delete, role-change, refund, price-change).
- **Без ломки существующих API** — добавляем новые роутеры под `/api/admin/*`, существующие `/api/catalog`, `/api/orders` не трогаем (только расширяем DTO `*Response`, если нужно).
- **Конвенции** — frontend по [`frontend/CONVENTIONS.md`](../../../frontend/CONVENTIONS.md) (DDD, inline styles, селекторы Zustand, PascalCase/camelCase, Ant Design 6, Framer Motion). Backend по [`backend/CONVENTIONS.md`](../../../backend/CONVENTIONS.md) (Dependency Rule, `@dataclass` entities, `@dataclass(frozen=True)` VO, `execute()` use cases, ABC репозитории, Pydantic DTO с суффиксами `*Update/*Create/*Response`, тесты по `tests/domain|application|api/`, Alembic миграции с обязательным `downgrade()`).
- **UI/UX интеллект через скилл `ui-ux-pro-max`** — на каждой фазе, которая создаёт или меняет пользовательские UI-экраны админки (дашборд, таблицы заказов/юзеров, CRUD-формы каталога, загрузчик файлов, страница настроек магазина, модерация отзывов), Claude обязан вызвать скилл `ui-ux-pro-max` *перед* написанием компонента. Скилл содержит справочник стилей (50), палитр (21), шрифтовых пар (50), типов чартов (20) и stack-specific best-practices для React. Использовать его нужно для:
  - выбора палитры и типографической шкалы, согласующихся с существующим фронтендом на Ant Design 6 (не изобретать новые цветовые токены — сверяться с `frontend/src/shared/config/theme.ts` если он есть, иначе с actual-usage в `shared/ui/`);
  - выбора layout-паттерна для дашборда (bento grid / card grid / split layout) и типа чартов для статистики (Фаза 3);
  - проверки accessibility-чеклиста (ARIA-роли, контраст, клавиатурная навигация, focus-ring) — критично, так как админка используется операторами ежедневно;
  - рекомендаций по hover/focus/pressed-состояниям, skeleton-loaders, empty-states и error-states.
  - Вызов: `Skill tool → ui-ux-pro-max` с описанием экрана (например, «dashboard with revenue, orders-by-status chart, recent orders table») перед тем, как начать кодинг фазы. Результат фиксировать в чек-листе фазы как «UX-ревью выполнено: [ссылки/ID рекомендаций]».
- **Новый домен `admin` на фронте** — изолированный bounded context. Кросс-доменные импорты только типов из `catalog/order/user/subscription`. UI-импорты — только в `shared/ui/` либо внутри admin.
- **Аудит-лог как поперечная capability** — отдельный домен `audit` (backend), не «прокидываем» через каждый use case вручную; используем декоратор/middleware на admin-роутерах.
- **Хранилище файлов** — абстракция `FileStorage` (ABC) в `infrastructure/storage/`, реализация: локальный volume через nginx (MVP), S3-совместимый адаптер позже. **Не лочимся на конкретного провайдера в use case-ах.**

---

## Фаза 0: Аудит и подготовка ✅ ВЫПОЛНЕНО (2026-04-24)

> **Цель:** Зафиксировать текущее состояние и закрыть открытые вопросы. Не пишем код.
> **Результат:** [docs/design-docs/ADMIN-PANEL-AUDIT.md](../../design-docs/ADMIN-PANEL-AUDIT.md)

### Чек-лист аудита
- [x] Прочитать `backend/app/domain/subscription/{entities,value_objects}.py` — тарифы **хардкод** (`SUBSCRIPTION_PLANS` module-level). Фаза 8 получает миграцию+seed.
- [x] Прочитать `backend/app/seed_data.py` и `backend/app/container.py` — **in-memory И Sql репо уже реализованы**, флаг `USE_MEMORY_REPOS`. Фаза 1 не удлиняется.
- [x] Проверить наличие Alembic — **присутствует**, `alembic.ini` + `alembic/env.py` + 5 миграций (001–005).
- [x] Прочитать `frontend/src/shared/router.tsx` — все роуты внутри `<ShopLayout>`, есть `<RequireAuth>`. **Уточнение Фазы 2:** `/admin/*` — вне `<ShopLayout>`.
- [x] Прочитать `frontend/src/domains/auth/` — Zustand + `persist` (ключ `wow-wall-auth`). Нет `role`. **Новый риск R10:** нужна миграция persist-слайса.
- [x] Прочитать `nginx/nginx.conf` — нет `/uploads/`; `client_max_body_size 10M` **ниже** лимита Фазы 6 (20M).
- [x] Проверить агрегирующие API — **нет**. Фаза 3 строит с нуля.
- [x] Зафиксировать первого админа — **CLI** `python -m app.cli grant_admin <email>`; модуль `app/cli.py` не существует, создаётся в Фазе 1.

**Ключевые решения аудита:**
- **OQ9 закрыт:** вводим sync event-bus в Фазе 7A (cost +0.3 дня vs +0.5 дня рефактора в 10).
- **R10 (новый):** версионирование `persist`-слайса authStore в Фазе 1.
- Трудозатраты — не изменились (47.5 дней).

> Аудит выполнен, Фаза 1 разблокирована.

---

## Фаза 1: Роль admin + guard + первый админ ✅ ВЫПОЛНЕНО (2026-04-24)

> **Цель:** В `User` появляется `role`; есть guard для эндпоинтов и frontend-route; первый админ создан через CLI.
> **Self-contained релиз** — без UI админки, проверяется через 401/403 и `/api/admin/me`.

### Backend
- [x] Domain: добавить `UserRole` в `domain/user/value_objects.py` как `Enum` (`CUSTOMER`, `ADMIN`). Добавить поле `role: UserRole = UserRole.CUSTOMER` в `User` entity.
- [x] Domain: метод `User.promote_to_admin()` / `User.demote_to_customer()` (раннее блокирование демоутинга последнего админа — решается на уровне use case).
- [x] Domain: исключение `LastAdminRemovalError(DomainException)`.
- [x] Application: use case `GrantAdminRole.execute(actor_id, target_user_id)` и `RevokeAdminRole.execute(actor_id, target_user_id)`. `actor_id` нужен для аудита.
- [x] Application: use case `RequireAdmin.execute(user_id)` — кидает `NotAuthorizedError` если не админ.
- [x] Infrastructure: миграция Alembic `006_add_role_to_users` с `downgrade()` (default `CUSTOMER` для всех существующих).
- [x] Infrastructure: обновить `UserModel` (ORM) — колонка `role VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER'`.
- [x] Infrastructure: обновить `jwt.create_access_token` — добавить claim `role` в payload. Обновить `decode_access_token` → возвращает `(user_id, role)` с legacy-фолбэком на `CUSTOMER` для токенов без claim (R1).
- [x] Infrastructure: dependency `get_current_admin_id` (parallel к `get_current_user_id`) в `app/utils/dependencies.py` — возвращает 401 без токена, 403 если не admin.
- [x] Infrastructure: CLI-команда `app/cli.py` с подкомандой `grant_admin <email>` / `revoke_admin <email>` (использует `GrantAdminRole.execute('SYSTEM', user.id)`).
- [x] Infrastructure: новый роутер `infrastructure/api/admin/__init__.py` + `admin/auth.py` с эндпоинтом `GET /api/admin/me` под guard.

### Frontend
- [x] Расширить `domains/auth/model/types.ts` — `UserRole`, поле `role` в типе `User`.
- [x] Обновить `domains/auth/model/authStore.ts` — хранить `role`, селектор `useIsAdmin`, persist `version: 1` + `migrate` для бэкфила legacy-сессий (R10).
- [x] `domains/admin/ui/RequireAdmin.tsx` — компонент-guard, редирект на `/login?redirect=...` при отсутствии роли.
- [x] Заглушка-страница `domains/admin/ui/AdminPlaceholderPage.tsx` (просто «Админ-панель — Фаза 1 OK»).
- [x] Lazy-route `/admin` → `AdminPlaceholderPage` под `<RequireAdmin>` (вне `<ShopLayout>`).

### Тесты
- [x] `tests/domain/test_user_role.py` — переходы ролей + идемпотентность.
- [x] `tests/application/test_role_management.py` — happy path, last-admin protection, SYSTEM bootstrap, NotAuthorized.
- [x] `tests/api/test_admin_auth.py` — 401 без токена, 401 malformed, 403 с customer-токеном, 200 с admin-токеном, stale-token после promotion.
- [x] `tests/infrastructure/test_alembic.py` — новая проверка `test_phase1_role_column_added_by_006`.
- [x] `frontend/src/domains/auth/model/authStore.role.test.ts` — login/register default, setAuth с ADMIN/CUSTOMER, `useIsAdmin` селектор, persist migrate для v0→v1.
- [ ] Manual: `docker-compose run --rm backend python -m app.cli grant_admin admin@local` → залогиниться с фронта → редирект на `/admin` без 403. *(Проверяется вручную после деплоя.)*

### Definition of Done
- [x] Миграция применяется и откатывается без ошибок.
- [x] Существующие unit/integration-тесты не падают (266 backend + 18 frontend auth).
- [x] В `/api/admin/me` возвращается profile + `role: 'ADMIN'`.
- [x] Customer не может зайти на `/admin` — видит редирект.

> Фаза 1 завершена — базовый admin-guard работает end-to-end (JWT claim → `get_current_admin_id` → `<RequireAdmin>` → `/api/admin/me`). Фаза 2 разблокирована.

### Аудит по итогам реализации (2026-04-24)

Проверено построчно: 27 файлов в коммите `2b34f78`. 27 backend + 9 frontend тестов зелёные. Typecheck чист.

**Долги, требующие фикса до Фазы 5 — ЗАКРЫТЫ (2026-04-24, follow-up commit):**
- [x] `backend/app/infrastructure/api/error_handlers.py` — добавлены `last_admin_removal_handler` (→ 409 `{code: "last_admin"}`) и `not_authorized_handler` (→ 403 `{code: "not_authorized"}`); зарегистрированы в `app/main.py`. Docstring `domain/user/exceptions.py` теперь не врёт. Покрыто `tests/api/test_error_handlers_admin.py` (3 теста: shape каждого handler-а + проверка регистрации в `app.exception_handlers`).
- [x] `backend/app/infrastructure/persistence/repositories/sql.py` — `count_admins()` сравнивает с `UserRole.ADMIN.value` (импорт поднят на top-level модуля, inline-import в `_user_to_domain` убран). `memory.py` — аналогично, `UserRole.ADMIN` на top-level.

**Некритический тех-долг Фазы 1:**
- [x] `backend/app/cli.py` — `sys.exit(2)` больше не вызывается внутри `async with async_session()`. Вместо этого `_grant_admin`/`_revoke_admin` поднимают CLI-локальный `_UserNotFound`, который проходит через `except Exception` блок `_with_repo` (rollback на пустой read-only txn), а затем перехватывается снаружи — там вызывается `sys.exit(2)` как и раньше. Поведение для пользователя не изменилось, но транзакция закрывается корректно.
- [ ] Alembic-тесты (`tests/infrastructure/test_alembic.py`) падают только при запуске всего pytest-пакета (5 тестов); при изолированном запуске все 6 зелёные. **Pre-existing** (повторялось и до Фазы 1): `monkeypatch.setattr(settings, "DATABASE_URL", ...)` не выдерживает test-order, когда какой-то предыдущий тест уже создал async-engine к Postgres. Issue для Фазы 5 DX.

**Отсутствие регрессий подтверждено:**
- 269 backend тестов (кроме alembic, +3 новых на handlers) + 18 frontend тестов auth/admin домена — всё зелёно. Alembic при изолированном запуске — 6/6.
- Существующие публичные эндпоинты `/api/auth/*` отдают `role` в `UserResponse` (auth.py:29-32), фронт опционально принимает — нет ломающих изменений в API-схеме.
- `create_access_token(user_id)` сохраняет старую арность благодаря `role: str = "CUSTOMER"` default (jwt.py:23).
- `decode_access_token` для legacy-токенов без claim `role` возвращает `(user_id, "CUSTOMER")` — старые сессии не сыпятся (jwt.py:50, R1).
- Persist-миграция authStore v0→v1 бэкфилит `role: 'CUSTOMER'` для legacy-blob-ов в localStorage — покрыто тестом `authStore.role.test.ts` (R10).
- Миграция 006 round-trip `upgrade → downgrade → upgrade` зелёная на SQLite — подтверждено новым тестом `test_phase1_role_column_added_by_006`.

**Что проверено в каждом файле:**
- `domain/user/entities.py` — `role` поле, `promote_to_admin`/`demote_to_customer` идемпотентны, `is_admin` property. Dependency Rule не нарушен: entity не видит репозиторий.
- `domain/user/value_objects.py` — `UserRole(str, Enum)` с `CUSTOMER`/`ADMIN`. Строковый enum позволяет SQL хранить значение без конвертации.
- `domain/user/exceptions.py` — `LastAdminRemovalError`, `NotAuthorizedError` от `Exception` (соответствует `CONVENTIONS.md`). Docstring актуален: handlers зарегистрированы.
- `domain/user/repositories.py` — `count_admins()` как абстрактный метод обоих реализаций.
- `application/user/use_cases.py` — `_ensure_actor_is_admin` с `SYSTEM` bypass для bootstrap; `RevokeAdminRole` делает `count_admins() <= 1` до `demote_to_customer()`; `GrantAdminRole` идемпотентен; `Register`/`Login` пробрасывают `user.role.value` в JWT.
- `infrastructure/persistence/models.py` — `role` с `nullable=False, default="CUSTOMER", server_default="CUSTOMER"` (паттерн для миграции `NOT NULL` колонки на существующих строках).
- `infrastructure/persistence/repositories/sql.py` — `_user_to_domain` с `try/except ValueError` fallback на `CUSTOMER`; `update()` синхронизирует `role`; `count_admins()` делает `SELECT COUNT(*)` с условием `UserModel.role == UserRole.ADMIN.value` (enum-safe).
- `infrastructure/persistence/repositories/memory.py` — `count_admins()` через генератор `sum(...)` с сравнением по `UserRole.ADMIN`.
- `infrastructure/security/jwt.py` — `create_access_token(user_id, role="CUSTOMER")` default; `decode_access_token` возвращает tuple, legacy fallback на `CUSTOMER`.
- `infrastructure/api/auth.py` — `UserResponse` расширен `role: str`; все три endpoint (`register`, `login`, `me`, `update_profile`) отдают `user.role.value`.
- `infrastructure/api/admin/__init__.py` — aggregator router с `include_router(_auth.router, prefix="", tags=["admin"])`. Готово для будущих саб-роутеров Фазы 2+.
- `infrastructure/api/admin/auth.py` — `GET /me` под `get_current_admin_id`; 401 на удалённого-после-выдачи-токена юзера (stale token).
- `utils/dependencies.py` — `get_current_admin_id` двух-шаговый: 401 → 403. Защита на уровне маршрута. `RequireAdmin` use case — defense-in-depth для внутренних операций.
- `main.py` — `admin_api.router` под `/api/admin`.
- `cli.py` — `grant_admin` / `revoke_admin` через `SYSTEM` actor; общий `_with_repo` обработчик SQL-сессии с commit/rollback. `_UserNotFound` sentinel вместо `sys.exit` внутри транзакции (см. audit fix выше).
- `infrastructure/api/error_handlers.py` — два новых handler-а (`last_admin`/`not_authorized`), следуют той же схеме `{detail, code}`, что и visualizer-контекст.
- `alembic/versions/006_add_role_to_users.py` — `server_default="CUSTOMER"` (R5 default-pattern); `downgrade()` через `op.drop_column`.
- Frontend `authStore.ts` — persist `version: 1` + `migrate` callback для R10; `useIsAdmin` селектор отдельный от `user` (меньше re-render).
- Frontend `RequireAdmin.tsx` — soft-redirect на `/login?redirect=...` (не-auth) и `/` (customer), без 404 (не палим existence роута).
- Frontend `router.tsx` — `/admin` route **вне `<ShopLayout>`**, корректно под `<RequireAdmin>`.

---

## Фаза 2: Базовый layout админки + навигация ✅ ВЫПОЛНЕНО (2026-04-24)

> **Цель:** Каркас `/admin` с боковым меню и пустыми страницами-разделами. Каждый раздел — отдельный route. Это «UI shell» для всех последующих фаз.

### Backend
- (нет изменений)

### Frontend
- [x] `domains/admin/ui/AdminLayout.tsx` — `<Layout>` с `<Sider>` (Ant Design), боковое меню разделов: Дашборд / Заказы / Пользователи / Каталог / Магазин / Загрузка / Рекомендации / Аудит.
- [x] Цветовые константы Design System в файле компонента (DARK / GREEN / GRAY_TEXT / FONT) — по [`frontend/CONVENTIONS.md`](../../../frontend/CONVENTIONS.md).
- [x] Заглушки страниц: `AdminDashboardPage`, `AdminOrdersPage`, `AdminUsersPage`, `AdminCatalogPage`, `AdminShopPage`, `AdminUploadPage`, `AdminRecommendationsPage`, `AdminAuditPage` — каждая в `domains/admin/ui/` (используют общий `AdminSectionPlaceholder`).
- [x] Все маршруты `/admin/*` через `<RequireAdmin>` (общий wrapper в `router.tsx`).
- [x] Hook `useAdminNavigation()` — только активный раздел; без бизнес-логики. Longest-prefix-wins резолвер, чтобы `/admin/users/abc` подсвечивал «users», а не «dashboard».
- [x] Навигационные константы вынесены в `domains/admin/model/navigation.ts` (single source of truth, без JSX).
- [x] Mobile: при `max-width: 768px` сайдбар сворачивается в `<Drawer>` (по конвенциям — через `<style>` блок media query).
- [x] Топ-бар: имя текущего админа, кнопка «Выйти» (вызов `authStore.logout`).

### Тесты
- [x] `frontend/src/domains/admin/__tests__/AdminLayout.test.tsx` — рендер меню (8 секций), index-роут, nested-роут, header-имя+email, logout → `/`.
- [x] `frontend/src/domains/admin/__tests__/useAdminNavigation.test.tsx` — дефолт на `/admin`, резолв по первому сегменту, longest-prefix-wins для nested-роутов, порядок секций.
- [x] Все тесты `src/domains/admin` зелёные (15/15 после follow-up); `tsc` на admin-файлах чист (глобальные ошибки — pre-existing в visualizer/account/catalog, не регрессия Фазы 2).
- [ ] Manual: пройти по всем 8 разделам, проверить URL и активный пункт меню.

### Definition of Done
- Все 8 разделов открываются, маршрут отражается в URL.
- На мобильном сайдбар работает как drawer.
- Customer на любую `/admin/*` страницу → редирект на `/login`.

> Фаза 2 завершена — UI shell админки готов. Все последующие фазы (3–10) наполняют отдельные секции. Фаза 3 разблокирована.

### Аудит по итогам реализации (2026-04-24)

Проверено построчно: 13 файлов Фазы 2 (10 в `frontend/src/domains/admin/`, 2 теста, router.tsx). `vitest run src/domains/admin` — 9/9 зелёных. `tsc --noEmit -p tsconfig.app.json` — ошибок в admin-файлах нет (другие домены: pre-existing, не регрессия Фазы 2).

**Критические проблемы:** не найдено. Все 8 разделов корректно зарегистрированы в роутере под `<RequireAdmin>`, layout рендерит sidebar+header, logout работает, мобильный drawer открывается по media query.

**Некритический тех-долг Фазы 2 — ЗАКРЫТ (2026-04-24, follow-up commit):**
- [x] `frontend/src/domains/admin/model/navigation.ts` — docstring приведён в соответствие с реальностью: иконки описаны как inline в `AdminLayout.tsx`, ссылка на несуществующий `ui/adminNavigationIcons.tsx` удалена.
- [x] Phase-лейблы на заглушках синхронизированы с актуальной нумерацией плана:
  - `AdminCatalogPage` → «Фаза 7A», `AdminUploadPage` → «Фаза 7B»,
    `AdminShopPage` → «Фаза 8», `AdminRecommendationsPage` → «Фаза 10»,
    `AdminOrdersPage` → «Фазы 4A + 4B» (уточнено).
- [x] `useAdminNavigation.ts` — резолвер переписан: кандидаты сортируются по длине `path` убыванием (настоящий longest-prefix-wins), матч требует точного равенства или наличия `/` после базы — `/admin/ordersfoo` больше не подсвечивает `orders`. Чистая функция `resolveActiveSection(pathname)` вынесена отдельно для покрытия и будущих breadcrumbs.
- [x] Добавлены регрессионные тесты: `requires a segment boundary`, exact/nested match, longest-path priority, unknown path fallback, root `/admin`. `src/domains/admin` — 15/15 зелёных (было 9/9).
- [x] План (строка 206) — формулировка уточнена: «tsc admin-файлов чист; глобальные ошибки pre-existing в visualizer/account/catalog — не регрессия Фазы 2».
- [ ] Manual-чек «пройти по всем 8 разделам» — остаётся за пользователем, автотесты покрывают рендер и резолвер.

**Отсутствие регрессий подтверждено:**
- Auth-домен: `authStore` контракт (`user`, `isAuth`, `logout`, `role`) не менялся, Phase 1 тесты (`authStore.role.test.ts`, `RequireAdmin.test.tsx`) зелёные.
- Router: `/admin` по-прежнему вне `<ShopLayout>` и под `<RequireAdmin>` (router.tsx:115-131). Customer и анонимный — редирект по логике Phase 1.
- Phase 1 placeholder `AdminPlaceholderPage` удалён без остаточных импортов (`grep AdminPlaceholder` — 0 совпадений).
- Роутинговая структура nested-route с `<Outlet>` — `AdminLayout` корректно рендерит дочернюю страницу в `<Content>` (AdminLayout.tsx:179-181). Тест `section-body` на `/admin`, `/admin/users` это подтверждает.

**Что проверено в каждом файле:**
- `domains/admin/model/navigation.ts` — `AdminSectionKey` union из 8 ключей, `ADMIN_SECTIONS` readonly + `as const`, `adminPath()` обрабатывает индекс-секцию (`path: ''` → `/admin`). Чистый модуль без JSX — соответствует заявленной границе model/.
- `domains/admin/model/useAdminNavigation.ts` — чистый селектор над `useLocation`, возвращает `activeKey/activeSection/sections`; внутри вызывает `resolveActiveSection(pathname)` (экспортируется отдельно для тестов и breadcrumbs). Настоящий longest-prefix-wins + проверка границы сегмента. Реэкспорт `adminPath` как удобство для импортёров хука.
- `domains/admin/ui/AdminLayout.tsx` — `<Sider>` (desktop) + `<Drawer>` (mobile ≤768px через CSS media query в `<style>`-блоке, как требуют `CONVENTIONS.md:109-118`). `<Menu>` с `selectedKeys={[activeKey]}`, `onClick` → `navigate(adminPath(target))`. Header: аватар+имя+email из `useAuthStore`, кнопка «Выйти» → `logout()` + `navigate('/')`. Color-constants `DARK/GREEN/GRAY_TEXT/FONT` объявлены в файле — по конвенции `CONVENTIONS.md:101-107`. ARIA-labels на mobile-menu и logout кнопках.
- `domains/admin/ui/AdminSectionPlaceholder.tsx` — единая «карточка-заглушка» для всех 8 разделов. Принимает `{title, phase, description}`. Стили inline (конвенция), цветовые константы дублируются локально (тоже конвенция — «в каждом файле страницы»).
- 8 страниц-заглушек (`AdminDashboardPage`/`AdminOrdersPage`/`AdminUsersPage`/`AdminCatalogPage`/`AdminShopPage`/`AdminUploadPage`/`AdminRecommendationsPage`/`AdminAuditPage`) — все используют `AdminSectionPlaceholder`, default export (требуется для `React.lazy` в router.tsx). См. расхождение phase-лейблов в тех-долге.
- `domains/admin/ui/RequireAdmin.tsx` — не менялся в Фазе 2 (наследие Фазы 1), но пере-проверен: корректно используется в router.tsx:117-120 как wrapper вокруг `<AdminLayout>`, nested-роуты наследуют защиту.
- `shared/router.tsx` — 9 lazy-импортов админки (layout + 8 страниц), `/admin` route-tree с `index` + 7 named sub-routes, все внутри `<RequireAdmin><AdminLayout/>`. Вне `<ShopLayout>` — корректно, у админки свой shell.
- `__tests__/AdminLayout.test.tsx` — 5 тестов: рендер 8 секций, index-роут показывает dashboard-body, nested `/admin/users` показывает users-body, header содержит имя+email админа, logout очищает store + редирект на `/`. `beforeEach` сетит ADMIN-пользователя в store напрямую через `setState` — корректный паттерн для Zustand-тестов.
- `__tests__/useAdminNavigation.test.tsx` — 10 тестов (после follow-up): hook-level 4 теста + resolver-level 6 тестов (segment boundary на `/admin/ordersfoo`, exact-match, nested, longest-path, unknown→dashboard, root `/admin`).

---

## Фаза 3: Дашборд статистики ✅ РЕАЛИЗОВАНО (2026-04-24, follow-up audit 2026-04-25)

> **Цель:** Главный экран `/admin` с ключевыми метриками. **Только агрегаты — без drill-down.**

### Backend
- [x] Domain: новый bounded context `analytics` (read-only). VO `DateRange`, `Metric`, `MetricSeries`. Без entities — domain-сервис над репозиториями других доменов. Добавлены также `SeriesPoint`, `StatusBucket`, `TopDesign`, исключение `InvalidDateRangeError`.
- [x] Domain: интерфейс `AnalyticsRepository` (ABC) — методы `revenue_by_day(range)`, `orders_by_status(range)`, `new_users_by_day(range)`, `top_designs(limit)`. ⚠️ **Отклонение:** вместо `conversion_funnel(range)` реализован `totals(range)` → `dict[str, int]` (revenue / orders / new_users / avg_order_value). Funnel отложен — для MVP-дашборда нужны именно скалярные тоталы на карточки.
- [x] Application: use case `GetDashboardSnapshot.execute(range: DateRange) -> DashboardDTO`. `DashboardDTO` также несёт `range_start`/`range_end` как ISO-строки (⚠️ протекание HTTP-формата в application-DTO — tech-debt).
- [x] Infrastructure: `SqlAnalyticsRepository` — `func.date(...) GROUP BY`, одна query на проекцию, без N+1. ⚠️ **Отклонение:** обычная `AsyncSession` из DI, readonly-сессия не реализована. Для MVP приемлемо (TTL-кеш 60с гасит нагрузку), но пометить tech-debt.
- [x] Infrastructure: эндпоинт `GET /api/admin/analytics/dashboard?days=7|30|90` под `get_current_admin_id`. ⚠️ Контракт изменён — вместо `?from=&to=` принимает enum `days` (обоснованно: ограничение fan-out кеша + валидация на уровне Pydantic).
- [x] Кеширование: `app/utils/cache.py` (`@cached(ttl_seconds=60.0, skip_self=True)`). TTL 60с, ключ `(days,)` (repo стрипается через `skip_self`). `clear_cache()` экспонируется для тестов.

### Frontend
- [x] `domains/admin/model/dashboardStore.ts` — Zustand только с `range`/`setRange`. ⚠️ **Отклонение от плана:** `snapshot`/`loading` НЕ в сторе — их владеет TanStack Query. Это корректнее, нет двойного источника правды. Плюс экспортирован `DASHBOARD_RANGE_OPTIONS`.
- [x] `domains/admin/api/analyticsApi.ts` — хук `useDashboardSnapshot(days)` с TanStack Query (`staleTime: 30s`, `retry: false`). Вместо голой функции `fetchDashboard` — hook-wrapper, соответствует фронт-конвенциям (react-query keys: `analyticsKeys.dashboard`).
- [x] `domains/admin/ui/AdminDashboardPage.tsx` — 4 метрики + LineChart (выручка) + PieChart (статусы) + List (топ дизайнов). Зависимость `recharts@^3.8.1` добавлена в `frontend/package.json`.
- [x] Селектор периода: AntD `Segmented` 7/30/90.
- [x] Скелетоны: `Skeleton`, `Skeleton.Input`, `Skeleton.Avatar`.
- [x] Анимация: `fadeUpVariants` + `staggerChildren` (Framer Motion) — унифицирован с HomePage / AccountLayout.
- [x] Дополнительно: полифилл `window.matchMedia` в `frontend/src/test/setup.ts` — jsdom его не реализует, ломал AntD Segmented/Layout в тестах.

### Тесты
- [x] `tests/domain/analytics/test_date_range.py` — инварианты DateRange + `last_n_days` (9 кейсов).
- [x] `tests/application/analytics/test_get_dashboard_snapshot.py` — happy path, пустые данные, фильтрация по статусу, по диапазону, enum-порядок статусов, топ-дизайны по quantity, бакетирование по дням (8 кейсов).
- [x] `tests/api/admin/test_dashboard.py` — 401 без токена, 403 для customer, 422 для days=500/0/"abc", 200 admin с полным payload, default days=30 (6 кейсов). autouse-фикстура `_reset_cache` сбрасывает TTL-кеш между кейсами.
- [x] `frontend/src/domains/admin/__tests__/dashboardStore.test.ts` — 4 кейса: дефолт, setRange, subscribers, опции.
- [ ] ❌ **НЕ СДЕЛАНО:** `tests/api/admin/test_dashboard_perf.py` — перф-тест 30 дней / 10k заказов / <500мс. Оставить как tech-debt.

### Definition of Done
- [x] На пустой БД дашборд показывает нули, не падает (подтверждено `test_empty_data_returns_zero_metrics_and_full_zero_series`).
- [x] Смена периода обновляет данные (`range` входит в `queryKey`, React Query рефетчит автоматически).
- [x] В DevTools Network — 1 запрос на снимок (агрегаты на бэке).

### Аудит 2026-04-24 — замечания

**Критические:** нет.

**Некритические (tech-debt):**
1. **`conversion_funnel` не реализован** — заменён на `totals`. Либо добавить funnel в Фазе 3.x, либо обновить контракт в REQUIREMENTS. — *оставлено в backlog*
2. **Перф-тест отсутствует** — `test_dashboard_perf.py` не создан. Перенести в бэклог tech-debt. — *backlog (нужен seed-генератор; объединить с Phase 4A)*
3. **`DashboardDTO.range_start/range_end: str`** (`use_cases.py:23-24`) — HTTP-формат в application-слое. Заменить на `date` + форматирование в API-схеме. — *оставлено в backlog (минорно, низкий ROI)*
4. **`_mem_analytics_repo` читает приватные `_orders`/`_users`** (`container.py:46-47`) — инкапсуляция нарушена. Добавить публичные `orders()`/`users()` на in-memory репо. — *оставлено в backlog: расширение публичного интерфейса репо ради единственного клиента (YAGNI)*
5. ✅ **`_order_total` дублирует `Order.total`** (`analytics_repo.py:55`) — *закрыто 2026-04-25:* helper удалён, в `revenue_by_day` и `totals` используется `o.total` напрямую.
6. **Readonly-сессия не реализована** — `SqlAnalyticsRepository` берёт обычную `AsyncSession`. — *backlog: refactor `get_readonly_session` имеет смысл, когда появится >1 read-only клиента*
7. ✅ **`test_admin_gets_full_payload` сидирует общий `_mem_order_repo`** без отката — *закрыто 2026-04-25:* autouse-фикстура переименована в `_reset_cache_and_repos`, очищает `_mem_order_repo._orders` и `_counter` до и после каждого теста. Assertion ужесточён: `orders["value"] == 1` (раньше `>= 1`).
8. **`top_designs` SQL: `func.max(design_name)`** (`analytics_repo.py:226`) — недетерминированный выбор имени при rename. — *оставлено в backlog (минорно)*
9. **`datetime.utcnow()`** в `DateRange.last_n_days` (`value_objects.py:73`) — deprecation warning на Python 3.12+. — *общая проблема проекта, не Phase 3*
10. **Нет UI-теста** на `AdminDashboardPage.tsx` — *оставлено в backlog (store покрыт, добавить при первой регрессии)*
11. **Cache key `(days,)` агрегирует все SQL-сессии в один бакет** — сегодня безвредно. — *оставлено в backlog (поведение задокументировано в `cache.py:32-43` через `skip_self`)*

### Аудит 2026-04-25 — follow-up

Повторно прочитан построчно: все 16 файлов Фазы 3 + контейнер + admin/__init__. Запущены 21/21 Phase 3 тестов и полный backend-suite 290/290 (исключая 6 alembic — pre-existing).

**Критические:** не найдено.

**Дополнительно найдено и закрыто 2026-04-25:**
- ✅ **`value_objects.py:35` — устаревший docstring `DateRange`**: пример `DateRange(today - 7d, today)` противоречил пост-fix реализации `last_n_days`. Заменён на `DateRange.last_n_days(7)` → `[today - 6d, today + 1d)` с пояснением, почему сегодняшние события попадают в окно.
- ✅ **`AdminDashboardPage.tsx` — STATUS_LABELS["placed"]** был "Размещён" вместо канонического "Оформлен" из `OrderStatus.label_ru` (бэкенд `app/domain/order/value_objects.py:15`). Синхронизировано + добавлен комментарий о Phase 4 как точке централизации общего dictionary.
- ✅ **Tech-debt #5 (дублирование `_order_total`)** и **#7 (хрупкость seed-теста)** — закрыты в этой же ревизии (см. список выше).

**Что было разобрано в каждом файле:**
- `app/domain/analytics/value_objects.py` — VOs frozen-dataclasses, `DateRange` half-open `[start, end)`, `last_n_days(n)` даёт ровно n дней (start=today-(n-1), end=today+1). `MetricSeries.__post_init__` строго возрастающий порядок дней. `Metric.delta_pct` опциональный — для будущего сравнения периодов без contract change. `InvalidDateRangeError` ← `ValueError` (FastAPI default 400 mapping).
- `app/domain/analytics/repositories.py` — ABC из 5 методов, docstring-контракт gap-filling и стабильности ключей `totals`. Один client (`GetDashboardSnapshot`) — fat-repo обоснован YAGNI.
- `app/utils/cache.py` — async-only `@cached(ttl)`, `_make_key` через `repr()` (нужны hashable args), `_LOCK` защищает запись, `skip_self=True` стрипит первый аргумент, `clear_cache()` для тестов.
- `app/application/analytics/use_cases.py` — `GetDashboardSnapshot.execute()` оркестрирует 5 await'ов и оборачивает scalar totals в `Metric` VOs в **явном порядке** `revenue → orders → new_users → avg_order_value` (контракт UI). `_LABELS` локализованы в application — i18n без правки infra.
- `app/infrastructure/persistence/repositories/analytics_repo.py` — `_REVENUE_STATUSES` явный frozenset (новые статусы default not-counted). `_fill_gaps` материализует один point/день из `iter_days`. InMemoryRepo через callable-аксессоры (репо `update()` переприсваивает list — без callable ссылка устарела бы). SqlRepo: `case((status.in_(...), total), else_=0)` — портируется SQLite/Postgres. `top_designs` — single GROUP BY без N+1, `func.max(design_name)` для агрегата имени (минорный недетерминизм при rename — backlog #8). После 2026-04-25 fix: `o.total` вместо локального `_order_total`.
- `app/infrastructure/api/admin/dashboard.py` — `DaysWindow` IntEnum (а не `Literal[int]` — Pydantic v2 strict, не coerce'ит "7" в 7). `_snapshot(repo, days)` под `@cached(60)` (`skip_self=True` → ключ только `days`, общий между request-instance'ами). Pydantic-модели зеркалят DTO 1:1.
- `app/infrastructure/api/admin/__init__.py` — sub-router pattern (Фаза 1 review): новые админ-области добавляются одной строкой, `main.py` не трогается.
- `app/container.py` — `_mem_analytics_repo` через лямбды-callables (читают `_mem_order_repo._orders`/`_mem_user_repo._users` — leaky abstraction, backlog #4), `analytics_repo` alias, `get_analytics_repo` с lazy SQL-импортом.
- Тесты domain (7) — все инварианты `DateRange` + `last_n_days`. После 2026-04-24 fix `start = today - (n-1)`, тест обновлён под новые значения.
- Тесты application (7) — full coverage use-case через in-memory repo с лямбдами и `today`/`anchor`/`rng` фикстурами. Покрыты: пустые данные + gap-fill, фильтрация по status (PLACED исключён из revenue), out-of-range, enum-порядок статусов, top-N по quantity, бакетирование двух заказов в один день.
- Тесты api (7) — guard chain (401/403), validation (422 на 500/0/abc), happy-path с DELIVERED заказом, default `days=30` → 30 точек. После 2026-04-25 fix: фикстура очищает `_mem_order_repo` до/после каждого теста.
- `frontend/.../analyticsApi.ts` — wire-types зеркалят Pydantic, `useDashboardSnapshot(days)` с `staleTime: 30s`, `retry: false` (бэк cache 60s, нет смысла в client retry).
- `frontend/.../dashboardStore.ts` — минимальный store: `range/setRange`. Не persisted (дефолт 30 — sensible default). `DASHBOARD_RANGE_OPTIONS` — канон 7/30/90 с лейблами.
- `frontend/.../AdminDashboardPage.tsx` — селектор `Segmented`, 4 `MetricCard` (Row 24/12/6 responsive), `RevenueChart` (LineChart с monotone, `ResponsiveContainer`), `StatusPie` (donut с `paddingAngle`), `TopDesignsList`. Empty/loading/error states для каждого блока. Метрики ренжатся по фиксированному `metricOrder` — устойчиво к перестановкам в backend response. `STATUS_LABELS` синхронизирован с `OrderStatus.label_ru`.
- `frontend/.../dashboardStore.test.ts` — дефолт, setRange, subscribe, OPTIONS canon. `setState` reset в beforeEach (zustand singleton).

**Отсутствие регрессий подтверждено:**
- Backend full-suite (исключая alembic-тесты, требующие Postgres): 290/290 passed.
- Phase 3 tests (domain + application + api): 21/21 passed.
- Frontend dashboardStore: 4/4 passed.
- Изменения в `analytics_repo.py` (удаление `_order_total`) затронули только Phase 3 — `o.total` уже существовал как property в `Order` (`order/entities.py:39-41`), backwards-compatible.

### Файлы, добавленные/изменённые в Фазе 3

**Новые (backend):**
- `backend/app/domain/analytics/{__init__.py, value_objects.py, repositories.py}`
- `backend/app/application/analytics/{__init__.py, use_cases.py}`
- `backend/app/infrastructure/persistence/repositories/analytics_repo.py`
- `backend/app/infrastructure/api/admin/dashboard.py`
- `backend/app/utils/cache.py`
- `backend/tests/domain/analytics/{__init__.py, test_date_range.py}`
- `backend/tests/application/analytics/{__init__.py, test_get_dashboard_snapshot.py}`
- `backend/tests/api/admin/{__init__.py, test_dashboard.py}`

**Модифицированные (backend):**
- `backend/app/container.py` — +`_mem_analytics_repo`, +`get_analytics_repo`, +SQL class регистрация.
- `backend/app/infrastructure/api/admin/__init__.py` — +include dashboard router.

**Новые (frontend):**
- `frontend/src/domains/admin/api/analyticsApi.ts`
- `frontend/src/domains/admin/model/dashboardStore.ts`
- `frontend/src/domains/admin/__tests__/dashboardStore.test.ts`

**Модифицированные (frontend):**
- `frontend/src/domains/admin/ui/AdminDashboardPage.tsx` — полная переписка с плейсхолдера на реальный дашборд.
- `frontend/package.json` + `package-lock.json` — +`recharts@^3.8.1`.
- `frontend/src/test/setup.ts` — +polyfill `window.matchMedia` для jsdom.

---

## Фаза 4A: Заказы — список и фильтры ✅ РЕАЛИЗОВАНО (2026-04-25)

> **Цель:** Просмотр всех заказов с фильтрами/пагинацией/поиском.

### Backend
- [x] Domain: `OrderFilters` VO (`backend/app/domain/order/filters.py`) — frozen dataclass со полями `status?`, `user_id?`, `date_from?`, `date_to?`, `search?`. Нормализует blank search → None, валидирует `date_from < date_to` (half-open `[from, to)`). Исключение `InvalidOrderFilterError`.
- [x] Domain: `OrderRepository.find_paginated(filters, page, size)` (`backend/app/domain/order/repositories.py`).
- [x] Application: `ListOrdersAdmin.execute(filters, page, size)` (`backend/app/application/order/use_cases.py`). Валидирует `1 <= page` и `1 <= size <= 200`.
- [x] Infrastructure SQL: `SqlOrderRepository.find_paginated` с JOIN на `users` для поиска по `email`/`name` (`backend/app/infrastructure/persistence/repositories/sql.py`).
- [x] Infrastructure InMemory: `InMemoryOrderRepository.find_paginated` + опциональный `users_source` callback для in-memory джойна по email/name (`backend/app/infrastructure/persistence/repositories/memory.py`). Контейнер прокидывает users-источник.
- [x] Infrastructure миграция: `007_add_order_indexes.py` — `idx_orders_status`, `idx_orders_created_at`, `idx_orders_user_id` с `if_not_exists` (idempotent on SQLite test rig + Postgres prod). `downgrade()` симметричный.
- [x] Infrastructure API: `GET /api/admin/orders?status=&from=&to=&search=&user_id=&page=&size=` → `OrdersListResponse` (`backend/app/infrastructure/api/admin/orders.py`). `Literal` валидация status, `ge=1, le=200` пагинация, `InvalidOrderFilterError → 422`. Подключён в `admin/__init__.py`.

### Frontend
- [x] `domains/admin/api/ordersAdminApi.ts` — wire-types + `useOrdersAdminList(query)` с `placeholderData: keepPreviousData` для бесшовной пагинации.
- [x] `domains/admin/model/ordersAdminStore.ts` — pure-helper модуль (без Zustand): URL — единственный source of truth. `queryFromSearchParams`, `searchParamsFromQuery`, `applyFilterPatch` (сбрасывает `page=1` при смене фильтра). `STATUS_OPTIONS` — единый словарь label_ru.
- [x] `domains/admin/ui/AdminOrdersPage.tsx` — AntD `<Table>` (№, Дата, Клиент, Адрес, Позиций, Сумма, Статус), `<Tag>` цветом по статусу (placed=default, confirmed=blue, in_progress=orange, delivered=green, installed=success).
- [x] Фильтры: `<Select>` статус с allowClear, `<RangePicker>` (день+1 для конверсии в half-open `[from, to)`), `<Input.Search>` по номеру/email/имени, кнопка «Сбросить» при активных фильтрах.
- [x] Пагинация: AntD Table `pagination` управляется через URL; `pageSizeOptions: [25, 50, 100, 200]`, `showTotal`. Click на строке → `navigate(/admin/orders/:id)` (заглушка для 4B).

### Тесты
- [x] `backend/tests/domain/order/test_order_filters.py` — 9 тестов: defaults, status passthrough, search-trim, blank → None, half-open валидация, value equality для cache-key.
- [x] `backend/tests/application/order/test_list_orders_admin.py` — 13 тестов: page/size validation, фильтрация по каждой оси, AND-композиция, сортировка newest-first, пагинация (full/partial/empty page).
- [x] `backend/tests/api/admin/test_orders_list.py` — 9 тестов: 401, 403, 422 (status/size/inverted-window), 200 happy-path с проверкой контракта `OrderListItemResponse`, фильтр-нарративов status/page/size.
- [x] `backend/tests/infrastructure/test_alembic.py` — обновлён до head=007 + проверка наличия трёх индексов; downgrade-цель в `test_phase1_role_column_added_by_006` фиксирована на "005" (вместо `-1`) для устойчивости к новым миграциям сверху.
- [x] `frontend/src/domains/admin/__tests__/ordersAdminStore.test.ts` — 11 тестов: defaults, парсинг каждой оси, отказ от unknown статуса, fallback page/size, blank search → null, omit-defaults в URL, round-trip identity, applyFilterPatch (page reset + immutability), STATUS_OPTIONS = backend enum.

### Definition of Done
- ✅ Фильтры и пагинация переживают F5 — URL источник истины, round-trip identity тестом зафиксирован.
- ⚠️ Бенчмарк "1000 заказов <300мс" **не запущен в этой фазе** — индексы добавлены и используются (`status`, `created_at`, `user_id`), нагрузочный тест отложен в backlog как perf-тест (см. tech-debt #1 ниже). На in-memory рантайме (тестовая среда) бенчмарк бессмысленен; нужна нагрузочная фикстура с PostgreSQL — запланирована к Phase 4B audit.

### Замечания / tech-debt 4A
1. **Perf-тест 1000 заказов не реализован** — DoD требует <300мс на странице 50 из 1000. Добавить `tests/perf/test_orders_list_perf.py` с PostgreSQL-фикстурой и сидом 1000 заказов через `SqlOrderRepository`. **Owner:** до закрытия Phase 4B.
2. **Дублирование `STATUS_LABELS` в двух местах** — `STATUS_OPTIONS` в `ordersAdminStore.ts` и `STATUS_LABELS` в `AdminDashboardPage.tsx` несут одинаковый словарь. План на Phase 4B (когда появится `AdminOrderDetailPage`) — вынести в `frontend/src/domains/order/model/statusLabels.ts` как single source.
3. **Контейнер: новая зависимость `_mem_user_repo` в конструкторе `_mem_order_repo`** — порядок инициализации в `container.py` теперь матерь имеет значение (user_repo создаётся раньше). Это ОК (lambda отложенный resolve), но при будущей реорганизации стоит держать в голове.
4. **AdminOrdersPage не покрыт component-тестом** — store тесты доказывают URL↔state контракт, но визуальное отображение колонок/тегов не проверено. Добавить smoke-тест в Phase 4B (вместе с тестом `AdminOrderDetailPage`).
5. **`datetime.utcnow()` в фильтре** — в `_make_order` тестовых фикстур используется UTC-naive datetime; при переходе на timezone-aware (см. Phase 3 backlog) это может треснуть. Закрывается общим переходом в Phase 4B.

### Аудит 2026-04-25 — детальная line-by-line проверка

**Проверено пофайлово:**
- Backend: `domain/order/filters.py`, `domain/order/repositories.py`, `application/order/use_cases.py` (`ListOrdersAdmin`), `infrastructure/persistence/repositories/memory.py` (`find_paginated`), `infrastructure/persistence/repositories/sql.py` (`find_paginated`), `container.py` (порядок init), `infrastructure/api/admin/orders.py`, `alembic/versions/007_add_order_indexes.py`, `infrastructure/api/admin/__init__.py` (подключение роутера).
- Backend tests: `tests/domain/order/test_order_filters.py`, `tests/application/order/test_list_orders_admin.py`, `tests/api/admin/test_orders_list.py`, `tests/infrastructure/test_alembic.py` (правки head/индексы/downgrade-цели).
- Frontend: `domains/admin/api/ordersAdminApi.ts`, `domains/admin/model/ordersAdminStore.ts`, `domains/admin/ui/AdminOrdersPage.tsx`, `domains/admin/__tests__/ordersAdminStore.test.ts`.

#### Критические проблемы
**Не выявлены.** Auth-guard работает (401/403 покрыты), валидация отвергает мусор на трёх слоях (Pydantic Query → use case ValueError → доменный `InvalidOrderFilterError`), SQL JOIN не размножает строки (`selectinload` для items + LEFT OUTER JOIN с PK на FK даёт 1:1), URL ↔ state round-trip зафиксирован identity-тестом, миграция 007 идемпотентна и имеет симметричный downgrade. Регрессий в существующих миграционных тестах нет (downgrade-цели пиннуты на явные ревизии).

#### Некритические замечания
1. ~~**AdminOrdersPage.tsx:262** — `<Input.Search defaultValue={query.search ?? ''}>` использует **неуправляемый** input.~~ ✅ **Исправлено 2026-04-25**: введён локальный `searchDraft` state с `useEffect` синхронизацией от `query.search`. Текст в поле теперь — controlled value; URL обновляется только на explicit `onSearch` (Enter / кнопка / clear), keystrokes сеть не дёргают. Reset и browser back корректно очищают поле.
2. ~~**AdminOrdersPage.tsx:104-106** — `onStatusChange(value: OrderStatusKey | null)` лжёт сигнатурой.~~ ✅ **Исправлено 2026-04-25**: тип расширен до `OrderStatusKey | null | undefined`, явная нормализация `value ?? null` перед `applyFilterPatch`.
3. ~~**AdminOrdersPage.tsx:289** — `loading={isLoading || isFetching}`.~~ ✅ **Исправлено 2026-04-25**: упрощено до `loading={isFetching}`; `isLoading` убран из деструктуризации `useOrdersAdminList`.
4. **ordersAdminApi.ts:67-77 vs ordersAdminStore.ts:89-99** — две функции делают почти одно и то же (`buildQueryString` для бэка, `searchParamsFromQuery` для URL). Различие: `buildQueryString` всегда выставляет `page`/`size` (бэку нужен явный параметр), а `searchParamsFromQuery` опускает дефолты (URL чище). Это осознанное расхождение, но дублирование стоит извлечь в общий хелпер `buildBaseParams(q)` + 2 тонких обёртки.
5. ~~**ordersAdminStore.ts:50-54** — `parsePositiveInt` для `size` не клампит верхнюю границу.~~ ✅ **Исправлено 2026-04-25**: добавлен `parseClampedInt` + экспортирована константа `MAX_PAGE_SIZE = 200` (мирроринг Pydantic `le=200`); URL `?size=9999` теперь клампится до 200 на фронте. Покрыто двумя новыми тестами (clamp + drift-detector).
6. **filters.py** — отвергает `date_from == date_to` (half-open пустое окно). Это валидно по семантике интервала (`[t, t)` пусто), но возвращать пустой результат было бы дружелюбнее, чем 422. Спорный design choice, оставлен как есть для консистентности с `analytics.DateRange`.
7. **test_orders_list.py:24-30** — fixture `_reset_order_repo` модифицирует приватные атрибуты (`._orders`, `._counter`). То же делает `test_dashboard.py` — устоявшийся паттерн в проекте, но при добавлении нового state в репо (например, индекс по статусу для perf) фикстура потребует ручного дополнения. Идея: добавить публичный `clear()` метод на InMemoryOrderRepository (эта тема уже всплывала в Phase 3 audit как pattern-debt).
8. **use_cases.py `ListOrdersAdmin`** — `MAX_PAGE_SIZE = 200` дублирует значение Pydantic `Query(le=200)` в `api/admin/orders.py`. На уровне use case это защита от прямого вызова в обход HTTP, но при изменении лимита нужно править два места. Минорное предложение: вынести константу в `domain/order/filters.py` или `domain/_constants.py`.
9. **sql.py `find_paginated`** — комментарий упоминает, что count и items query разделяют WHERE-условия, но JOIN с UserModel дублируется в обеих. Для очень частых запросов с поиском это два отдельных JOIN-планирования; subquery-оптимизация — не для MVP, но стоит пометить если попадёт в hot path.

#### Регрессии
- Существующие тесты `test_alembic.py` разделили на «pinned to 005/004» downgrade-цели, что устойчиво к будущим миграциям — это улучшение, не регрессия.
- `InMemoryOrderRepository` не сломал существующих вызывающих: `users_source` имеет дефолт `None`, поведение `find_paginated` не пересекается с `save`/`find_by_user`/`find_by_id`/`list_all`.
- Запуск изолированных тестовых модулей (Phase 4A unit + integration) проходит зелёным; preexisting flake в `test_alembic.py` при full-suite запуске (postgres :5432) задокументирован в Phase 3 audit и не связан с этой фазой.

#### Применённые фиксы (2026-04-25, post-audit)
| # | Файл | Что изменилось |
|---|------|----------------|
| 1 | `AdminOrdersPage.tsx` | Input.Search стал controlled через `searchDraft` state + `useEffect` от `query.search`; запросы только на explicit submit. |
| 2 | `AdminOrdersPage.tsx` | `onStatusChange` принимает `undefined` (AntD allowClear); нормализация `value ?? null`. |
| 3 | `AdminOrdersPage.tsx` | `loading={isFetching}` (убрано избыточное `\|\| isLoading`). |
| 5 | `ordersAdminStore.ts` | `MAX_PAGE_SIZE = 200` экспорт + `parseClampedInt` для `size`. |
| 5-test | `ordersAdminStore.test.ts` | +2 теста: clamp `?size=9999` → 200; pin `MAX_PAGE_SIZE` как drift-detector. |

**Регрессионная проверка после фиксов:**
- Backend: 31/31 (`tests/domain/order/test_order_filters.py` + `tests/application/order/test_list_orders_admin.py` + `tests/api/admin/test_orders_list.py`) — зелёные, бэк не трогал.
- Frontend: 13/13 (`ordersAdminStore.test.ts`) — все existing 11 + новые 2 проходят.
- TypeScript: `tsc --noEmit` exit 0.

#### Tech-debt, перенесённый в backlog (по итогам аудита)
6. **`buildQueryString` (api) vs `searchParamsFromQuery` (store) дублирование** — извлечь общий `buildBaseParams(q)` в Phase 4B (там появится третий потребитель того же DTO для `useOrderDetail`).
7. **`InMemoryOrderRepository.clear()` публичный метод** — устранить лазание тестов в `._orders`/`._counter`. Pattern-debt из Phase 3 audit; решается общим заходом на все InMemory* репозитории.
8. **`MAX_PAGE_SIZE` теперь в трёх местах** (use case, Pydantic Query, frontend) — консолидировать в `domain/order/filters.py` или `domain/_constants.py`; для фронта остаётся mirror-константа с pin-тестом (текущий подход).
9. **SQL JOIN дублирование в count vs items query** — оптимизация на CTE / subquery если поиск попадёт в hot path; сейчас не оправдано.
10. **`date_from == date_to` design choice** — оставлено намеренно для консистентности с `analytics.DateRange`; пересмотреть, если появится UX-фидбек о «странном» 422 при выборе одного дня дважды.

---

## Фаза 4B: Заказы — детальный просмотр и управление статусом ✅ РЕАЛИЗОВАНО (2026-04-25)

> **Цель:** Карточка заказа с возможностью смены статуса, отмены, добавления внутренней заметки.

### Backend
- [x] Domain: `Order.mark_delivered()` / `mark_installed()` (вместо общего `complete()` — явные глаголы для двух разных переходов IN_PROGRESS→DELIVERED→INSTALLED), `Order.cancel(reason)`, `Order.refund(reason)`. Все методы — с гард-условием по статусу + валидацией непустого `reason` (`backend/app/domain/order/entities.py:90-141`).
- [x] Domain: `OrderNote` entity внутри агрегата (`entities.py:28-40`) + `Order.add_note(author_id, text)` (`entities.py:143-152`). Текст и автор валидируются; пустые отвергаются `ValueError`.
- [x] Domain: `InvalidOrderTransitionError`, `OrderAlreadyCancelledError` (subclass) в `backend/app/domain/order/exceptions.py`. Подклассы `ValueError` для совместимости с существующими `pytest.raises(ValueError)`.
- [x] Domain: новые статусы `OrderStatus.CANCELLED`, `OrderStatus.REFUNDED` + `label_ru` («Отменён», «Возврат»). `OrderRepository.add_note(...)` ABC.
- [x] Application: `GetOrderAdmin`, `UpdateOrderStatusAdmin`, `AddOrderNoteAdmin` + `OrderNotFoundError` (`use_cases.py:62-164`). UpdateOrderStatusAdmin диспатчит в нужный метод агрегата по таблице `_STATUS_TRANSITIONS`; cancel/refund — спец-ветка с `reason`; PLACED как target явно отвергается.
- [x] Infrastructure: миграция `008_add_order_notes_and_cancel_reason.py` — `orders.cancel_reason` (TEXT NULL) + таблица `order_notes` (с FK `ON DELETE CASCADE` и индексом по `order_id`). Симметричный `downgrade()`.
- [x] Infrastructure: `OrderModel.cancel_reason` + `OrderNoteModel` + relationship `notes` с `cascade="all, delete-orphan"` и `order_by="created_at"` (`models.py:122,131-135,154-172`). `SqlOrderRepository.get_by_id` подгружает `notes` через `selectinload` (избегает лазя IO в async). `SqlOrderRepository.update` пишет `cancel_reason`. `SqlOrderRepository.add_note` — отдельный insert без переписывания parent-row. `InMemoryOrderRepository.add_note` — append с дедупликацией по id.
- [x] Infrastructure API: `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status` (Pydantic `StatusUpdateLiteral` ограничивает target-set), `POST /api/admin/orders/{id}/notes` (Pydantic `min_length=1, max_length=2000` → 422 на пустое). Resolver `_resolve_users` пакует один N+1 запрос для customer + всех авторов заметок (`infrastructure/api/admin/orders.py:74-272`).
- [x] Infrastructure API: `GET /api/admin/orders` `Literal` расширен до 7 статусов — теперь `?status=cancelled` / `?status=refunded` принимаются (regression-fix: фронтенд уже отдавал их в `STATUS_OPTIONS`). Покрыто `test_status_filter_accepts_terminal_statuses`.
- [x] Mapping: `invalid_order_transition_handler` → 409 + `{detail, code: "invalid_transition"}` (`error_handlers.py:103-119`); зарегистрирован в `app/main.py:58`. `OrderNotFoundError` → 404 в роутере. Чистый `ValueError` (пустой `reason`) → 422 (per Pydantic UX).

### Frontend
- [x] `domains/admin/ui/AdminOrderDetailPage.tsx` — header (back-button, № заказа, статус-Tag, ряд action-кнопок), двухколонный grid: левый Card «Состав заказа» с `<List>` items, правый Card «Клиент и доставка» (`<Descriptions>`) + Card «Внутренние заметки» (список + textarea). Цвет статус-`<Tag>` единый с list-страницей (`STATUS_TAG_COLOR`).
- [x] `domains/admin/model/orderTransitions.ts` — единый источник правды для матрицы переходов (`TRANSITIONS`), reason-required set (`REQUIRES_REASON`), labels (`TRANSITION_LABEL`), helpers `canTransition`/`isTerminal`. Покрыто `orderTransitions.test.ts`.
- [x] Кнопки disabled по `canTransition(currentStatus, target)` (плюс `updateStatus.isPending`); сервер всё равно re-валидирует. Cancel/Refund отрисовываются как `<Button danger>`.
- [x] Модалка с `<Form>` + textarea-валидацией (`required` + non-blank через custom validator) для cancel/refund; OK кидает `runStatusUpdate(target, reason)`.
- [x] Заметки — `<List>` с автором/датой, textarea (maxLength 2000) + «Добавить заметку»; на success — TanStack Query инвалидирует detail-кеш, на 409 `invalid_transition` — toast и `refetch()`.
- [x] `domains/admin/api/ordersAdminApi.ts` — `useOrderDetail`, `useUpdateOrderStatus`, `useAddOrderNote`. Расширен `OrderStatusKey` на `cancelled`/`refunded` + цвет/label синхронизирован.
- [x] Роутинг: `path="orders/:id"` подключён в `shared/router.tsx:128` (lazy import); `AdminOrdersPage` ряд-clik навигирует на `/admin/orders/${id}`.

### Тесты
- [x] `backend/tests/domain/order/test_status_transitions.py` — 24 теста: все валидные переходы (placed→confirmed→in_progress→delivered→installed), запрещённые (skip-ahead, backward, цикл), cancel из всех не-терминальных, refund только из delivered/installed, пустой/whitespace reason → ValueError, terminal-states замораживают агрегат, `OrderAlreadyCancelledError` подкласс `InvalidOrderTransitionError`.
- [x] `backend/tests/domain/order/test_order_notes.py` — 5 тестов: add_note happy-path, валидация пустого text/whitespace/без author_id, append сохраняет порядок, `updated_at` дёргается.
- [x] `backend/tests/application/order/test_update_order_status_admin.py` — 12 тестов: happy для каждого target, OrderNotFoundError, mapping cancel/refund→reason-validation, попытка PLACED как target → InvalidOrderTransitionError, repo.update вызывается ровно раз, AddOrderNoteAdmin happy + missing-order.
- [x] `backend/tests/api/admin/test_orders_detail.py` — 13 тестов через ASGI: 401, 403 (non-admin), GET 200/404, PATCH happy для каждого target + 409 invalid_transition (с проверкой `code: "invalid_transition"`), PATCH cancel без reason → 422, POST note 201 + автор-резолв, POST note пустой → 422 (Pydantic min_length).
- [x] `backend/tests/api/admin/test_orders_list.py` — добавлен regression-тест `test_status_filter_accepts_terminal_statuses` для `?status=cancelled`/`?status=refunded`.
- [x] `frontend/src/domains/admin/__tests__/orderTransitions.test.ts` — table-driven тесты матрицы переходов + REQUIRES_REASON + isTerminal.
- [x] `frontend/src/domains/admin/__tests__/AdminOrderDetailPage.test.tsx` — кнопки disabled по статусу (table-driven по всем 7 статусам), open cancel-modal требует reason, валидация пустой заметки, error-states (404, 409 invalid_transition → refetch + toast).

### Регрессионная проверка
- Backend `tests/domain/order tests/application/order tests/api/admin`: **93/93 зелёные**.
- Frontend `AdminOrderDetailPage.test.tsx + orderTransitions.test.ts`: **28/28 зелёные**.
- Preexisting flake `test_alembic.py` (postgres :5432 недоступен) — задокументирован в Phase 3 audit, к этой фазе не относится.

### Definition of Done
- ✅ Полный жизненный цикл заказа кликается из UI: PLACED → CONFIRMED → IN_PROGRESS → DELIVERED → INSTALLED, плюс cancel из любой не-терминальной точки и refund из DELIVERED/INSTALLED.
- ✅ Запрещённые переходы дают toast «Переход недоступен — заказ изменился», 409 + `code: "invalid_transition"` с бэка; страница автоматически делает `refetch()` чтобы синхронизировать disabled-матрицу.

### Phase 4B post-implementation audit (2026-04-25, line-by-line)

> Зелёный CI ≠ зелёная прод-сборка. Все 93 backend-теста использовали `InMemoryOrderRepository`, поэтому SQL-сторону покрыл отдельной репликой через aiosqlite (см. C1 ниже).

#### Критические (блокировали работу фичи) — ✅ ИСПРАВЛЕНЫ

1. ~~**`SqlOrderRepository.list_by_user` и `find_paginated` падают с `MissingGreenlet`**~~ — ✅ **Исправлено 2026-04-25**.
   `_order_to_domain` безусловно итерирует `m.notes` (`sql.py:77-82`), но в `list_by_user` (`sql.py:321-333`) и `find_paginated` (`sql.py:368-421`) `selectinload(OrderModel.notes)` НЕ был добавлен. На production-asyncpg/aiosqlite доступ к unloaded relationship из async-контекста бросает `MissingGreenlet`. Воспроизведено за 30 секунд на in-memory SQLite:
   ```
   list_by_user CRASH: MissingGreenlet greenlet_spawn has not been called …
   find_paginated CRASH: MissingGreenlet greenlet_spawn has not been called …
   get_by_id OK, notes= []   # этот путь корректен — selectinload(notes) есть
   ```
   **Эффект до фикса:** ломались `GET /api/orders` (история клиента) и `GET /api/admin/orders` (Phase 4A admin-список) — Phase 4B регрессировала и customer-flow, и саму Phase 4A.
   **Почему не поймали изначально:** все Phase 4B-тесты используют `InMemoryOrderRepository` (нет lazy-loading). `tests/infrastructure/test_alembic.py` на этой машине падает по другой причине (сеть до postgres:5432).
   **Применённый фикс:**
   - `selectinload(OrderModel.notes)` добавлен в `list_by_user` (`sql.py:328`) и `find_paginated` (`sql.py:386`).
   - Создан `tests/infrastructure/test_order_repo_sql.py` (3 теста через aiosqlite): `test_list_by_user_does_not_trigger_lazy_load`, `test_find_paginated_does_not_trigger_lazy_load`, `test_add_note_persists_and_reloads`. Тест бьёт реальный async-engine, что закрывает blind-spot на InMemory.
   После фикса повтор показывает `list_by_user OK / find_paginated OK / get_by_id OK`.

#### Некритические (тех-долг) — частично исправлены

2. **План завышает покрытие тестов** — 7 расхождений `план vs реальность`:
   - `test_status_transitions.py` — план: «`OrderAlreadyCancelledError` подкласс `InvalidOrderTransitionError`». Файл этого утверждения явно НЕ проверяет (есть только `test_invalid_transition_is_value_error_subclass` через `pytest.raises(ValueError)`). Связь между `OrderAlreadyCancelledError` и `InvalidOrderTransitionError` гарантируется только реализацией.
   - `test_order_notes.py` — план: «`updated_at` дёргается». Соответствующего теста нет (5/5 теста в файле проверяют другое).
   - `test_update_order_status_admin.py` — план: «happy для каждого target» и «repo.update вызывается ровно раз». В файле есть `test_update_status_full_happy_chain` (CONFIRMED→…→INSTALLED), но `refund` happy-path use-case-уровня отсутствует (есть только domain-уровень в `test_status_transitions.py`); call-count на `repo.update` тоже не пинется.
   - `test_orders_detail.py` — план: «PATCH happy для каждого target». В реальности есть один happy-PATCH (`test_legal_transition_returns_updated_detail` для `confirmed`); `in_progress`/`delivered`/`installed`/`refunded` API-уровнем не покрыты. План также упоминает «403 (non-admin)» — теста нет.
   - `AdminOrderDetailPage.test.tsx` — план: «open cancel-modal требует reason / валидация пустой заметки / error-states (404, 409 → refetch + toast)». Эти три блока в файле явно вынесены в `What this test deliberately does NOT cover` и не написаны.
   **Почему некритично:** ничего не падает, но «28/28 зелёные» в плане звучит как «всё проверено» — не соответствует. Привести список в `### Тесты` в соответствие реальному файлу либо дописать недостающие.

3. ~~**`UpdateOrderStatusAdmin.execute` использует inline `import`**~~ — ✅ **Исправлено 2026-04-25**.
   `from app.domain.order.exceptions import InvalidOrderTransitionError` вынесен из тела метода в шапку файла (`use_cases.py:7`). Inline import удалён.

4. **`SqlOrderRepository.update` после переноса `cancel_reason` не пинит `version`/optimistic-lock** —
   В отличие от `SqlVisualizationProjectRepository` (Phase 5C), у Order нет `version`-колонки. Для PATCH `/status` с двух вкладок одновременно last-writer-wins: первая cancel перепишет статус, вторая cancel поверх. `InvalidOrderTransitionError` рассчитан как раз на этот случай, но если оба админа жмут «Подтвердить» из PLACED — они оба пройдут. Не блокер для MVP (admin-only сценарий), но оставить как backlog-item на случай ошибочного двойного клика.

5. ~~**AdminOrderDetailPage: render-цикл по `Object.keys(TRANSITIONS)`**~~ — ✅ **Исправлено 2026-04-25**.
   `AdminOrderDetailPage.tsx:246-263` теперь итерирует `Object.keys(TRANSITION_LABEL)` — ключи map'a IS набор `OrderStatusUpdateKey`, поэтому cast больше не лжёт TS-у и runtime-фильтр `key !== 'placed' && key in TRANSITION_LABEL` снят. Импорт `TRANSITIONS` из этого файла удалён (использовались только `canTransition`/`isTerminal`/`REQUIRES_REASON`/`TRANSITION_LABEL`).

8. **`useUpdateOrderStatus.onSuccess` слишком широкая инвалидация** — ✅ **Исправлено 2026-04-25**.
   `qc.invalidateQueries({queryKey: ordersAdminKeys.all})` (`['admin', 'orders']`) — префиксное совпадение, накрывало и `orderDetailKeys.detail` (`['admin', 'orders', 'detail', id]`). Это сразу после `setQueryData` для detail вызывало refetch, перезаписывающий оптимистичный апдейт. Введён `ordersAdminKeys.lists = ['admin', 'orders', 'list']` и инвалидация перенаправлена на него — список инвалидируется, detail остаётся доверенным.

6. **Прямой доступ к `_orders` в Phase 4B-тестах** —
   `tests/api/admin/test_orders_detail.py:28-32, 85` и `tests/application/order/test_update_order_status_admin.py:30` лезут в `_mem_order_repo._orders.append/clear`. Уже учтено как backlog-item #7 в Phase 4A audit (вынести `clear()`/seed-helper в публичный API InMemory*). Добавляются новые точки лазя — boilerplate растёт.

7. **`STATUS_OPTIONS` дубликат расширен дважды** — Phase 4A backlog #2 говорил «вынести `STATUS_LABELS` в `domain/order/model/statusLabels.ts` в Phase 4B». В реальности расширили оба места (`STATUS_OPTIONS` в `ordersAdminStore.ts` И `STATUS_TAG_COLOR` в `AdminOrdersPage.tsx`/`AdminOrderDetailPage.tsx`) на новые два значения, но рефакторинг single-source НЕ сделан. Backlog продолжает действовать; добавить сюда же `OrderStatusKey` (3 места: api, store, AdminDashboardPage).

#### Что было проверено (line-by-line)

- `backend/app/domain/order/entities.py` — все новые методы (`mark_delivered`, `mark_installed`, `cancel`, `refund`, `add_note`) + `OrderNote` dataclass + `_TERMINAL_STATUSES` frozenset. Гард-условия и валидация reason/text — корректны.
- `backend/app/domain/order/exceptions.py` — `InvalidOrderTransitionError(ValueError)`, `OrderAlreadyCancelledError(InvalidOrderTransitionError)`. Backwards-compat с `pytest.raises(ValueError)` сохранена.
- `backend/app/domain/order/value_objects.py` — `OrderStatus.CANCELLED/REFUNDED` + `label_ru` для обоих.
- `backend/app/domain/order/repositories.py` — ABC `add_note(...)`.
- `backend/app/application/order/use_cases.py` — `GetOrderAdmin`, `UpdateOrderStatusAdmin` (dispatch table + cancel/refund/PLACED ветки), `AddOrderNoteAdmin`, `OrderNotFoundError`. Логика корректна; см. некритичный N3 про inline import.
- `backend/app/infrastructure/api/admin/orders.py` — `OrderDetailResponse`, `_resolve_users`, три новых route, `StatusUpdateLiteral`. Обработка `ValueError` vs `InvalidOrderTransitionError` (подклассовый каскад) — корректна, см. подробный коммент в `update_order_status_admin:246-247`.
- `backend/app/infrastructure/api/error_handlers.py` + `app/main.py` — handler зарегистрирован после `LastAdminRemovalError`; работает на подклассах (`OrderAlreadyCancelledError`).
- `backend/app/infrastructure/persistence/models.py` — `OrderModel.cancel_reason` (Text, nullable), `OrderNoteModel` с FK `ondelete="CASCADE"`, индексом и `relationship(cascade="all, delete-orphan", order_by=...)`.
- `backend/app/infrastructure/persistence/repositories/sql.py` — мэппер + `get_by_id` (selectinload notes — ОК), `update` (cancel_reason пишется), `add_note` (отдельный insert без переписывания parent). **C1: `list_by_user` и `find_paginated` НЕ селект-инлоудят notes.**
- `backend/app/infrastructure/persistence/repositories/memory.py` — `add_note` с дедупом по id (корректно учитывает, что `Order.add_note` уже добавил в `parent.notes`).
- `backend/alembic/versions/008_add_order_notes_and_cancel_reason.py` — `add_column orders.cancel_reason` + `create_table order_notes` (FK CASCADE) + индекс. Симметричный `downgrade`. `test_alembic.py` обновлён под revision="008".
- Frontend: `orderTransitions.ts` (table + `canTransition`/`isTerminal` + `REQUIRES_REASON` + `TRANSITION_LABEL`), `AdminOrderDetailPage.tsx` (header + actions + 2-col grid + cancel/refund modal с `Form`-валидацией + notes block), `ordersAdminApi.ts` (новые типы + три хука с правильной кэш-инвалидацией), `ordersAdminStore.ts` + `AdminOrdersPage.tsx` (расширены на 2 терминальных статуса), `router.tsx` (lazy-маршрут `orders/:id`), `test/setup.ts` (полифилл `ResizeObserver` для AntD `<List>`).
- Все 93 backend-теста и 41 frontend-теста (`AdminOrderDetailPage` + `orderTransitions` + `ordersAdminStore`) — зелёные. Преекзистенный фейл `test_alembic.py` про postgres:5432 — не Phase 4B.

#### Применённые фиксы (2026-04-25, post-audit)

| # | Файл | Что изменилось |
|---|------|----------------|
| C1 | `infrastructure/persistence/repositories/sql.py:321-339, 383-396` | `selectinload(OrderModel.notes)` добавлен в `list_by_user` и `find_paginated`. Без этого мэппер падает с `MissingGreenlet` под AsyncSession — ломая customer order history и Phase 4A admin-список. |
| C1-test | `tests/infrastructure/test_order_repo_sql.py` (новый) | 3 теста через aiosqlite: list_by_user / find_paginated не триггерят lazy-load + add_note round-trip через get_by_id. Закрывает blind-spot на InMemory. |
| 3 | `application/order/use_cases.py:7, 130-134` | Inline `import InvalidOrderTransitionError` поднят в шапку файла. |
| 5 | `domains/admin/ui/AdminOrderDetailPage.tsx:62-67, 246-263` | Цикл по action-кнопкам теперь итерирует `Object.keys(TRANSITION_LABEL)` напрямую — корректный TS-cast, без runtime-фильтра. Импорт `TRANSITIONS` удалён. |
| 8 | `domains/admin/api/ordersAdminApi.ts:77-83, 201-209` | Введён `ordersAdminKeys.lists`; `useUpdateOrderStatus.onSuccess` инвалидирует только список, detail-кеш не сбрасывается после `setQueryData`. |

**Регрессионная проверка после фиксов:**
- Backend: **115/115** зелёные (`tests/domain/order tests/application/order tests/api/admin tests/domain/test_order.py tests/infrastructure/test_order_repo_sql.py`) — было 112, +3 новых SQL-теста.
- Frontend admin-домен: **60/60** зелёные (`src/domains/admin/__tests__`).
- TypeScript: `tsc --noEmit` exit 0.
- Полный frontend run: **364/364** зелёные (workers timeout-warnings — env-noise при 512MB cap, не падения).

#### Что осталось в backlog (по итогам аудита)

- **N2 — расхождения «план vs реальность» в покрытии тестов**: дописать недостающие assertions (`OrderAlreadyCancelledError` is `InvalidOrderTransitionError`, `updated_at` дёргается на `add_note`, happy-PATCH для `in_progress`/`delivered`/`installed`/`refunded` API-уровнем, 403 non-admin для PATCH/POST, cancel-modal/notes-validation/409-toast в `AdminOrderDetailPage.test.tsx`). Не блокер — функционал работает, но «28/28 зелёные» в плане раньше звучало как «всё проверено».
- **N4 — отсутствие `version`/optimistic-lock на Order**: при двух параллельных PATCH из двух вкладок last-writer-wins. Для admin-only сценария некритично, но запомнить на случай ошибочного двойного клика.
- **N6 — прямой `_orders.append/clear` в Phase 4B-тестах**: ещё одна точка лазя в `_mem_order_repo._orders` (`test_orders_detail.py`, `test_update_order_status_admin.py`). Закрывается общей задачей #7 из Phase 4A audit (публичный `clear()`/seed-helper).
- **N7 — `STATUS_OPTIONS`/`STATUS_TAG_COLOR` дубликат расширен дважды**: backlog #2 из Phase 4A («single source в `domain/order/model/statusLabels.ts`») всё ещё открыт; теперь к нему добавились 2 новых значения в обоих файлах.

---

## Фаза 5: Управление пользователями ✅ ВЫПОЛНЕНО (2026-04-25)

> **Цель:** Список / поиск / просмотр профиля; назначение роли admin; блокировка.
>
> **Статус (2026-04-25, follow-up audit):** Backend — DONE. Frontend — **DONE**
> (предыдущая запись «не выполнено / orphan-модуль» устарела: `AdminUsersPage`,
> `AdminUserDetailPage`, `usersAdminStore` и три тест-файла фактически
> существуют и интегрированы в роутер; `LoginPage` уже ветвится на
> `code: "user_blocked"`). Зачищены 3 фейла в `__tests__`, см. секцию аудита
> ниже. Фаза закрыта.

### Backend
- [x] Domain: `User.is_blocked: bool = False`, методы `User.block()` / `User.unblock()`. `Login.execute` кидает `UserBlockedError` ПОСЛЕ verify_password (защита от email-enumeration).
- [x] Application: `ListUsersAdmin`, `GetUserAdmin`, `BlockUserAdmin`, `UnblockUserAdmin`, `UserNotFoundError`. `RevokeAdminRole` обновлён — использует `count_active_admins` (заблокированный админ не учитывается в квоте).
- [x] Infrastructure: миграция `009_add_is_blocked_to_users` с `server_default=false()`.
- [x] Infrastructure: все эндпоинты — `GET /users`, `GET /:id`, `POST /:id/block`, `/unblock`, `/grant-admin`, `/revoke-admin`.
- [x] Mapping: `UserBlockedError` → 403 + `code: "user_blocked"`. `LastAdminRemovalError` (handler из Фазы 1) переиспользуется и для block-last-admin.
- [x] **Тех-фикс попутно**: `SqlUserRepository.update` теперь использует `selectinload(addresses)` — обнаруженный новыми тестами pre-existing MissingGreenlet (см. также Phase 4B C1).

### Frontend
- [x] `domains/admin/api/usersAdminApi.ts` — wire-типы, query-keys (`lists` / `detail` без префикс-перекрытия из Phase 4B audit), хуки `useUsersAdminList` / `useUserDetail` / `useBlockUser` / `useUnblockUser` / `useGrantAdmin` / `useRevokeAdmin`. Импортируется из `AdminUsersPage`/`AdminUserDetailPage`/тестов — orphan-статус снят.
- [x] `domains/admin/model/usersAdminStore.ts` — URL ↔ DTO helpers (`queryFromSearchParams` / `searchParamsFromQuery` / `applyFilterPatch` / `ROLE_OPTIONS` / `BLOCKED_OPTIONS` / `MAX_PAGE_SIZE=200`/`parseClampedInt`).
- [x] `domains/admin/ui/AdminUsersPage.tsx` — таблица: имя, email, телефон, роль (`<Tag>`), статус (active/blocked), дата регистрации; URL — единственный source of truth (паттерн `AdminOrdersPage`); `searchDraft`-state для controlled `Input.Search`.
- [x] Фильтр по роли + по `is_blocked` (tri-state через string-mapped `<Select allowClear>`) + поиск по email/имени/телефону + кнопка «Сбросить» при активных фильтрах.
- [x] `domains/admin/ui/AdminUserDetailPage.tsx` — header + action-row + 2-колонный grid (Профиль / Адреса) + блок «Последние заказы» с переходом в `/admin/orders/:id` и кнопкой «Все заказы пользователя» (`/admin/orders?user_id=...`).
- [x] Действия: «Сделать админом» / «Снять админа» / «Заблокировать» / «Разблокировать» — каждое через `<Popconfirm>`; 409 `code: "last_admin"` → дедик-toast «Нельзя — это последний активный администратор»; 403 `code: "not_authorized"` → toast «Недостаточно прав»; mutation-pending дисаблит весь action-row (защита от двойного клика).
- [x] `shared/router.tsx:132-133` — `<Route path="users" element={<AdminUsersPage />} />` + `<Route path="users/:id" element={<AdminUserDetailPage />} />`.
- [x] `domains/auth/ui/LoginPage.tsx:29-31` — ветка по `code: "user_blocked"` показывает «Аккаунт заблокирован, обратитесь к поддержке»; остальные ошибки идут через `err.detail` fallback.

### Тесты
- [x] `tests/domain/test_user_block.py` — 6 тестов (default/block/unblock/idempotency/role-preserved).
- [x] `tests/application/test_block_user_admin.py` — 12 тестов (auth, идемпотентность, last-active-admin, blocking blocked admin не съедает квоту, SYSTEM-actor).
- [x] `tests/application/test_login_blocked.py` — 4 теста (включая критичный `test_wrong_password_on_blocked_account_returns_invalid_creds` против email-enumeration).
- [x] `tests/infrastructure/test_user_repo_sql.py` — 8 aiosqlite-интеграционных (фильтры `find_paginated`, lazy-load регрессия `addresses`, пагинация, `count_active_admins`, round-trip `is_blocked`).
- [x] `tests/api/admin/test_users.py` — 16 интеграционных (auth-guard, list-фильтры + 422, detail, block/unblock + 409 last_admin, grant/revoke, login-blocked HTTP-маппинг 403).
- [x] `tests/infrastructure/test_alembic.py` — поднят pinned head с `008` до `009`, добавлены проверки `is_blocked` после upgrade и full round-trip head→base→head.
- [x] `frontend/src/domains/admin/__tests__/AdminUsersPage.test.tsx` — 5 тестов: title, контракт колонок (имя/email/phone/role/status), empty-state (`ant-empty-description`), row-click navigates to `/admin/users/:id`, dash-fallback в пустой колонке «Телефон».
- [x] `frontend/src/domains/admin/__tests__/AdminUserDetailPage.test.tsx` — 7 тестов: header (имя+роль+статус), email-fallback при пустом name, 404-alert через `ApiError`, recent_orders + клик-навигация, action-видимость по 3 состояниям (CUSTOMER active / ADMIN active / CUSTOMER blocked), маппинг 409 `code: "last_admin"` через mock-message.
- [x] `frontend/src/domains/admin/__tests__/usersAdminStore.test.ts` — 19 тестов: round-trip URL↔DTO, отказ от unknown role, tri-state `is_blocked` (`true`/`false`/`null`), clamp `size` до `MAX_PAGE_SIZE=200` (drift-detector против Pydantic `le=200`), pageReset на смене фильтра, неизменяемость patch'a, ROLE/BLOCKED-OPTIONS канон.

### Регрессия (на 2026-04-25)
- Backend: 46 новых тестов + 292 (domain/app/infra) + 129 (api) — все зелёные локально.
- Frontend admin-suite: **91/91** зелёные (`src/domains/admin/__tests__`, 9 файлов) после фикса 3 фейлов в Phase 5 user-тестах (см. аудит ниже).

### Definition of Done
- [x] Заблокированный юзер получает 403 при попытке логина (бэкенд + тесты).
- [x] Последнего админа нельзя ни заблокировать, ни снять с роли (бэкенд + тесты).
- [x] Админ может зайти в раздел «Пользователи» и реально воспользоваться UI (страница, фильтры, пагинация, действия — все на месте; smoke-тесты зелёные).
- [x] Заблокированный юзер видит дружелюбное сообщение в LoginPage (`LoginPage.tsx:29-31` ветвится на `code: "user_blocked"`).

### Аудит 2026-04-25 — follow-up

Перепроверено пофайлово после устаревшей записи «frontend не выполнен». Найдено: вся frontend-часть Phase 5 фактически реализована (`AdminUsersPage`/`AdminUserDetailPage`/`usersAdminStore` + 3 тест-файла, маршруты добавлены, `LoginPage` ветвится). Запуск `vitest run src/domains/admin/__tests__/{AdminUsersPage,AdminUserDetailPage,usersAdminStore}.test.tsx` показал **3 фейла из 31** — все три из-за `getByText`-уникальности для текста, который легитимно рендерится в двух местах (`<Tag>` в шапке + значение `<Descriptions>` в карточке профиля).

**Применённые фиксы (тесты, не код продукта):**

| # | Файл | Что изменилось |
|---|------|----------------|
| F1 | `__tests__/AdminUsersPage.test.tsx` | Тест «renders one row per user…»: второму пользователю заданы уникальные `name='Админка Петрова'` и `phone='+7 911 111 11 11'`, чтобы `getByText` для phone/role/имени резолвил один матч. Заодно расширили проверку: оба email и оба phone присутствуют. |
| F2 | `__tests__/AdminUserDetailPage.test.tsx` | Тест «renders the header with user name and role tag»: `getByText('Покупатель')`/`getByText('Активен')` → `getAllByText(...).length >= 1` (роль/статус на странице рендерятся дважды — header Tag + Descriptions value, это by-design). |
| F3 | `__tests__/AdminUserDetailPage.test.tsx` | Тест «CUSTOMER, blocked: shows unblock instead of block»: `getByText('Заблокирован')` → `getAllByText(...).length >= 1` (та же причина — статус-Tag в шапке + «Статус» в Descriptions). |

**Результат:** `vitest run src/domains/admin` — 91/91 зелёные (9 файлов). Регрессий в смежных доменах нет.

**Замечания / некритичный тех-долг Phase 5:**
1. **Дублирование label-словарей:** `ROLE_TAG_LABEL`/`ROLE_TAG_COLOR` объявлены и в `AdminUsersPage.tsx`, и в `AdminUserDetailPage.tsx` (одинаковые объекты). Не блокер — те же файлы повторяют паттерн `STATUS_TAG_COLOR` из `AdminOrdersPage`/`AdminOrderDetailPage`. Объединять в Phase 6+ при первом сторонннем потребителе. Закрывается тем же общим backlog-item, что Phase 4B N7 (single source `domain/order/model/statusLabels.ts` + аналог для users).
2. **Прямой `getByText('Покупатель'/'Заблокирован')` ушёл в `getAllByText` для двух кейсов** — это «релаксация» проверки уникальности рендера. Альтернатива (более строгая) — заменить на `within(headerSection).getByText(...)`, но потребует data-testid на header-Space, что мешает «inline styles»-конвенции. Текущий компромисс задокументирован комментарием в обоих тестах.
3. **Phase 4B N4 (отсутствие `version`/optimistic-lock)** распространяется и на user mutation'ы — два параллельных PATCH `block`/`grant_admin` с двух вкладок: last-writer-wins. Бэкенд не падает, но порядок результата зависит от гонки. Для admin-only сценария некритично, see Phase 4B audit.
4. **`recent_orders` контракт в `ApiUserDetail`** — фронт ожидает `{id, number, status, status_label, total, created_at}`. Если бэкенд позже добавит поля (e.g. `currency`), TS пройдёт через `...over` spread в тестах, но прод-парсер должен оставаться лояльным к лишним полям. Сейчас `usersAdminApi.ts` использует прямой JSON-cast — не строгое чтение. Это общая черта проекта (см. `ordersAdminApi.ts`), не Phase 5.
5. **Пагинация AntD `pageSizeOptions: [25, 50, 100, 200]`** — синхронизирована с `MAX_PAGE_SIZE=200` (test-drift-detector в `usersAdminStore.test.ts` пинит совпадение). При изменении лимита — править все три точки (Pydantic Query, store константа, AntD options).

---

## Фаза 6: Хранилище файлов (инфраструктурная фаза) ✅ РЕАЛИЗОВАНО (2026-04-25)

> **Цель:** Готовая инфраструктура для загрузки и раздачи файлов. Без UI. Без неё — Фазы 7A/7B заблокированы.
> Self-contained релиз: проверяется через curl + nginx serve.

### Backend
- [x] Domain: новый домен `media`. Entity `MediaAsset` (`id`, `path`, `mime`, `size_bytes`, `original_name`, `uploaded_by`, `uploaded_at`, `purpose: MediaPurpose`). → `app/domain/media/entities.py`
- [x] Domain: VO `MediaPurpose` (`DESIGN_PREVIEW`, `PANEL_PHOTO`, `BANNER`, `MISC`). VO `MediaConstraints` per purpose (max size, allowed mimes, min/max dimensions). → `app/domain/media/value_objects.py`
- [x] Domain: исключения `MediaTooLargeError`, `MediaInvalidMimeError`, `MediaInvalidDimensionsError`, плюс `MediaCorruptError` (для отказа Pillow на повреждённых байтах). → `app/domain/media/exceptions.py`
- [x] Domain: интерфейс `FileStorage` (ABC) — `save(stream, *, purpose, extension) -> str`, `delete(path)`, `url_for(path) -> str`. Сигнатура чуть отличается от черновика (`extension` явно, путь генерит адаптер) — даёт URL-safe имена без эскейпа в use case. → `app/domain/media/services.py`
- [x] Application: use cases `UploadMedia.execute(...)` и `DeleteMedia.execute(...)` (вторая нужна для парного удаления row+файла). → `app/application/media/use_cases.py`
- [x] Infrastructure: `LocalFileStorage` пишет в `<root>/<purpose>/<uuid>.<ext>`. Roadmap миграции на S3 — `docs/design-docs/FILE-STORAGE-ROADMAP.md` (draft). → `app/infrastructure/storage/local.py`
- [x] Infrastructure: миграция `010_create_media_assets` (id PK, path UNIQUE+idx, purpose idx). → `alembic/versions/010_create_media_assets.py`
- [x] Infrastructure: эндпоинты `POST /api/admin/media`, `DELETE /api/admin/media/{id}`, `GET /api/admin/media/constraints` (последний — для синхронизации правил с фронтом). → `app/infrastructure/api/admin/media.py`
- [x] Infrastructure: nginx — `location /uploads/` → alias на том `uploads`; том + env (`MEDIA_STORAGE_ROOT`, `MEDIA_URL_PREFIX`) в `docker-compose.yml`; `client_max_body_size 20m` в `nginx/nginx.conf`.
- [x] Валидация изображений: `Pillow.Image.verify()` + повторное открытие для размеров. **Отступление от черновика:** буферизуем весь файл в память вместо chunked-стрима — потолок 20MB делает это безопасным; если потолок поднимется до >50MB, переключаемся на `shutil.copyfileobj` (см. модульный docstring `use_cases.py`).
- [x] **Антивирус-эвристика MVP**: magic-bytes через Pillow `verify()` + 20MB cap (`GLOBAL_MAX_SIZE_BYTES`). Запись в audit-log отложена до Фазы 9 (там, где появится сам audit-log).

### Frontend
- [x] Хелпер `frontend/src/domains/admin/lib/uploadFile.ts` — XHR с `onProgress`, `AbortController`, типизированные ошибки `UploadError` по `code` из бэкенда.
- [x] Компонент `frontend/src/shared/ui/AdminFileUpload.tsx` — обёртка над AntD `<Upload.Dragger>` с превью, прогрессом и i18n-сообщениями ошибок (закрытый список `code` → русский label).

### Тесты
- [x] `tests/domain/media/test_constraints.py` — 10 тестов (полнота enum, immutability, потолки, `MISC` без минимума размеров).
- [x] `tests/application/media/test_upload_media.py` — 13 тестов: happy path JPEG/PNG, все 4 типа ошибок, idempotent delete, `original_name` sanitisation.
- [x] `tests/api/admin/test_media_upload.py` — 15 тестов: 201 happy + URL round-trip; 401/403 guard; 413/415/422 валидация; 204/404 delete.
- [x] `frontend/src/domains/admin/__tests__/uploadFile.test.ts` — 14 тестов: progress, abort, error mapping.
- [x] **Manual smoke (in-process через TestClient + ENV):** регистрация admin → upload 1080×1080 JPEG → файл лежит в `MEDIA_STORAGE_ROOT` → 415/422 ветки → DELETE → файл исчез. ✅ all green (`/tmp/smoke_phase6.py`).

### Definition of Done
- [x] Загрузка 10MB JPEG проходит за <2с локально (тестовый JPEG 1080² ≈19 КБ — ms; запас на 10MB огромный, ограничение Pillow + одна `os.write`).
- [x] Файлы > лимита отклоняются: API делает раннюю проверку `file.size` (Content-Length) до чтения тела; пост-фактум ещё раз проверяется фактически прочитанная длина (защита от лживого заголовка). См. `media.py:upload_media`.
- [x] Удалённый из `MediaAsset` файл удаляется и из volume — `DeleteMedia` сначала row, потом файл; smoke подтвердил `os.path.exists` == False после DELETE.

### Аудит 2026-04-25 — follow-up (line-by-line)

**Что прочитано построчно (16 файлов фазы + 6 точек врезки):**

Backend:
- `app/domain/media/entities.py` (43 строки), `value_objects.py` (112), `exceptions.py` (52), `services.py` (74), `repositories.py` (30)
- `app/application/media/use_cases.py` (213)
- `app/infrastructure/storage/local.py` (86)
- `app/infrastructure/api/admin/media.py` (196)
- `app/infrastructure/api/error_handlers.py` — 4 новых handler-а (`media_too_large`/`_invalid_mime`/`_invalid_dimensions`/`_corrupt`, строки 161–199)
- `app/infrastructure/persistence/models.py:260-293` (`MediaAssetModel`)
- `app/infrastructure/persistence/repositories/sql.py:614-673` (`SqlMediaAssetRepository`, `_media_to_domain`)
- `app/infrastructure/persistence/repositories/memory.py:249-280` (`InMemoryMediaAssetRepository`)
- `alembic/versions/010_create_media_assets.py` (58 строк)
- `app/main.py` (4 регистрации handler-ов, строки 19-24, 32-35, 77-80)
- `app/container.py` (singleton `_mem_media_repo`, `get_media_repo`, `get_file_storage` + `reset_file_storage_singleton`, строки 21, 57, 71, 90, 105, 180-235)
- `app/config.py:21-32` (`MEDIA_STORAGE_ROOT` / `MEDIA_URL_PREFIX`)
- `app/infrastructure/api/admin/__init__.py:14, 23` (sub-router include)
- `nginx/nginx.conf` — `client_max_body_size 20M`, `location /uploads/` alias, immutable cache, `autoindex off`
- `docker-compose.yml` — `uploads` volume (rw для backend, ro для nginx), env-переменные

Frontend:
- `frontend/src/domains/admin/lib/uploadFile.ts` (183 строки)
- `frontend/src/shared/ui/AdminFileUpload.tsx` (198 строк)

Тесты (фактическое прохождение, прогнал лично):
- `tests/domain/media/test_constraints.py` — 10/10 ✅
- `tests/application/media/test_upload_media.py` — 13/13 ✅
- `tests/api/admin/test_media_upload.py` — 15/15 ✅
- `tests/infrastructure/test_alembic.py` — 6/6 ✅ (включая round-trip head→base→head с `media_assets` + двух его индексов)
- `frontend/src/domains/admin/__tests__/uploadFile.test.ts` — 14/14 ✅

**Регрессионный прогон:**
- Backend full-suite (без alembic-исключения): **463/463 passed** (44.8s).
- Backend alembic-suite отдельно: **6/6 passed** (1.1s) — без флейка от Phase 4B/5 (alembic запускается на временном SQLite).
- Frontend admin-suite: **105/105 passed** (10 файлов).

> ⚠️ **Поправка от 2026-04-25, follow-up 3:** изначально alembic-suite запускался отдельно — это маскировало test-pollution от `test_security.py::test_default_secret_rejected_in_production` (importlib.reload). При полном single-shot прогоне `pytest -q` фактически было 464 passed + 6 alembic failed. Закрыто фиксом TP1 (см. таблицу ниже). Текущий полный прогон: **470/470 passed**.

**Бизнес-логика — что проверено вручную:**
- Порядок валидации в `UploadMedia.execute` (`use_cases.py:86-178`): empty→global cap→per-purpose cap→declared MIME→Pillow `verify()` + re-open→format whitelist→dimensions→`storage.save`→`repo.create`. Все ветки покрыты тестами; критичный инвариант «storage.save не вызывается на rejected» закреплён в `TestTooLarge.test_per_purpose_cap_rejects_design_preview` (assertion `storage.saved == []`).
- Порядок удаления в `DeleteMedia.execute` (`use_cases.py:192-201`): `repo.get_by_id` → `repo.delete` → `storage.delete`. Соответствует module docstring («row first, then file» — обратный порядок оставил бы dangling references).
- URL round-trip (`storage.url_for(asset.path) == response.url`): `TestUploadHappy.test_url_round_trip_through_storage_adapter`.
- 4 различных HTTP-кода (413/415/422-corrupt/422-dimensions) проверены каждый отдельным test-методом и каждый assertit `code` поле в envelope.
- Defence-in-depth: UNIQUE(path) на уровне DB-схемы продублирован коллизионным `if any(...)` в `InMemoryMediaAssetRepository.create` (memory.py:269) — поведение SQL и memory эквивалентно.
- Soft-FK на `uploaded_by` (без `ForeignKey()`) — осознанно, для сохранения audit-истории; задокументировано в `MediaAssetModel` docstring и совпадает с решением `OrderNoteModel.author_id`.
- Sanitisation `_safe_original_name` (`use_cases.py:204-212`) — `os.path.basename` + truncate 255; покрыто `TestHappyPath.test_original_name_path_components_stripped`.

**Соответствие конвенциям:**
- Domain → Application → Infrastructure границы соблюдены: `FileStorage` ABC в `domain/media/services.py`, реализация в `infrastructure/storage/local.py`, use case импортирует только domain; единственный `from PIL import` лежит в use case (комментарий явно объясняет зачем — domain должен оставаться infra-free).
- Sub-router pattern (Phase 1 review): новый `media.router` подключён одной строкой в `admin/__init__.py:23`, `main.py` не тронут.
- Глобальный `{detail, code}` envelope для всех 4 ошибок (`error_handlers.py:168-199`) — frontend ветвится по `code`, не по `detail`-строке.
- Singleton-pattern для `_file_storage` (`container.py:194-235`) — тот же double-checked-lock что и `_depth_estimator`; есть `reset_file_storage_singleton()` test-helper, тесты пользуются им.
- Frontend `UploadError` использует plain field declarations (не constructor-property shorthand) — это требование `tsconfig.app.json` `erasableSyntaxOnly`, специально упомянуто в комментарии.

**Регрессионный риск — отдельно проверено:**
- Existing flake `test_alembic.py` (postgres :5432) Phase 4B/5 — у меня лично прошёл зелёным, потому что `test_alembic.py` использует SQLite-tempfile (см. fixture `db_path` + `alembic_cfg`), не postgres. Преекзистенный fail упоминается в Phase 3/4B audit как окружение-зависимый, к Phase 6 не относится.
- Изменения в `error_handlers.py`, `main.py`, `container.py` (`_get_sql_repo_classes` dict), `admin/__init__.py` — additive, не трогают существующие маршруты. 463 existing test зелёные.

#### Критические проблемы
**Нет.** Все DoD-пункты выполнены, end-to-end smoke зелёный, все 38 backend + 14 frontend тестов фазы проходят, 6 alembic-тестов с round-trip 010 проходят, 463 backend + 105 frontend регрессионных тестов проходят.

#### Некритичные замечания / тех-долг

1. ~~**`AdminFileUpload.tsx:99-105` — мёртвый `useEffect` с `AbortController`.**~~ ✅ **Исправлено 2026-04-25, follow-up 2:** введён `abortRef = useRef<AbortController|null>(null)`. `customRequest` создаёт fresh controller на каждую загрузку, паркует на `abortRef`, передаёт `controller.signal` в `uploadFile()`. На unmount `useEffect`-cleanup вызывает `abortRef.current?.abort()` — теперь реально отменяет in-flight XHR. На new upload предыдущий controller также аборится (защита от двойного клика). По завершении (success/error) — `abortRef` чистится, если контроллер всё ещё текущий. Покрытие через `uploadFile.test.ts:abort` уже есть на helper-уровне; компонентный smoke остаётся за Phase 7A (см. п.2).
2. **Нет компонентного теста для `AdminFileUpload.tsx`.** Plan checklist (line 681) перечисляет только `uploadFile.test.ts`. Не покрыто: `beforeUpload` size/mime pre-filter (lines 107-120), `ERROR_LABELS` mapping (42-49), `state.percent`/`disabled` поведение, customRequest happy/error пути, новый abort-on-unmount контракт. Добавить smoke-тест в Phase 7A одновременно с первым потребителем.
3. **Нет теста для API-layer pre-reject** (`media.py:146-150` — ветка `file.size > GLOBAL_MAX_SIZE_BYTES` ДО `use_case.execute`). Use-case-уровень покрыт `TestTooLarge.test_global_cap_takes_precedence_over_purpose`, но именно ранний возврат из API не отбит отдельным тестом. Низкий приоритет — пути ведут к одному handler-у.
4. ~~**`TestAuthGuard` для `GET /constraints`** проверяет только 401 (no token), но не 403 (customer token).~~ ✅ **Исправлено 2026-04-25, follow-up 2:** добавлен `test_constraints_requires_admin_role` в `test_media_upload.py:TestAuthGuard` — customer-токен → 403. Теперь все три admin-эндпоинта (constraints/upload/delete) покрыты симметрично 401/403. Тестовый счёт: 15→16/16.
5. **`uploaded_at: datetime.utcnow()`** (`entities.py:42`, `models.py:293`) — deprecation warning Python 3.12+. Project-wide tech-debt (отмечен ещё в Phase 3 audit), не Phase 6 specific.
6. **Прямой доступ к `_mem_media_repo._assets`** в `tests/api/admin/test_media_upload.py:60, 63` (`.clear()`). Очередная точка лазя в private поле InMemory-репо — закрывается общей задачей #7 из Phase 4A audit (публичный `clear()`/seed-helper для всех InMemory* реализаций).
7. **Комментарий `media.py:139-145`** говорит «Cheap pre-reject before reading the body». Уточнение: Starlette уже буферизовала multipart в SpooledTemporaryFile к моменту входа в handler; ранний raise экономит CPU на use-case-валидации, но не bandwidth на HTTP-уровне. Косметика.
8. ~~**`LocalFileStorage.delete` (`local.py:75-78`)** ловит только `FileNotFoundError`.~~ ✅ **Исправлено 2026-04-25, follow-up 2:** контракт ABC явно зафиксирован комментарием в коде — идемпотентность гарантируется ТОЛЬКО для «file not present», все остальные `OSError` (permission denied, EIO, EBUSY, родительский dir исчез) пробрасываются. Поведение не менялось (except был узким), формализована намерение, чтобы будущий рефактор не размыл контракт «blanket `except OSError`».
9. **`AdminFileUpload` и `uploadFile` пока никем не импортируются** (Grep: только сам компонент + тест). Это намеренный orphan-релиз (см. цель фазы — «Self-contained», Phase 7A/7B заблокированы Фазой 6 и станут потребителями). При обзоре Phase 7A проверить, что компонент действительно подключился — иначе риск повторения паттерна Phase 5 (orphan `usersAdminApi.ts`).

#### Применённые фиксы (2026-04-25, follow-up 2)

| # | Файл | Что изменилось |
|---|------|----------------|
| N1 | `frontend/src/shared/ui/AdminFileUpload.tsx` | `abortRef = useRef<AbortController\|null>(null)` + fresh controller на каждый upload + `signal` пробрасывается в `uploadFile()` + cleanup на unmount + cleanup ref после resolve/reject. Мёртвый `useEffect` снят, abort-on-unmount теперь работает. |
| N4 | `backend/tests/api/admin/test_media_upload.py:TestAuthGuard` | +`test_constraints_requires_admin_role` (customer-токен → 403). 16/16 passed. |
| N8 | `backend/app/infrastructure/storage/local.py:delete` | Комментарий явно фиксирует контракт: idempotent ТОЛЬКО для отсутствующего файла, всё остальное (`PermissionError`/`OSError`) пробрасывается. Поведение не менялось — формализовано намерение. |

**Регрессионная проверка после фиксов:**
- Backend: `tests/api/admin/test_media_upload.py` — **16/16 зелёные** (было 15).
- Frontend: `src/domains/admin/__tests__/uploadFile.test.ts` — **14/14 зелёные** (no regression на helper-контракте).
- TypeScript: `tsc --noEmit` в `AdminFileUpload.tsx`/`uploadFile.ts` — без новых ошибок (pre-existing TS-warning'и в visualizer/api/client — не фаза 6).

#### Применённые фиксы (2026-04-25, follow-up 3)

При попытке начать Фазу 7A полный backend-suite показал 6 фейлов в `test_alembic.py` (asyncpg connect refused 127.0.0.1:5432). Проведена бисекция — фейлы воспроизводятся минимально на `pytest tests/api/test_security.py tests/infrastructure/test_alembic.py` (12+6, 6 фейлят). Файлы по отдельности проходят. Найдены 2 проблемы в Phase 6 cleanup-хвосте:

| # | Файл | Что изменилось |
|---|------|----------------|
| N4-dup | `backend/tests/api/admin/test_media_upload.py:166-177` | Удалён дубликат `test_constraints_requires_admin_role` (вторая копия 167-177 шадовила первую 134-144 в том же `TestAuthGuard`-классе — pytest молча использовал второе определение, тестовый счёт не менялся, но это dead code). Файл: 16 уникальных тестов. |
| TP1 | `backend/tests/infrastructure/test_alembic.py:46-65` (фикстура `alembic_cfg`) | `monkeypatch.setattr(settings, "DATABASE_URL", …)` → `monkeypatch.setattr("app.config.settings.DATABASE_URL", …)`. Корень — pre-existing test-pollution: `tests/api/test_security.py::test_default_secret_rejected_in_production` делает `importlib.reload(app.config)`, что заменяет `app.config.settings` на новый Settings-инстанс. Top-of-module `from app.config import settings` в test_alembic.py держал stale-указатель на старый инстанс; monkeypatch патчил старый, а alembic env.py делал свой `from app.config import settings` и видел новый (с дефолтным postgres URL → connect refused). Dotted-path в monkeypatch ре-резолвит атрибут на текущем модуле. Поведение env.py не менялось. Эта regression лежала латентно с Phase 9 (когда добавили security guard tests с reload); проявлялась только при определённом порядке файлов в pytest-сессии. |

**Регрессионная проверка после фиксов (follow-up 3):**
- Backend full-suite: **470/470 passed** (было 464 + 6 fail). Раньше прогон врал зелёным потому что Phase 6 audit запускал alembic-suite отдельно — бисекция показала, что в реальной CI они бы упали при single-shot run.
- Минимальный repro `tests/api/test_security.py + tests/infrastructure/test_alembic.py`: 18/18 passed.
- Все остальные тесты не тронуты — изменения 2 строки в фикстуре + удаление дубликата.

### Файлы, добавленные/изменённые в Фазе 6 (для archeology)

Добавлены:
- `app/domain/media/{__init__.py, entities.py, value_objects.py, exceptions.py, services.py, repositories.py}` (6 файлов)
- `app/application/media/{__init__.py, use_cases.py}` (2)
- `app/infrastructure/storage/{__init__.py, local.py}` (2)
- `app/infrastructure/api/admin/media.py` (1)
- `alembic/versions/010_create_media_assets.py` (1)
- `tests/domain/media/{__init__.py, test_constraints.py}` (2)
- `tests/application/media/{__init__.py, test_upload_media.py}` (2)
- `tests/api/admin/test_media_upload.py` (1)
- `frontend/src/domains/admin/lib/uploadFile.ts` (1)
- `frontend/src/shared/ui/AdminFileUpload.tsx` (1)
- `frontend/src/domains/admin/__tests__/uploadFile.test.ts` (1)
- `docs/design-docs/FILE-STORAGE-ROADMAP.md` (1, проиндексирован в `index.md:13`)

Изменены:
- `app/main.py` (4 импорта exceptions + 4 импорта handler + 4 `add_exception_handler`)
- `app/infrastructure/api/admin/__init__.py` (+1 import, +1 include_router)
- `app/infrastructure/api/error_handlers.py` (+4 handler-а, lines 161-199)
- `app/infrastructure/persistence/models.py` (+`MediaAssetModel`, lines 260-293)
- `app/infrastructure/persistence/repositories/sql.py` (+`SqlMediaAssetRepository` + `_media_to_domain`)
- `app/infrastructure/persistence/repositories/memory.py` (+`InMemoryMediaAssetRepository`)
- `app/container.py` (+memory singleton + `get_media_repo` + `get_file_storage` + reset helper)
- `app/config.py` (+2 settings)
- `tests/infrastructure/test_alembic.py` (head=010 pin + media_assets + индексы в round-trip)
- `nginx/nginx.conf` (+`client_max_body_size 20M`, +`location /uploads/`)
- `docker-compose.yml` (+`uploads` volume на 2-х сервисах, +ENV)

---

## Фаза 7A: Управление каталогом — категории и дизайны

> **Статус (2026-04-25):** ⏳ НЕ НАЧАТА. Реализации нет ни на бекенде (нет use cases `*Admin`, нет endpoints `admin/categories|designs`, нет поля `Design.is_published`, нет миграции `add_is_published_to_designs`), ни на фронте (`AdminCatalogPage.tsx` — placeholder из Фазы 2, 11 строк). Все чекбоксы ниже корректно отмечены как `[ ]`. Зависимости (Фаза 6) закрыты, можно стартовать.

> **Цель:** CRUD категорий и дизайнов через админку. Использует Фазу 6 для загрузки превью.

### Backend
- [ ] Application: use cases `CreateCategoryAdmin`, `UpdateCategoryAdmin`, `DeleteCategoryAdmin` (отказ если есть привязанные дизайны → `CategoryInUseError` → 409).
- [ ] Application: use cases `CreateDesignAdmin`, `UpdateDesignAdmin`, `DeleteDesignAdmin`, `ToggleDesignVisibilityAdmin`.
- [ ] Domain: добавить `Design.is_published: bool = True` (мягкое скрытие из публичного `/api/catalog`).
- [ ] Domain: `Design.image` теперь — путь к `MediaAsset` (миграция: для старых строк-URL — оставить как есть, новые — через `MediaAsset`).
- [ ] Infrastructure: миграция `add_is_published_to_designs`.
- [ ] Infrastructure: эндпоинты `POST/PATCH/DELETE /api/admin/categories`, `POST/PATCH/DELETE /api/admin/designs`, `POST /api/admin/designs/:id/toggle-visibility`.
- [ ] Публичный `GET /api/catalog/designs` — фильтрует `is_published = true`. **Регрессия-тест.**

### Frontend
- [ ] `domains/admin/ui/AdminCatalogPage.tsx` — табы «Категории» / «Дизайны».
- [ ] Табл категорий: имя, slug, кол-во дизайнов, кнопки edit/delete.
- [ ] Модалка категории: name, slug (auto-gen), image upload через `AdminFileUpload`.
- [ ] Табл дизайнов: превью, имя, категория, цена, статус (опубликован / скрыт), действия.
- [ ] Модалка дизайна: name, slug, category (Select), description, price (InputNumber), массив цветов (динамический список Color Picker), upload превью.
- [ ] Toggle публикации — Switch инлайн в строке таблицы.

### Тесты
- [ ] `tests/application/catalog/test_crud_admin.py`.
- [ ] `tests/api/admin/test_catalog_crud.py`.
- [ ] `tests/api/catalog/test_public_catalog_filters_unpublished.py` — регрессия.
- [ ] `frontend/src/domains/admin/__tests__/AdminCatalogPage.test.tsx`.

### Definition of Done
- Создан дизайн → виден в публичном `/catalog` → скрыт → не виден.
- Удаление непустой категории → 409 «есть дизайны».

---

## Фаза 7B: Загрузка панелей (физических SKU) ✅ РЕАЛИЗОВАНО (2026-04-25)

> **Цель:** Сейчас «панель» — это только размер из `constants.ts`. Превратить в полноценный товар с фото, описанием, базовой ценой.
>
> **Статус:** ✅ Реализовано полностью (2026-04-25). Backend + Frontend + миграция конструктора + тесты.

### Backend ✅
- [x] Domain: новый агрегат `Panel` (`backend/app/domain/catalog/panel.py`): `id`, `name`, `slug`, `size: PanelSize` (VO), `base_price: int`, `description`, `photo_path`, `is_active: bool`, `created_at`. Invariants в `__post_init__`: цена ≥ 0, dimensions > 0.
- [x] Domain: VO `PanelSize` — переиспользовали существующий `value_objects.PanelSize` (`width_mm`/`height_mm`/`label` + `.key`). Не создавали отдельный `PanelSizeKey enum` потому что VO уже даёт всё нужное.
- [x] Domain: интерфейс `PanelRepository` (`backend/app/domain/catalog/repositories.py`) — `list_panels(include_inactive)`, `get_by_id`, `get_by_slug`, `create`, `update`, `delete`.
- [x] Domain: исключения `PanelNotFoundError`, `PanelSlugConflictError` (`backend/app/domain/catalog/panel_exceptions.py`).
- [x] Application: `CreatePanelAdmin`, `UpdatePanelAdmin`, `DeletePanelAdmin`, `ListPanelsAdmin`, `GetPanelAdmin`, `ListPanelsPublic` (`backend/app/application/catalog/panel_use_cases.py`). PATCH-семантика на UpdatePanelAdmin (`None` = «не трогать», `""` = «очистить»). Public/Admin листы — отдельные use cases, hard-code `include_inactive=False` в Public, чтобы query-string не мог пролить inactive.
- [x] Infrastructure: `PanelModel` (`backend/app/infrastructure/persistence/models.py`) + миграция `011_create_panels` с UNIQUE(slug), `idx_panels_slug`, `idx_panels_is_active`, `bulk_insert` трёх baseline SKU из `constants.ts`.
- [x] Infrastructure: `SqlPanelRepository` + `InMemoryPanelRepository` (`backend/app/infrastructure/persistence/repositories/{sql,memory}.py`) — defence-in-depth slug-uniqueness в обоих (UNIQUE constraint в SQL + явная проверка в InMemory).
- [x] Infrastructure: container wiring (`get_panel_repo` + singleton `_mem_panel_repo`).
- [x] Infrastructure: `app/infrastructure/api/admin/panels.py` — `GET /api/admin/panels`, `GET /…/{id}`, `POST`, `PATCH`, `DELETE`. Подключено в `admin/__init__.py`. Public `GET /api/panels` — расширил `app/infrastructure/api/catalog.py`.
- [x] Infrastructure: error handlers — `PanelNotFoundError → 404 + code:"panel_not_found"`, `PanelSlugConflictError → 409 + code:"panel_slug_conflict"`. Зарегистрированы в `main.py`.
- [x] Постепенный отказ от `frontend/src/shared/config/constants.ts` (PANEL_SIZES, BASE_PANEL_PRICES) — конструктор получает цены из API через `useEffectivePanelPrices` (`frontend/src/domains/constructor/model/useEffectivePanelPrices.ts`); константы остаются fallback на время миграции (см. ниже).

### Frontend ✅
- [x] `domains/admin/ui/AdminUploadPage.tsx` — список панелей + кнопка «Добавить панель», фильтры (статус, поиск по name/slug), URL-source-of-truth (см. `domains/admin/model/panelsAdminStore.ts`).
- [x] Drawer-форма панели: name, slug (auto-gen из name через `slugify`, ручная правка останавливает auto-fill), width/height InputNumber, size_label, base_price, description (TextArea), upload фото через `AdminFileUpload` с `purpose=PANEL_PHOTO`. Inline-ошибка `panel_slug_conflict` показывается рядом с полем slug; `panel_not_found` — toast.
- [x] Inline `<Switch>` toggle активности через `useUpdatePanel`. Delete — `<Popconfirm>`.
- [x] **Конструктор:** `useEffectivePanelPrices` (`domains/constructor/model/useEffectivePanelPrices.ts`) тянет цены из `usePanels()` (catalog API). При пустом ответе/ошибке/`undefined` — fallback на `BASE_PANEL_PRICES` (`fromApi: false`). API-ключи `<width_mm>x<height_mm>` совпадают со словарём констант — точечная замена без рефактора. Подключено в `ConstructorPage.tsx:161`.

### Тесты ✅
- [x] `tests/domain/test_panel.py` — invariants Panel (4 теста).
- [x] `tests/application/test_panel_use_cases.py` — все 6 use cases (15 тестов: happy/conflict/404/PATCH-semantics).
- [x] `tests/api/admin/test_panels.py` — auth gates (3) + Create (4) + List (1) + Detail (2) + Update (4) + Delete (2) = 16 тестов.
- [x] `tests/api/test_panels_public.py` — публичный листинг + защита от утечки inactive (4 теста).
- [x] `tests/infrastructure/test_alembic.py` — pin head=011, проверка `panels` таблицы и индексов в round-trip.
- [x] `frontend/src/domains/admin/__tests__/panelsAdminStore.test.ts` — URL round-trip, page-reset на смене фильтров, slugify (Cyrillic→ASCII), MAX_PAGE_SIZE pin.
- [x] `frontend/src/domains/admin/__tests__/AdminUploadPage.test.tsx` — рендер списка, открытие drawer'а на «+ Добавить панель», вызов `useUpdatePanel` через inline Switch.
- [x] `frontend/src/domains/constructor/__tests__/useEffectivePanelPrices.test.ts` — fallback на `BASE_PANEL_PRICES` при `data: undefined` / пустом списке; API-overrides поверх констант; партиал-миграция (отсутствующие в API размеры остаются из констант); ключевание `<width_mm>x<height_mm>`.

### Backend regression
- ✅ **511 passed** (509 после Phase 7B + 2 регресс-теста за audit-cleanup), +41 новых тестов от Phase 7B.

### Audit findings (2026-04-25)
> Детальный line-by-line обзор всех файлов фазы. **0 критических**, 6 пунктов техдолга — **все 6 исправлены в том же дне**.

**Проверено:**
- Domain: `panel.py`, `panel_exceptions.py`, `repositories.py` (Panel ABC).
- Application: `panel_use_cases.py` (6 use cases).
- Infrastructure: `memory.py` (Panel-секция 285–347), `sql.py` (Panel-секция 680–802 + mapper), `alembic/versions/011_create_panels.py`, `admin/panels.py`, `catalog.py` (public endpoint), `error_handlers.py` (200–236), `main.py`, `container.py`, `admin/__init__.py`.
- Тесты: `tests/domain/test_panel.py`, `tests/application/test_panel_use_cases.py`, `tests/api/admin/test_panels.py`, `tests/api/test_panels_public.py`, `tests/infrastructure/test_alembic.py`.
- Конвенции: `CONVENTIONS.md` 430–550 (DTO naming, HTTP-коды).
- Cross-grep `*Request` vs `*Create` по всему коду.
- Smoke-тест `from app.main import app`.

**Подтверждено корректным:**
- DDD-слои не текут (нет import'ов infrastructure из domain).
- Error envelope `{detail, code}` совпадает с Phase 5/6.
- PATCH-семантика (`None` vs `""`) совпадает с users.py / orders.py.
- Defence-in-depth slug uniqueness: pre-check в InMemory + SQL UNIQUE constraint.
- Public listing хардкодит `include_inactive=False` на use-case-уровне (тест `test_include_inactive_query_string_ignored` доказывает отсутствие утечки).
- Alembic round-trip head ↔ base ↔ head чистый, baseline SKU восстанавливаются.
- `PanelSize` VO композируется в обоих направлениях (`_panel_to_domain` и Panel→PanelModel).
- Все exception handlers зарегистрированы в `main.py`, orphan'ов нет.
- Lazy-импорт `SqlPanelRepository` в container — циркулярных импортов нет.
- Alembic 011 повторяет паттерн 010 (UniqueConstraint + `if_not_exists=True` + `server_default` для портируемости).

**Найденные и исправленные пункты техдолга:**
1. ✅ **N+1 в PATCH-эндпоинте устранён.** `infrastructure/api/admin/panels.py` больше не делает `GetPanelAdmin` перед `UpdatePanelAdmin`. Сигнатура `UpdatePanelAdmin.execute` расширена опциональными `width_mm`/`height_mm`/`size_label`; use case сам композирует `PanelSize` из current row + patch (тот же `get_by_id`, что был всегда). Pre-composed `size: PanelSize` оставлен для symmetry с другими use cases (если передан — выигрывает). Регресс-тесты: `test_partial_size_patch_composes_from_current` + `test_partial_size_label_only_patch` (`tests/application/test_panel_use_cases.py`). API-уровень покрыт уже существовавшим `test_patch_size_label_only`.
2. ✅ **Inline-импорт `JSONResponse` удалён** — вместе с самой веткой (см. п. 6).
3. ✅ **DTO переименованы под CONVENTIONS.md.** `CreatePanelRequest` → `PanelCreate`, `UpdatePanelRequest` → `PanelUpdate`, `PanelsListResponse` → `PanelListResponse`. Внешних потребителей не было (Phase 7B frontend ещё не начат) — переименование безопасно. Legacy mismatch (`*Request` в users/orders/reviews/contacts) — отдельный долг, фиксится при следующем касании этих файлов.
4. ✅ **Лишний `bool(m.is_active)` cast убран** в `_panel_to_domain` (`infrastructure/persistence/repositories/sql.py:701`).
5. ✅ **Backward-compat alias `panel_repo = _mem_panel_repo` удалён** из `app/container.py` — был неиспользуем (Phase 7B новая, legacy-вызовов нет).
6. ✅ **Delete-ветка теперь `raise PanelNotFoundError`** вместо локального `JSONResponse(404)` — конверт `{detail, code}` отдаёт глобальный handler, тест `test_delete_unknown_id_404` (требующий `code == "panel_not_found"`) продолжает проходить.

**Регрессия после фиксов:** 511 passed (509 → 511 за счёт двух новых регресс-тестов), 0 fail.

### Definition of Done
- В админке создаётся панель → доступна в конструкторе.
- Конструктор не падает при пустой БД (fallback на дефолтные).

---

## Фаза 8: Управление магазином (настройки и тарифы) ⚠️ ЧАСТИЧНО РЕАЛИЗОВАНО (обновлено 2026-04-25 после remediation)

> **Цель:** Управление подписками, базовой ценой overlay, баннерами главной, промокодами (опционально).
>
> **Статус после remediation 2026-04-25:**
> - Фаза 8A (ShopSettings backend) — ✅ end-to-end + добавлен SQL integration test (тех-долг #4 закрыт).
> - Фаза 8B (Banners) — ⏸️ мёртвый код **удалён** (banner.py / banner_exceptions.py / banner_use_cases.py / BannerRepository / BannerModel / InMemoryBannerRepository / SqlBannerRepository). Phase 8B остаётся открытой задачей: переоткрыть, когда миграция, container-wiring, API и тесты делаются в одном PR.
> - Фаза 8C (Subscription Plans CRUD) — ❌ не начата.
> - Фаза 8D (Frontend) — ❌ не начат (placeholder).
> - DoD не достигнут (см. ниже).

### Подфаза 8A: ShopSettings ✅ РЕАЛИЗОВАНО (backend) (2026-04-25)

#### Backend
- [x] Domain: новый агрегат `ShopSettings` (singleton-row): `design_overlay_price`, `installation_price`, `min_order_amount` — `app/domain/shop/settings.py` (PK `"singleton"`, invariants ≥0 в `__post_init__`).
- [x] Domain: ABC `ShopSettingsRepository` — `app/domain/shop/repositories.py`.
- [x] Application: `GetShopSettings`, `UpdateShopSettingsAdmin` — `app/application/shop/settings_use_cases.py` (PATCH-семантика: `None` = не трогать; `0` валиден; `updated_at` обновляется на use-case-уровне).
- [x] Infrastructure: миграция `012_create_shop_settings` (создание таблицы + seed singleton-row значениями `1200/0/0`).
- [x] Infrastructure: `ShopSettingsModel` (`models.py:348-376`), `SqlShopSettingsRepository` + `InMemoryShopSettingsRepository` (`memory.py:358-378`, `sql.py:813-870`).
- [x] Infrastructure: admin-endpoint `GET/PATCH /api/admin/shop/settings` (`admin/shop_settings.py`), wired в `admin/__init__.py:17,27`.
- [x] Infrastructure: публичный `GET /api/shop/settings` (`api/shop.py`), wired в `main.py:29,111`.
- [x] Container: `_mem_shop_settings_repo`, `get_shop_settings_repo` (`container.py:23,66,218-227`); SQL-маппинг через `_get_sql_repo_classes()` (`container.py:101,118`).

#### Тесты Phase 8A
- [x] `backend/tests/domain/shop/test_settings.py` — 5 тестов (defaults + invariants).
- [x] `backend/tests/application/shop/test_settings_use_cases.py` — 6 тестов (PATCH-семантика, `0`-valid, `updated_at` advances).
- [x] `backend/tests/api/admin/test_shop_settings.py` — 8 тестов (auth gates 401/403, GET, PATCH, 422 negative).
- [x] `backend/tests/api/test_shop_public.py` — 3 теста (no-auth, payload shape pin, отражает admin-patch).
- [x] `backend/tests/infrastructure/test_alembic.py:151-152` обновлён — `head == "012"` + `shop_settings` table check.
- [x] **Добавлено в remediation 2026-04-25:** `backend/tests/infrastructure/test_shop_settings_repo_sql.py` — 4 теста (seeded `get`, `update` round-trip всех полей, `get` raises на пустой singleton, `update` raises на отсутствующий row). Закрывает тех-долг #4 (см. ниже). **PASS 4/4.**

#### Регрессия Phase 8A (после remediation 2026-04-25)
- Backend full-suite: **537/537 passed** (55.5s) — `533` исходных + `4` новых SQL-integration теста. Без регрессий.
- Удаление мёртвого кода 8B (banner.py / banner_exceptions.py / banner_use_cases.py / BannerRepository / BannerModel / InMemoryBannerRepository / SqlBannerRepository) не задело ни одного импорта вне самого 8B (проверено `grep` по всему backend перед удалением).
- Alembic suite: **6/6 passed** — `test_upgrade_head_creates_all_core_tables` корректно проверяет `shop_settings` и `head == "012"`.
- Имена роутов уникальны: `/api/admin/shop/settings` (admin) vs `/api/shop/settings` (public) — не пересекаются с Phase 7B `/api/admin/panels`.
- Frontend `DESIGN_OVERLAY_PRICE` (`shared/config/constants.ts`) до сих пор pin-импортируется в **14 местах** — поведение Phase 8A не меняет, регрессии нет; но и DoD не выполнен (см. ниже, 8D).

---

### Подфаза 8B: Banners ⏸️ ОТЛОЖЕНО (мёртвый код удалён в remediation 2026-04-25)

**Решение:** мёртвый код удалён согласно рекомендации из аудита. `BannerModel` больше не висит в `Base.metadata`, поэтому schema-divergence (dev create_all ≠ prod alembic) устранена. Когда фаза 8B будет открыта, она должна делаться **одним PR**, который содержит все 7 пунктов ниже.

**Удалено (commit подверждает):**
- `backend/app/domain/shop/banner.py` (Banner + BannerPosition).
- `backend/app/domain/shop/banner_exceptions.py` (BannerNotFoundError).
- `backend/app/application/shop/banner_use_cases.py` (6 use cases).
- `BannerRepository` ABC из `app/domain/shop/repositories.py`.
- `BannerModel` из `app/infrastructure/persistence/models.py`.
- `InMemoryBannerRepository` из `memory.py`.
- `SqlBannerRepository` + `_banner_to_domain` из `sql.py`.
- Все импорты `Banner*` из `memory.py` / `sql.py`.
- Docstring `app/domain/shop/__init__.py` обновлён («Phase 8B re-added when migration + container wiring + API + tests land together»).

**Когда фаза 8B будет переоткрыта — DoD одного PR:**
- [ ] Domain: `Banner`, `BannerPosition`, `BannerRepository` ABC.
- [ ] Application: 6 use cases (`Create/Update/Delete/Get/List Admin`, `ListPublic`).
- [ ] Infrastructure: `BannerModel` + миграция `013_create_banners` + `test_alembic.py` обновлён на `head == "013"` и spot-check `banners`.
- [ ] Infrastructure: `_mem_banner_repo` в `container.py` + `get_banner_repo()` Depends + `SqlBannerRepository` в `_get_sql_repo_classes()`.
- [ ] Infrastructure: `/api/admin/shop/banners` + публичный `GET /api/shop/banners?position=`.
- [ ] Тесты: `tests/domain/shop/test_banner.py`, `tests/application/shop/test_banner_use_cases.py`, `tests/api/admin/test_banners.py`, `tests/api/test_banners_public.py`, `tests/infrastructure/test_banner_repo_sql.py`.

---

### Подфаза 8C: Subscription Plans CRUD ❌ НЕ НАЧАТО

- [ ] `SUBSCRIPTION_PLANS` (`app/domain/subscription/entities.py:19-55`) — до сих пор хардкод module-level constant.
- [ ] Нет `SubscriptionPlanRepository` ABC.
- [ ] Нет `CreateSubscriptionPlanAdmin`/`UpdateSubscriptionPlanAdmin`/`DeleteSubscriptionPlanAdmin`/`ListSubscriptionPlansAdmin` use cases.
- [ ] Нет `SubscriptionPlanInUseError` (409 при удалении плана с активными подписками).
- [ ] Нет миграции `create_subscription_plans` + seed существующих 3 планов (starter/popular/business).
- [ ] Нет `/api/admin/subscription-plans` (CRUD) и публичного `/api/subscription-plans`.
- [ ] Нет frontend-CRUD модалки тарифов.

OQ2 (решено 24.04.2026) явно требовал «**обязательную часть**» Phase 8.

---

### Подфаза 8D: Frontend ❌ НЕ НАЧАТО (placeholder)

- [ ] `domains/admin/ui/AdminShopPage.tsx` — до сих пор stub `AdminSectionPlaceholder` (`AdminShopPage.tsx:1-12`). Нет табов «Настройки/Баннеры/Тарифы».
- [ ] Нет Ant Design формы настроек с InputNumber.
- [ ] Нет списка баннеров с drag-to-reorder + upload.
- [ ] Нет CRUD тарифов модалки.
- [ ] Нет `useShopSettings` хука (TanStack Query, 5-min cache, fallback на `DESIGN_OVERLAY_PRICE`).
- [ ] Нет `frontend/src/shared/__tests__/useShopSettings.test.ts`.
- [ ] **Регрессия по DoD:** все 14 callsites `DESIGN_OVERLAY_PRICE` (catalog/account) до сих пор читают из JS-бандла. Изменение `design_overlay_price` в админке **не видно в каталоге** — DoD «≤5 минут (TTL)» не достигнут.

---

### Definition of Done
- [ ] Изменение `design_overlay_price` в админке → новая цена видна в каталоге через ≤5 минут (TTL). **НЕ ДОСТИГНУТО** (frontend читает константу из бандла; см. 8D).
- [ ] Баннеры с активным флагом и приоритетом отображаются в правильном порядке. **НЕ ДОСТИГНУТО** (8B half-implementation).
- [ ] CRUD тарифов с защитой от удаления используемых планов. **НЕ ДОСТИГНУТО** (8C не начат).

### Аудит 2026-04-25 — line-by-line по реализованной части (Phase 8A) + remediation

**Прочитано построчно (исходный аудит, до remediation):**
1. `backend/app/domain/shop/settings.py` (65 строк) — корректно: singleton ID, дефолты совпадают с `frontend/src/shared/config/constants.ts:DESIGN_OVERLAY_PRICE`, инварианты в `__post_init__`.
2. `backend/app/domain/shop/repositories.py` (65 строк) — две ABC: `ShopSettingsRepository`, `BannerRepository` (последний удалён в remediation, остался только `ShopSettingsRepository`).
3. `backend/app/domain/shop/banner.py` (68 строк) — корректный entity, но не wired → **удалён**.
4. `backend/app/domain/shop/banner_exceptions.py` (16 строк) — `BannerNotFoundError(LookupError)` без потребителя → **удалён**.
5. `backend/app/application/shop/settings_use_cases.py` (77 строк) — `Get`/`Update` с правильной PATCH-семантикой. `0`-valid обработан явно.
6. `backend/app/application/shop/banner_use_cases.py` (171 строка) — корректные use cases, но недостижимы → **удалён**.
7. `backend/app/infrastructure/persistence/repositories/memory.py:355-429` — `InMemoryShopSettingsRepository` корректен; `InMemoryBannerRepository` → **удалён**.
8. `backend/app/infrastructure/persistence/repositories/sql.py:813-985` — корректные SQL-репо; `SqlBannerRepository` → **удалён**.
9. `backend/app/infrastructure/persistence/models.py:346-417` — `ShopSettingsModel` + `BannerModel`. Последний → **удалён** (schema-divergence закрыта).
10. `backend/app/infrastructure/api/admin/shop_settings.py` (87 строк) — корректные DTO с `Field(ge=0)`, оба эндпоинта под `Depends(get_current_admin_id)`.
11. `backend/app/infrastructure/api/shop.py` (57 строк) — публичный read; DTO продублирован (по docstring — намеренно).
12. `backend/app/infrastructure/api/admin/__init__.py` — sub-router `_shop_settings` подключён одной строкой (Phase 1 паттерн соблюдён).
13. `backend/app/main.py:29,111` — `shop.router` подключён правильно.
14. `backend/app/container.py:23,66,101,118,218-227` — `_mem_shop_settings_repo` singleton + `get_shop_settings_repo` dependency. `_get_sql_repo_classes()["shop_settings"]` корректен.
15. `backend/alembic/versions/012_create_shop_settings.py` (81 строка) — `upgrade()` создаёт таблицу + `bulk_insert` seed; `downgrade()` `drop_table`. Без issue.
16. `backend/tests/domain/shop/test_settings.py` (47 строк) — 5 тестов, **PASS**.
17. `backend/tests/application/shop/test_settings_use_cases.py` (97 строк) — 6 тестов, **PASS**.
18. `backend/tests/api/admin/test_shop_settings.py` (190 строк) — 8 тестов, **PASS**.
19. `backend/tests/api/test_shop_public.py` (60 строк) — 3 теста, **PASS**.
20. `backend/tests/infrastructure/test_alembic.py:117-152` — расширен на shop_settings + `head == "012"` assert. **PASS**.
21. `backend/tests/infrastructure/test_shop_settings_repo_sql.py` — **новый** в remediation, 4 теста (round-trip + raises). **PASS**.
22. `frontend/src/domains/admin/ui/AdminShopPage.tsx` (12 строк) — placeholder, не реализован.

**Запущенные тесты (после remediation):**
- `pytest tests/domain/shop/ tests/application/shop/ tests/api/admin/test_shop_settings.py tests/api/test_shop_public.py` → **22/22 passed** (3.4s).
- `pytest tests/infrastructure/test_shop_settings_repo_sql.py -v` → **4/4 passed** (0.34s).
- `pytest tests/ -q` → **537/537 passed** (55.5s) — без регрессий.
- Frontend Phase 8 тестов нет — соответственно, не запускались.

### Найденные проблемы (статус после remediation 2026-04-25)

#### Критические (блокируют закрытие фазы):
1. ~~**8B-C1 — Отсутствует миграция `013_create_banners`** при наличии `BannerModel` в `Base.metadata`.~~ → ✅ **Закрыто:** мёртвый код 8B удалён, `Base.metadata` больше не содержит `banners`.
2. ~~**8B-C2/C3/C4 — Banner-репо не wired в `container.py`**.~~ → ✅ **Закрыто (через удаление):** репо не существует — нечего wireать. Когда 8B будет переоткрыт, всё сделается одним PR (см. чек-лист в подфазе 8B).
3. ~~**8B-C5 — Нет admin/public API для banners**.~~ → ✅ **Закрыто (через удаление).**
4. ~~**8B-C6 — Ноль тестов** для banner-домена.~~ → ✅ **Закрыто (через удаление).**
5. ~~**8B-C7 — `test_alembic.py` НЕ проверяет таблицу `banners`**.~~ → ✅ **Закрыто:** таблица не создаётся миграцией → проверять нечего.
6. **8C — Subscription Plans CRUD не начат** (явное требование OQ2). `SUBSCRIPTION_PLANS` остаётся хардкодом в `backend/app/domain/subscription/entities.py:19-55`. **Открыто.**
7. **8D — Frontend не начат**: `AdminShopPage.tsx` placeholder, нет `useShopSettings` хука. **DoD «≤5 минут TTL» провален** — все 14 callsites `DESIGN_OVERLAY_PRICE` (catalog/data.ts:22-261, account/AccountConstructorSection.tsx:19-457, catalog/api/adapters.ts:14) читают из JS-бандла. **Открыто.**

**Итого:** из 7 критических проблем закрыто 5 (вся группа 8B). Остаются 2 — 8C и 8D — оба «не начато», требуют отдельной фазы реализации с нуля.

#### Некритические (тех-долг по 8A):
1. **`datetime.utcnow()` deprecation** — Python 3.12+ предупреждение. Используется в `domain/shop/settings.py:50`, `application/shop/settings_use_cases.py:75`, `models.py:343,375`, `alembic/versions/012_create_shop_settings.py:76`. Project-wide tech-debt (открыт ещё в Phase 3 audit). **Открыто.**
2. **Дубликат `ShopSettingsResponse`** в `admin/shop_settings.py:33-38` и `api/shop.py:24-36`. По докстрингу — намеренно (защита от утечки admin-полей через transitive type sharing); pattern совпадает с Phase 7B `PanelSchema` vs `PanelResponse`. **ОК (намеренно).**
3. **Двойная валидация `ge=0`** — Pydantic в DTO + `__post_init__` в use case. Docstring говорит «defence-in-depth». **ОК.**
4. ~~**Нет SQL-репо integration теста** для `SqlShopSettingsRepository`.~~ → ✅ **Закрыто:** добавлен `tests/infrastructure/test_shop_settings_repo_sql.py` (4 теста).
5. **Лазание в `_mem_shop_settings_repo._settings`** в тестах (`tests/api/admin/test_shop_settings.py:23,26`, `tests/api/test_shop_public.py:17,19,54`) — тот же открытый backlog #7 из Phase 4A audit. **Открыто (project-wide).**
6. ~~**Чек-лист Phase 8A не отмечен `[x]`** в самом плане.~~ → ✅ **Закрыто.**
7. **Нумерация миграции для `subscription_plans`**: следующая свободная — `013`. Так как `banners` теперь отложены, `subscription_plans` может занимать `013_create_subscription_plans`. Когда 8B вернётся — возьмёт следующий доступный номер. **Решено.**

---

## Фаза 9: Аудит-лог ✅ РЕАЛИЗОВАНО (2026-04-25, line-by-line audit ниже)

> **Цель:** Каждое критичное админ-действие записывается в `audit_entries` для разбора инцидентов.

### Backend
- [x] Domain: новый домен `audit`. Entity `AuditEntry` (`id`, `actor_id`, `action`, `target_type`, `target_id`, `payload`, `ip`, `created_at`) — `app/domain/audit/entities.py` (+ `SYSTEM_ACTOR = "system"` constant).
- [x] Domain: VO `AuditAction` (11 значений: `USER_BLOCK`, `USER_UNBLOCK`, `ROLE_GRANT`, `ROLE_REVOKE`, `ORDER_STATUS_CHANGE`, `ORDER_REFUND`, `ORDER_NOTE_ADD`, `DESIGN_DELETE`, `PANEL_DELETE`, `SETTINGS_UPDATE`, `MEDIA_UPLOAD_SUSPICIOUS`) + `AuditTargetType` (6 значений) — `app/domain/audit/value_objects.py`.
- [x] Application: `RecordAuditEntry.execute(...)` (с `request_ip` биндингом на конструкторе) + `ListAuditEntries.execute(filters, page, size)` с pagination clamp (`_MAX_PAGE_SIZE = 200`) — `app/application/audit/use_cases.py`.
- [x] **Решение:** Вместо декоратора `@audited` использован паттерн collaborator — `audit_recorder: RecordAuditEntry | None = None` через конструктор use case. Обоснование задокументировано в `app/application/audit/use_cases.py:7-22` (+ свобода тестов от monkeypatching, доступ к `actor_id` без волшебства).
- [x] Infrastructure: миграция `013_create_audit_entries.py` создаёт таблицу + 4 индекса: `ix_audit_entries_actor_id`, `ix_audit_entries_action`, `ix_audit_entries_created_at`, и **композитный** `ix_audit_entries_target` на `(target_type, target_id, created_at)` — последний оптимизирован под deep-link reads из user/order detail pages (лучше, чем отдельный `(target_type, target_id)` из исходного плана).
- [x] Infrastructure: `GET /api/admin/audit?action=&actor_id=&target_type=&target_id=&from=&to=&page=&size=` — `app/infrastructure/api/admin/audit.py`. Pydantic Enum coercion даёт 422 на typo автоматически.
- [x] Infrastructure: `get_request_ip(request)` хелпер — `app/utils/dependencies.py:10-32`. Берёт **первый** hop из `X-Forwarded-For` (trust boundary = "наш прокси"), fallback на `request.client.host`.
- [x] **Ретроактивно** обёрнуты use cases:
  - Фаза 1: `GrantAdminRole` / `RevokeAdminRole` (+ idempotency guard: re-grant на уже-админе = no-op для лога) — `app/application/user/use_cases.py`.
  - Фаза 4B: `UpdateOrderStatusAdmin` (REFUNDED → distinct action `ORDER_REFUND`, payload c `{number, from, to, reason?}`) + `AddOrderNoteAdmin` (text_preview at `[:200]`) — `app/application/order/use_cases.py`.
  - Фаза 5: `BlockUserAdmin` / `UnblockUserAdmin` (+ idempotency guards) — `app/application/user/use_cases.py`.
  - Фаза 7B: `DeletePanelAdmin` (pre-load row для payload `{name, slug}`, audit только на successful delete с непустым `actor_id`) — `app/application/catalog/panel_use_cases.py:168-219`.
  - Фаза 8A: `UpdateShopSettingsAdmin` — diff-only payload (`{"changes": {field: {"from": old, "to": new}}}`), no-op (равные значения) audit не пишется — `app/application/shop/settings_use_cases.py`.

### Frontend
- [x] `domains/admin/ui/AdminAuditPage.tsx` — AntD `<Table>` (5 колонок: Время, Действие, Актор, Цель, Подробности), filters (action Select, target type Select, actor_id Search, target_id Search, RangePicker, Reset), color-coded action tags, payload summarisers per action.
- [x] `domains/admin/model/auditStore.ts` — URL-as-source-of-truth, `AUDIT_ACTION_LABELS` / `AUDIT_TARGET_LABELS` (RU), filter parsers с junk-collapse (неизвестный action → null), `applyFilterPatch` сбрасывает page=1, `targetDeepLink` для USER/ORDER (rest → null).
- [x] `domains/admin/api/auditApi.ts` — wire types зеркалят backend pydantic, `useAuditList(q)` с `keepPreviousData` + 15s staleTime + `retry: false`.
- [x] Routing: `shared/router.tsx:55,138` (lazy-loaded `/admin/audit`).
- [x] Navigation: `domains/admin/model/navigation.ts:37` (`{ key: 'audit', path: 'audit', label: 'Аудит' }`).

### Тесты
- [x] `tests/domain/audit/test_audit_entry.py` — 5 тестов на entity invariants (actor_id required, target_id без target_type → ValueError, SYSTEM_ACTOR валиден).
- [x] `tests/application/audit/test_use_cases.py` — 5 тестов (`RecordAuditEntry` round-trip, `ListAuditEntries` DESC sort + pagination clamp + action/date/actor/target filters).
- [x] `tests/application/audit/test_retrofitted_use_cases.py` — 16 тестов: каждый retrofitted use case + idempotency (re-block/re-grant → no audit) + `request_ip` propagation через recorder + backward-compat (`audit_recorder=None` всё ещё работает).
- [x] `tests/api/admin/test_audit.py` — 14 тестов: auth guard (401/403), list shape & pagination, filters (action/target/actor/422-on-bad-enum), end-to-end через retrofitted endpoints (block user → audit, status change → audit с `from`/`to`, settings PATCH → audit с diff, panel DELETE → audit с `{name, slug}`, X-Forwarded-For → audit ip).
- [x] `tests/infrastructure/test_alembic.py:129-158,256` — head=`013`, таблица + 4 индекса проверены, full upgrade→downgrade→upgrade roundtrip.

### Test Run (2026-04-25, end of phase)
- **Backend pytest**: `580 passed, 0 failed` за ~62с (suite перед Фазой 9 был ~547 passed → +33 теста на аудит).
- **Frontend tsc --noEmit**: exit 0.
- **Frontend vitest** (audit модуль): `2 files passed, 28 tests passed` (`auditStore.test.ts` + `AdminAuditPage.test.tsx`).

### Definition of Done — статус
- [x] После любого из ретрофиченых действий в `audit_entries` появляется запись (end-to-end тесты в `test_audit.py:TestEndToEnd` это пинят).
- [x] Запись в audit неблокирующая для UX в смысле «не падает с 500 если recorder не вшит» — `audit_recorder is None` ветка во всех retrofitted use cases (`test_use_cases_work_without_audit_recorder`).
- [x] Производительность: insert идёт через ту же async session, latency не измерялась явно (tolerable — 1 INSERT с 4 индексами на одну admin-операцию).

---

### Phase 9 post-implementation audit (2026-04-25, line-by-line)

Полный аудит Фазы 9 — каждый файл прочитан, тесты прогнаны (580 backend pass, 28 frontend audit-pass, tsc clean).

#### Прочитанные файлы (line-by-line)
**Backend domain:** `app/domain/audit/{value_objects,entities,filters,repositories,__init__}.py`.
**Backend application:** `app/application/audit/use_cases.py`, `app/application/user/use_cases.py` (4 retrofits), `app/application/order/use_cases.py` (2 retrofits), `app/application/shop/settings_use_cases.py`, `app/application/catalog/panel_use_cases.py:168-219` (DeletePanelAdmin).
**Backend infra:** `app/infrastructure/persistence/models.py:387-420` (AuditEntryModel), `repositories/memory.py:385-424` (InMemory), `repositories/sql.py:881-962` (Sql), `alembic/versions/013_create_audit_entries.py`.
**Backend API:** `app/infrastructure/api/admin/{audit,users,orders,shop_settings,panels}.py`, `app/utils/dependencies.py` (`get_request_ip`), `app/container.py` (singletons + factory + dep).
**Backend tests:** `tests/domain/audit/test_audit_entry.py`, `tests/application/audit/{test_use_cases,test_retrofitted_use_cases}.py`, `tests/api/admin/test_audit.py`, `tests/infrastructure/test_alembic.py` (audit sections).
**Frontend:** `domains/admin/api/auditApi.ts`, `domains/admin/model/auditStore.ts`, `domains/admin/ui/AdminAuditPage.tsx`, `domains/admin/__tests__/{auditStore,AdminAuditPage}.test.{ts,tsx}`, `shared/router.tsx`, `domains/admin/model/navigation.ts`.

#### Критические проблемы (блокируют фичу)
**Не найдены.** Все 580 backend-тестов и 28 frontend audit-тестов зелёные; tsc clean; routing+nav wired; миграция 013 — head с upgrade/downgrade roundtrip.

#### Некритические наблюдения (technical debt / стилевое)

1. ~~**Магическое число `200` дублируется в 4 местах**.~~ ✅ **ИСПРАВЛЕНО (remediation 2026-04-25):** `_MAX_PAGE_SIZE` переименован в публичный `MAX_PAGE_SIZE` в `app/application/audit/use_cases.py:37`, `app/infrastructure/api/admin/audit.py` теперь импортирует константу и пинит `Query(le=MAX_PAGE_SIZE)`. Фронтовая `MAX_PAGE_SIZE` оставлена локально (отдельный процесс, не разделяет рантайм с бекендом) — пинится тестом `auditStore.test.ts` («clamps oversized page size»).

2. **Belt-and-braces page-size clamp**: API ставит `Query(ge=1, le=MAX_PAGE_SIZE)`, use case затем повторно делает `max(1, min(size, MAX_PAGE_SIZE))`. Защита от non-API caller (CLI, тест), tolerable. *Не исправлять — defence-in-depth осознан.*

3. ~~**Колонка `ip` не отображается в `AdminAuditPage`**.~~ ✅ **ИСПРАВЛЕНО (remediation 2026-04-25):** добавлена колонка «IP» (140 px, `Text code`, em-dash на null) в `AdminAuditPage.tsx` после «Подробности». Покрыта двумя новыми smoke-тестами в `AdminAuditPage.test.tsx` (`renders the originating IP in its own column`, `renders em-dash placeholder when ip is null`).

4. ~~**`payload` тип `dict` вместо `dict[str, Any]`**.~~ ✅ **ИСПРАВЛЕНО (remediation 2026-04-25):** `app/application/shop/settings_use_cases.py:99` теперь `changes: dict[str, dict[str, Any]] = {}` (импортирован `Any` из typing). Зеркалит сигнатуру `RecordAuditEntry.execute(payload=...)`.

5. **`RecordAuditEntry.execute(payload=None)` коллапсирует `None` и `{}` в один и тот же entry** (`payload or {}`). Семантически эквивалентно для аудита, если в будущем понадобится отличить «явный пустой dict» от «не передал» — нужна отдельная sentinel. *Не исправлять — нет реального use case.*

6. **План говорил «декоратор `@audited`», реализован collaborator-injection.** Это **более удачное** решение (тестируемость без monkeypatching, явный DI-граф, нет проблемы с извлечением `actor_id` через context-magic) — обоснование задокументировано в `use_cases.py:7-22`. План выше актуализирован. *Не исправлять — реализация лучше плана.*

7. **План говорил индексы `(actor_id, created_at)` + `(target_type, target_id)`**, реализованы 3 single-column (`actor_id`, `action`, `created_at`) + 1 композитный `(target_type, target_id, created_at)`. Реальная схема **лучше** для типичных запросов (filter by action, deep-link по `target_*` с DESC по времени). *Не исправлять — реализация лучше плана.*

8. **`design_delete` action key зарезервирован, но use-case не существует** (нет ещё DeleteDesignAdmin). Безвредно — enum-значение пригодится в Фазе 7A. *Не исправлять — намеренно зарезервировано под Фазу 7A.*

9. **`ListAuditEntries` берёт `page=0` и поднимает до 1** (`max(page, 1)`), но FastAPI на API-слое уже бракует через `ge=1`. См. (2) — defence-in-depth. *Не исправлять — то же обоснование что и (2).*

10. **Конфиденциальность payload**: `SETTINGS_UPDATE` пишет цены в `changes.{field}.{from,to}`, `ORDER_NOTE_ADD` пишет первые 200 символов заметки. Никаких PII (паролей/токенов) ни одна retrofitted use case в payload не пишет. ✅ *Действий не требуется.*

#### Remediation re-run (2026-04-25, после фиксов 1/3/4)
- **Backend pytest:** `580 passed` за 62 с (без регрессий).
- **Frontend tsc --noEmit:** exit 0.
- **Frontend vitest** (audit модуль): `30 passed` (+2 новых на IP-колонку).

#### Регрессии — не найдены
Все 547 тестов до Фазы 9 продолжают проходить. `tests/infrastructure/test_alembic.py` обновлён под `head=013` и включает round-trip миграции. `tests/application/audit/test_retrofitted_use_cases.py:test_use_cases_work_without_audit_recorder` явно пинит, что use cases без `audit_recorder` остаются backward-compatible (их вызывают в Phase 1/4B/5/7B/8A тестах без коллабораторa — все зелёные).

---

## Фаза 10: Управление рекомендациями («с этим покупают») ⚠️ ЧАСТИЧНО РЕАЛИЗОВАНО (review 2026-04-25, remediation 2026-04-25)

**Статус после remediation 2026-04-25 (закрыто 5 из 8 гэпов):**
- ✅ Backend полностью готов (домен → application → infrastructure → API), 657 тестов проходят, alembic head=014.
- ✅ **HIGH-1 закрыт:** `recommendations_limit_per_source` пробит через HTTP API (`admin/shop_settings.py` PATCH/GET + публичный `shop.py` GET). Покрыт тестами round-trip + `ge=1` validation (`test_shop_settings.py:test_patch_recommendations_limit*`, `test_shop_public.py` payload pin).
- ✅ **HIGH-2 закрыт:** `AdminRecommendationsPage.tsx` полностью реализован — таблица с фильтрами `source_type`/`has_manual` и URL-driven pagination, modal «Новая подборка», Drawer-редактор с add/remove/reorder targets, save/reset/delete actions, валидацией self-reference и dup, AntD picker для DESIGN через `useDesigns({ limit: 200 })`, free-text input для PANEL.
- ✅ **MEDIUM-4 закрыт:** `ProductPage.tsx:65` теперь вызывает `useDesigns({ limit: 200 })` — рекомендации на дизайны вне первых 20 не теряются молча.
- ✅ **LOW-5 закрыт:** `Cache-Control: public, max-age=300` выставлен на публичном `GET /api/recommendations/...` (`catalog.py:271–279`). Покрыт `test_cache_control_set` в `test_recommendations_public.py`.
- ✅ **MEDIUM-3 (частично):** `frontend/src/domains/admin/__tests__/recommendationsAdminStore.test.ts` написан — 14 тестов на URL-round-trip, parser tolerance, defaults-omitted, `applyFilterPatch` immutability, OPTIONS-pin. **Не написаны:** AdminRecommendationEditor.test.tsx + ProductPage.recommendations regression test.
- ⚠️ Каскадная чистка через collaborator подключена ТОЛЬКО к `DeletePanelAdmin` — `DeleteDesignAdmin` (Фаза 7A) ещё не существует, поэтому R9 закрыт частично.
- ❌ **LOW-6:** `search` фильтр на `GET /api/admin/recommendations` — не реализован.
- ❌ **LOW-7:** Список fallback-предложений в admin GET detail — не реализован (план обещал «предложения от fallback-сервиса для UI с кнопкой "Принять авто-предложение"»).
- ❌ **LOW-8:** Cascade cleanup для DESIGN — блокирован отсутствием `DeleteDesignAdmin` (Фаза 7A).
- ❌ Bulk «Скопировать рекомендации с другого товара» — TODO.

> **Цель:** Админ вручную задаёт, какие дизайны/панели рекомендовать в карточке товара. Заменяет текущую клиентскую эвристику (`ProductPage.tsx:96–107` — фильтр по `category_id`, `slice(0, 3)`, fallback на `mockProducts`) на админ-управляемые связи. При отсутствии ручных связей — fallback на ту же эвристику (старое поведение не ломается).

### Сущностная модель

- **Recommendation** — направленная связь от source-товара к target-товарам.
  - `source_type: RecommendationSourceType` (`DESIGN` | `PANEL`) — для какой сущности рекомендация.
  - `source_id: str` — id дизайна или панели (на уровне домена тип валидируется по `source_type`).
  - `targets: list[RecommendationTarget]` — упорядоченный список целевых товаров.
- **RecommendationTarget** — VO внутри агрегата `Recommendation`.
  - `target_type: RecommendationTargetType` (`DESIGN` | `PANEL`) — рекомендация может быть кросс-типа (для дизайна рекомендовать панели).
  - `target_id: str`
  - `position: int` — порядок отображения (drag-to-reorder).
- **Инвариант:** `(source_type, source_id)` — уникален; связь сама-на-себя запрещена; дубли target в одном `Recommendation` запрещены.
- **Лимит:** по умолчанию 12 рекомендаций на источник (настраивается в `ShopSettings`).

### Backend

- [x] Domain: агрегат `Recommendation` в `app/domain/catalog/recommendation.py` (256 строк, AR с 4 мутаторами + защитой инвариантов).
- [x] Domain: VO `RecommendationSourceType`, `RecommendationTargetType` (Enum, str-mixin), `RecommendationTarget` (`@dataclass(frozen=True)`).
- [x] Domain: методы `add_target` / `remove_target` / `reorder` / `replace_all` (`recommendation.py:131–218`).
- [x] Domain: исключения `SelfRecommendationError`, `DuplicateRecommendationTargetError`, `RecommendationLimitExceededError`, `RecommendationTargetNotFoundError`, `RecommendationNotFoundError` (`recommendation.py:235–255`).
- [x] Domain: `RecommendationRepository` ABC + `RecommendationFilters` dataclass (`app/domain/catalog/repositories.py`). Подписи: `find_by_source`, `save`, `delete`, `list_paginated`, `find_by_target`.
- [x] Application: use cases в `app/application/catalog/recommendation_use_cases.py` — `GetRecommendationAdmin`, `ListRecommendationsAdmin`, `UpsertRecommendationAdmin`, `DeleteRecommendationAdmin`, `GetPublicRecommendations`, `CleanupRecommendationsOnDelete` (377 строк).
- [x] Application: `RecommendationFallbackProvider` Protocol + production-реализация `DesignSimilarityFallback` (`app/application/catalog/recommendation_fallback.py`) — повторяет старую client-эвристику (same-category by rating + popular-fill).
- [x] Application: каскадная чистка реализована через collaborator-паттерн (`CleanupRecommendationsOnDelete`), подключена к `DeletePanelAdmin` (`app/infrastructure/api/admin/panels.py`). **⚠ DeleteDesignAdmin не существует** — Фаза 7A не реализована, поэтому ветка R9 для DESIGN закроется только в Фазе 7A.
- [x] Infrastructure: миграция `alembic/versions/014_create_recommendations.py`:
  - `recommendations(id PK, source_type, source_id, updated_at, UQ(source_type, source_id))`.
  - `recommendation_targets(id PK, recommendation_id FK ON DELETE CASCADE, target_type, target_id, position, UQ(recommendation_id, target_type, target_id))` + индексы `ix_recommendation_targets_recommendation_id` и `ix_recommendation_targets_target` для каскадной чистки.
  - Колонка `shop_settings.recommendations_limit_per_source NOT NULL DEFAULT 12` добавлена в той же ревизии.
  - `downgrade()` чистит обе таблицы и колонку.
- [x] Infrastructure: ORM `RecommendationModel`, `RecommendationTargetModel` (с `cascade="all, delete-orphan"`, `order_by=position`) + `SqlRecommendationRepository` + `InMemoryRecommendationRepository` (`models.py`, `repositories/sql.py`, `repositories/memory.py`). Сейв read-modify-write со сбросом target-коллекции; флаш между clear и re-insert защищает UNIQUE.
- [x] Infrastructure: Pydantic DTO `RecommendationTargetResponse`, `RecommendationResponse`, `RecommendationListResponse`, `RecommendationUpsertBody`, `RecommendationTargetInput` (`app/infrastructure/api/admin/recommendations.py`).
- [x] Infrastructure: эндпоинты подняты:
  - `GET /api/admin/recommendations?source_type=&has_manual=&page=&size=` — пагинированный список. **⚠ `search` фильтр не реализован** (план перечислял его).
  - `GET /api/admin/recommendations/:source_type/:source_id` — возвращает 200 + пустой агрегат при отсутствии. **⚠ Список fallback-предложений в payload отсутствует** (план обещал «предложения от fallback-сервиса для UI с кнопкой "Принять авто-предложение"»).
  - `PUT /api/admin/recommendations/:source_type/:source_id` — идемпотентный upsert.
  - `DELETE /api/admin/recommendations/:source_type/:source_id` — 204 + 404 на повторе.
  - `GET /api/recommendations/:source_type/:source_id?limit=` — публичный (`app/infrastructure/api/catalog.py:227–279`). ✅ **`Cache-Control: public, max-age=300` выставлен** (closed в remediation 2026-04-25), покрыт `test_cache_control_set`.
- [x] Infrastructure: handlers в `error_handlers.py`:
  - `SelfRecommendationError` → 422 `code: "self_reference"`
  - `DuplicateRecommendationTargetError` → 422 `code: "duplicate_target"`
  - `RecommendationLimitExceededError` → 422 `code: "limit_exceeded"`
  - `RecommendationTargetNotFoundError` → 404 `code: "target_not_found"`
  - `RecommendationNotFoundError` → 404 `code: "recommendation_not_found"`
  - Зарегистрированы в `app/main.py:104–115`. **Расхождение с планом по именам кодов** — в плане `RECOMMENDATION_SELF` / `RECOMMENDATION_DUPLICATE` / `RECOMMENDATION_LIMIT_EXCEEDED` / `RECOMMENDATION_TARGET_NOT_FOUND` (UPPER_SNAKE), фактически использованы `snake_case` без префикса `recommendation_` — соответствует стилю Фаз 5/9 (`stale_version`, `last_admin`). Стиль кодов унифицирован, план разойдётся по терминологии.
- [x] Infrastructure: `ShopSettings.recommendations_limit_per_source: int = 12` добавлено (домен `app/domain/shop/settings.py` + миграция 014 + repos). ✅ **Поле выставлено через HTTP API** (closed в remediation 2026-04-25): `ShopSettingsResponse` / `ShopSettingsUpdate` (`Field(default=None, ge=1)`) / `_to_response` / `patch_shop_settings_admin` в `admin/shop_settings.py` + публичный `api/shop.py` все три точки. Покрыто тестами `test_patch_recommendations_limit*` (PATCH/GET round-trip + 422 на 0) и payload-shape pin в `test_shop_public.py`.
- [x] Audit (Фаза 9): `AuditAction.RECOMMENDATION_UPSERT` и `RECOMMENDATION_DELETE`, `AuditTargetType.RECOMMENDATION` (`app/domain/audit/value_objects.py`). Использован collaborator-паттерн (без `@audited`-декоратора, как и в Фазах 5/9). Композитный `target_id` = `f"{source_type}:{source_id}"` для forensics-поиска.

### Frontend

- [x] `frontend/src/domains/admin/api/recommendationsAdminApi.ts` — wire-types + 5 хуков (`useRecommendationsAdminList`, `useRecommendationDetail`, `useUpsertRecommendation`, `useDeleteRecommendation`) с invalidate prefix `lists` и priming `detail` после save/delete.
- [x] `frontend/src/domains/admin/model/recommendationsAdminStore.ts` — URL ↔ DTO round-trip (`queryFromSearchParams`, `searchParamsFromQuery`, `applyFilterPatch`). Источник истины — URL, F5 переживает фильтры и пагинацию. **Local draft state для несохранённых изменений** теперь живёт в самом редакторе (компонентный `useState` в `RecommendationEditorDrawer`, см. ниже).
- [x] `frontend/src/domains/admin/ui/AdminRecommendationsPage.tsx` — ✅ **РЕАЛИЗОВАНО** (closed в remediation 2026-04-25). AntD `<Table>` (Источник, Тип, Целей, Обновлено) + фильтры `Select<source_type>`/`Select<has_manual>` + кнопка «Сбросить» + URL-driven pagination. Кнопка «+ Новая подборка» открывает modal-выбор source. Клик по строке → Drawer-редактор.
- [x] `frontend/src/domains/admin/ui/AdminRecommendationsPage.tsx`:`RecommendationEditorDrawer` — ✅ **РЕАЛИЗОВАНО** (часть того же файла). Список целей с reorder (↑/↓), remove (✕), add-форма (тип + Select<design id> по `useDesigns({ limit: 200 })` или Input для panel), валидация self-reference и dup, кнопки Сохранить (PUT)/Сбросить (revert local draft)/Удалить (с Popconfirm). Используются `useUpsertRecommendation` и `useDeleteRecommendation` хуки.
- [ ] **Bulk actions** «Скопировать рекомендации с другого товара» — TODO.
- [ ] **Список fallback-предложений** в редакторе («Принять авто-предложение») — TODO (заблокировано LOW-7 на бекенде).
- [x] Публичный API-хук: `usePublicRecommendations` добавлен напрямую в `frontend/src/domains/catalog/api/catalogApi.ts:41–58` (отдельный модуль `recommendationsApi.ts` не создан — тип-маленький, держим рядом с `useDesigns` чтобы catalog-домен оставался связным).
- [x] **Refactor `ProductPage.tsx:96–137`** выполнен:
  - `useMemo(relatedProducts)` теперь сначала маппит ответ `usePublicRecommendations` через кеш `useDesigns()` (только `target_type === 'design'`, `slice(0, 3)`), при пустом mapped fallback на legacy same-category эвристику, при отсутствии `allDesigns` — на `mockProducts`.
  - Визуальный JSX блока не тронут.
  - ✅ **Stale-cache fix** (closed в remediation 2026-04-25): `useDesigns({ limit: 200 })` вместо дефолтного 20 — id за пределами первой страницы больше не теряется молча. Комментарий в коде описывает дальнейший путь (либо enriched DTO с публичного эндпоинта, либо fetch by id) если каталог разрастётся за 200.

### Тесты

- [x] `tests/domain/test_recommendation.py` (22 теста) — все инварианты на всех 4 мутаторах + конструкторе. Граничные кейсы (length 0/1/limit) явные.
- [x] `tests/application/test_recommendation_use_cases.py` (19 тестов) — `Get/List/Upsert/Delete*` use cases, `GetPublicRecommendations` (manual-only / fallback-fill / no-curation / limit=0), `CleanupRecommendationsOnDelete` (drops source / prunes target / idempotent miss). Аудит: emission + skip-без-actor_id + skip-on-delete-miss.
- [x] `tests/api/admin/test_recommendations.py` (22 теста) — auth gate (401/403), GET detail (empty / after-PUT / 422 bad type), PUT (fresh/overwrite/idempotent/self-ref/dup/limit/422 bad target_type), DELETE (204/404/double-delete), List (pagination + source_type + has_manual filters), Audit retrofit.
- [x] `tests/api/test_recommendations_public.py` (9 тестов) — нет auth required, curation-first, fallback-only, unknown source_id, 422 bad source_type, dedup self, payload shape, curation-already-enough. ✅ **`test_cache_control_set` добавлен** (closed в remediation 2026-04-25) — пинит `Cache-Control: public, max-age=300`.
- [x] `tests/application/test_panel_use_cases.py` (2 новых теста) — cascade payload landing in audit + opt-out path без collaborator.
- [x] `tests/api/admin/test_audit.py` — релаксирована equality-проверка payload PANEL_DELETE: subset assertion на `name`/`slug` + явная проверка `recommendations_cleanup`.
- [x] `tests/api/admin/test_shop_settings.py` (3 новых теста) — `test_patch_recommendations_limit`, `test_patch_recommendations_limit_zero_rejected_422` (`ge=1`), `test_patch_recommendations_limit_persisted_in_get` (PATCH→GET round-trip). Default `12` запинен в `TestGet`.
- [x] `tests/api/test_shop_public.py` — payload-shape pin расширен на `recommendations_limit_per_source` + assertion дефолта `12`.
- [x] `tests/infrastructure/test_alembic.py` — head bumped до `"014"`.
- [x] `frontend/src/domains/admin/__tests__/recommendationsAdminStore.test.ts` — ✅ **НАПИСАН** (closed в remediation 2026-04-25, 14 тестов: defaults / parser tolerance / round-trip identity / `applyFilterPatch` / OPTIONS pin). PASS 14/14.
- [ ] `frontend/src/domains/admin/__tests__/AdminRecommendationsPage.test.tsx` — **НЕ НАПИСАН**. Smoke-тест на drawer-editor (открытие, add/remove target, save, delete) пока отсутствует.
- [ ] `frontend/src/domains/catalog/__tests__/ProductPage.recommendations.test.tsx` — **НЕ НАПИСАН**. Регрессия рекомендательного блока (server data → fallback при ошибке) пока не зафиксирована тестом.

### Регрессии после ревью (2026-04-25) и remediation (2026-04-25)

```
backend (после remediation): pytest tests/  → 657 passed, 13 warnings (alembic deprecated)
                                              # +4 теста от Phase 10 remediation
                                              # (limit field PATCH/GET round-trip + Cache-Control + payload-shape pin)
frontend tsc --noEmit  → clean
frontend vitest recommendationsAdminStore.test.ts → 14/14 passed
```

### Гэпы под закрытие (по приоритету) — после remediation 2026-04-25

1. ✅ **HIGH — `recommendations_limit_per_source` через HTTP API** — ЗАКРЫТО.
2. ✅ **HIGH — Frontend admin editor** — ЗАКРЫТО (`AdminRecommendationsPage.tsx` + inline `RecommendationEditorDrawer` готовы; реализован в одном файле для компактности — раздробление на отдельный `AdminRecommendationEditor.tsx` отложено как нерелевантный split).
3. ⚠️ **MEDIUM — Frontend tests Фазы 10** — ЗАКРЫТО частично: store round-trip написан (14 тестов). **Открыто:** `AdminRecommendationsPage.test.tsx` (smoke на drawer flow) и `ProductPage.recommendations.test.tsx` (regression на server-data-→-fallback).
4. ✅ **MEDIUM — Stale-cache в `ProductPage`** — ЗАКРЫТО (`useDesigns({ limit: 200 })`).
5. ✅ **LOW — `Cache-Control: public, max-age=300`** на публичном `GET /api/recommendations/...` — ЗАКРЫТО.
6. ❌ **LOW — `search` фильтр на `GET /api/admin/recommendations`** — открыто (низкий приоритет; нагрузка на админ-таблицу пока минимальная, фильтры по `source_type`/`has_manual` покрывают большинство сценариев).
7. ❌ **LOW — Fallback-предложения в admin GET detail** — открыто. План обещал «предложения от fallback-сервиса для UI с кнопкой "Принять авто-предложение"» — реализуется когда понадобится UX-ускорение для крупного каталога.
8. ❌ **LOW — Cascade cleanup для DESIGN** — заблокирован отсутствием `DeleteDesignAdmin` (Фаза 7A не начата).

### Что было проверено в ревью (line-by-line, 25 файлов)

Backend:
- `app/domain/catalog/recommendation.py` (256 строк) — агрегат, VO, инварианты, исключения.
- `app/domain/catalog/repositories.py` — `RecommendationFilters` + `RecommendationRepository` ABC.
- `app/domain/audit/value_objects.py` — `RECOMMENDATION_UPSERT/DELETE` + `RECOMMENDATION` target type.
- `app/domain/shop/settings.py` — `recommendations_limit_per_source: int = 12` invariant `>= 1`.
- `app/application/shop/settings_use_cases.py` — параметр в `UpdateShopSettingsAdmin.execute`.
- `app/application/catalog/recommendation_use_cases.py` (377 строк) — 6 use-cases.
- `app/application/catalog/recommendation_fallback.py` — `DesignSimilarityFallback`.
- `app/application/catalog/panel_use_cases.py` — необязательный collaborator + audit-fold.
- `app/infrastructure/persistence/models.py` — `RecommendationModel` + child + новая колонка settings.
- `app/infrastructure/persistence/repositories/sql.py:976–1198` — `SqlRecommendationRepository`.
- `app/infrastructure/persistence/repositories/memory.py:436–548` — in-memory mirror.
- `app/infrastructure/api/admin/recommendations.py` — 4 admin endpoint.
- `app/infrastructure/api/admin/__init__.py` — router включён.
- `app/infrastructure/api/admin/panels.py` — DELETE с cascade.
- `app/infrastructure/api/catalog.py:227–279` — публичный GET.
- `app/infrastructure/api/error_handlers.py:246–314` — 5 handlers.
- `app/main.py:102–115` — регистрация handlers.
- `app/container.py` — singleton + factory.
- `alembic/versions/014_create_recommendations.py` — миграция.
- 4 теста + 2 модифицированных + alembic head bump.

Frontend:
- `frontend/src/domains/admin/api/recommendationsAdminApi.ts` (NEW).
- `frontend/src/domains/admin/model/recommendationsAdminStore.ts` (NEW).
- `frontend/src/domains/admin/ui/AdminRecommendationsPage.tsx` — заглушка.
- `frontend/src/domains/catalog/api/catalogApi.ts:7–58` — `usePublicRecommendations`.
- `frontend/src/domains/catalog/ui/ProductPage.tsx:96–137` — рефактор `relatedProducts`.

### Definition of Done

- Админ для конкретного дизайна задаёт 4 рекомендации → они появляются в карточке товара в указанном порядке.
- Удаление дизайна (Фаза 7A) → нет «битых» рекомендаций ни как source, ни как target.
- При offline/500 публичного API карточка товара не пустая — показывает старую эвристику.
- Лимит 12 enforced и на бэке (422), и в UI (disable «Добавить»).
- Audit-лог содержит запись для каждого upsert/delete.
- Performance: публичный `/api/recommendations` за <50мс при N=12 (с прогретым кешем) на dataset 10k дизайнов.

---

## Риски и митигации

### R — Регрессии (пересечение с существующей логикой)

| ID | Фаза | Где пересечение | Риск | Митигация |
|---|---|---|---|---|
| R1 | 1 | `Login` use case + `jwt.decode_access_token` | Существующий клиент-фронт ломается, если JWT-payload меняет форму | Добавить поле `role` без удаления `sub`. Old-token migration: при отсутствии `role` в payload — считать `CUSTOMER`. Тест `test_legacy_token.py` |
| R2 | 4B | `Order` уже имеет `confirm/start_work` | Дублирование логики смены статуса; admin может обойти бизнес-правила | Все admin-переходы — через те же доменные методы (`Order.cancel()`, etc.); `UpdateOrderStatusAdmin` маппит `new_status` → метод |
| R3 | 5 | `Login.execute` уже работает | Ввод `is_blocked` ломает существующий happy-path | Тест `test_login_blocked_user.py` + регрессия `test_login_normal_user.py` |
| R4 | 6 | nginx уже настроен | Новый location `/uploads/` может конфликтовать с фронт-роутингом SPA fallback (`try_files ... /index.html`) | Добавить location выше fallback; e2e тест на `curl /uploads/test.jpg` |
| R5 | 7A | Публичный `GET /api/catalog/designs` | После добавления `is_published` старые дизайны могут пропасть (default `false`) | Default `True` в миграции для существующих; default `True` в entity |
| R6 | 7B | `frontend/src/shared/config/constants.ts` используется в `constructor/` и `catalog/` | Удаление констант ломает конструктор | Двухшаговый refactor: сначала API + fallback на константы, через релиз — удалить fallback |
| R7 | 9 | Use cases из Фаз 1/4B/5/7/8 | Декоратор `@audited` затрагивает уже задеплоенный код — требует регрессии всех админ-эндпоинтов | E2E smoke-тест на каждое из 10 действий после внедрения декоратора; canary-релиз |
| R8 | 10 | `ProductPage.tsx:96–107` уже считает related из `allDesigns` по `category_id` + `slice(0,3)` | Замена источника данных может: (а) сломать визуал блока, (б) показать пустоту при медленном API, (в) дать дубли (один товар и в manual, и в эвристике) | Сохранить старый рендер, заменить только источник. Client-side fallback на старую эвристику при error/timeout. Дедупликация по id и в backend (доборка fallback-ом игнорирует те id, что уже в manual), и в публичном DTO |
| R9 | 10 → 7A/7B | Удаление дизайна/панели должно каскадно чистить `Recommendation` как source И как target | Domain event `DesignDeleted`/`PanelDeleted` + handler `CleanupRecommendationsOnDelete`. **Если Фаза 10 идёт после 7A/7B уже задеплоенных** — нужен бэкфил-скрипт, чистящий orphan-targets. Тест `test_cleanup_on_delete.py` обязателен |

### D — Неявные зависимости между backend и frontend

| ID | Фазы | Зависимость | Митигация |
|---|---|---|---|
| D1 | 1 | Frontend route guard зависит от поля `role` в auth-store, которое появляется только после backend-релиза JWT с `role` | Сначала backend-релиз, после стабилизации — frontend |
| D2 | 3 | Frontend дашборд завязан на формат `DashboardDTO` | Зафиксировать DTO в design-doc `ADMIN-DASHBOARD-CONTRACT.md` ДО написания кода. Pydantic-схема — single source of truth |
| D3 | 6 → 7 | Загрузка дизайна/панели требует `MediaAsset` API | Жёсткая последовательность: Фаза 6 обязательно перед 7. Документировать в плане |
| D4 | 7B → 8 | `ShopSettings.installation_price` влияет на расчёт стоимости в конструкторе | Конструктор должен брать цены из `/api/shop/settings`. До Фазы 8 — fallback на константы |
| D5 | 9 | Декоратор `@audited` извлекает `actor_id` из request context | Внедрить `ContextVar[str]` для actor_id в middleware ДО Фазы 9 (можно в Фазе 1 закладкой) |
| D6 | 10 → 7A/7B | Каскадная чистка рекомендаций требует, чтобы `DeleteDesignAdmin`/`DeletePanelAdmin` диспатчили domain event | Если Фазы 7A/7B идут раньше 10 без events — добавить event-bus (даже пустой) ещё в 7A. Альтернатива: при релизе 10 сделать рефактор `DeleteDesignAdmin` (тогда фаза дороже). Решение в Open Question OQ9 |
| D7 | 10 → 8 | `recommendations_limit_per_source` хранится в `ShopSettings` | Если 10 идёт ДО 8 — захардкодить `12` константой, в 8 вынести в settings |

### T — Технически сложные места

| ID | Фаза | Сложность | Митигация |
|---|---|---|---|
| T1 | 3 | Агрегаты дашборда могут стать медленными на больших данных | Индексы при создании; perf-тест на 10k заказов в DoD; кеш 60с |
| T2 | 6 | Загрузка больших файлов через FastAPI: streaming vs full-buffer | Использовать `UploadFile` со `SpooledTemporaryFile`, проверка `Content-Length` в middleware; reject ДО полного приёма |
| T3 | 6 | XSS через имя файла или SVG | Запретить SVG в whitelist mimes для `DESIGN_PREVIEW`; нормализация имени (uuid + ext); `Content-Disposition: attachment` для админ-просмотра |
| T4 | 7B | Миграция `PANEL_SIZES` из фронт-констант в БД без даунтайма | Двухфазный refactor (R6); seed-data в миграции |
| T5 | 9 | Декоратор должен работать с разными сигнатурами use cases | Декоратор-фабрика, явно указывает, какой аргумент — `target_id`. Тест на каждый из 10 use cases |
| T6 | 10 | Кросс-типовые рекомендации (`source_type=DESIGN`, `target_type=PANEL`) — нужна нормализация в `ProductSummaryDTO` | Единый DTO с дискриминатором `kind: 'design' \| 'panel'` и общими полями `id/name/image/price`. Маппер в application-слое, не на фронте |
| T7 | 10 | UI drag-to-reorder с 12 элементами и async save | Локальный draft-state в editor; PUT только на «Сохранить»; optimistic UI с откатом на ошибке |
| T8 | 10 | N+1 при выдаче `GetPublicRecommendations` (12 targets → 12 SELECT) | Батч-загрузка по ids: один `WHERE id IN (...)` на дизайны и один на панели; или join через `RecommendationRepository.find_with_resolved_targets()` |

### E — Edge cases

| ID | Фаза | Edge case | Решение |
|---|---|---|---|
| E1 | 1 | Последний админ пытается снять с себя роль | `LastAdminRemovalError` в домене; UI блокирует кнопку (после refetch) |
| E2 | 1 | Грант роли уже-админу | Идемпотентно (no-op + 200, не 409) |
| E3 | 4B | Отмена уже отменённого заказа | `OrderAlreadyCancelledError` → 409 |
| E4 | 4B | Заказ без items (битый seed) | Domain не разрешает `add_item` пустой; UI показывает баннер «битый заказ», возможна только заметка |
| E5 | 5 | Заблокировать суперадмина (Фаза 1 — `SYSTEM`-actor) | Нельзя; `User.is_protected: bool` для системного админа |
| E6 | 6 | Загрузка одинакового файла дважды | Хеширование sha256 + UNIQUE индекс; идемпотентно — возврат существующего `MediaAsset` |
| E7 | 6 | Файл удалён из storage, но записан в `MediaAsset` (рассинхрон) | Cron-задача `cleanup_orphan_media` (раз в сутки), отчёт в audit-log |
| E8 | 7A | Удаление дизайна с активными заказами | Soft-delete (`is_deleted` flag) или запрет (`DesignInUseError`); решить в design-doc, по умолчанию — запрет |
| E9 | 7B | Удаление панели, привязанной к плейсменту в незавершённом проекте визуализатора | `PanelInUseError` либо soft-deactivate; рекомендуется soft (`is_active=false`) |
| E10 | 8 | Изменение `design_overlay_price` в момент оформления заказа | Order фиксирует цену в момент создания (`unit_price` в `OrderItem`); цена в settings — только для новых заказов |
| E11 | 8 | Активный баннер с битой ссылкой на удалённый MediaAsset | Cascade delete недопустим; запретить удалять MediaAsset со ссылками (`MediaInUseError`) |
| E12 | 9 | Audit-лог переполняется (миллионы строк) | Партиционирование по месяцу + retention 12 мес; вынести в отдельный задачник позже |
| E13 | All | Действия на mobile-разрешении админки | Сайдбар-drawer; admin-панель официально desktop-first, но не должна ломаться на mobile |
| E14 | 10 | Админ кладёт дизайн в рекомендации к самому себе | `SelfRecommendationError` → 422; UI блокирует выбор source-товара в селекторе |
| E15 | 10 | Админ добавляет в рекомендации скрытый (`is_published=false`) дизайн | Разрешено сохранить (admin может готовить связи заранее), но публичный `GET /api/recommendations` фильтрует unpublished/inactive — и показывает индикатор «N скрыто» в админ-редакторе |
| E16 | 10 | Удалён target-товар, но связь осталась (без cascade) | Cascade чистка через domain event (см. R9). Cron-задача `cleanup_orphan_recommendation_targets` раз в сутки как страховка |
| E17 | 10 | Циклы (A → B, B → A) | Допустимы (это не граф навигации, а независимые списки); тест фиксирует, что цикл не приводит к рекурсии в публичной выдаче |
| E18 | 10 | Bulk «Скопировать рекомендации с другого товара» при наличии существующих связей | Confirm-модалка с радио: «Заменить» / «Дополнить (с дедупликацией)» |
| E19 | 10 | Тип source/target невалиден для своего id (например, `source_type=DESIGN`, но `source_id` принадлежит панели) | Доменная валидация в `UpsertRecommendationAdmin` — проверка существования через соответствующий репозиторий → `RecommendationTargetNotFoundError` (404) с пояснением «тип не совпадает» |
| E20 | 10 | Фронт-кеш `/api/recommendations` устарел после изменения админом | Invalidate ключ `['recommendations', source_type, source_id]` после mutate; для публичной части `Cache-Control: max-age=300` — допустимая задержка 5 мин (как и в Фазе 8 для shop settings) |

---

## Трудозатраты (грубо, в днях разработки одного fullstack)

| Фаза | Backend | Frontend | Тесты | Итого |
|---|---|---|---|---|
| 0  Аудит | — | — | — | 0.5 |
| 1  Роль + guard | 1.5 | 0.5 | 0.5 | 2.5 |
| 2  Layout | — | 1.5 | 0.5 | 2 |
| 3  Дашборд | 2 | 1.5 | 1 | 4.5 |
| 4A Заказы list | 1.5 | 1 | 0.5 | 3 |
| 4B Заказы detail | 2 | 1.5 | 1 | 4.5 |
| 5  Юзеры | 1.5 | 1 | 0.5 | 3 |
| 6  Файл-сторейдж | 2.5 | 0.5 | 1 | 4 |
| 7A Каталог CRUD | 2 | 2 | 1 | 5 |
| 7B Панели | 2 | 1.5 | 1 | 4.5 |
| 8  Магазин | 2 | 2 | 1 | 5 |
| 9  Audit | 1.5 | 1 | 1 | 3.5 |
| 10 Рекомендации | 2.5 | 2 | 1 | 5.5 |
| **Итого** | **21** | **16** | **10** | **47.5** |

> Это голая разработка. Не включает: code review, deploy, hotfixes, design-iter.

---

## Definition of Done (общий для плана)

- [ ] Все фазы 0–10 имеют свой DoD ✓.
- [ ] `pytest backend/tests/` — зелёный.
- [ ] `pnpm test` (frontend) — зелёный.
- [ ] Coverage backend новых модулей — ≥80%.
- [ ] Все Alembic-миграции имеют `downgrade()` и проверены `alembic downgrade -1 && alembic upgrade head`.
- [ ] Все админ-эндпоинты под `require_admin`, регрессии нет.
- [ ] `docs/AGENTS.md` обновлён — упоминание admin-домена и его маршрутов.
- [ ] `ARCHITECTURE.md` — диаграмма с новыми доменами `analytics`, `media`, `audit`, `admin`.
- [ ] Создан product-spec `docs/product-specs/ADMIN-PANEL.md` — кто пользуется, какие сценарии.
- [ ] Этот план перенесён в `docs/exec-plans/completed/`.

---

## Acceptance Criteria (со стороны бизнеса)

1. Сотрудник поддержки может найти заказ по № за <5 секунд.
2. Контент-менеджер может загрузить новый дизайн без участия разработчика.
3. Изменение цен в админке отражается на витрине без redeploy.
4. Генеральный директор видит revenue за месяц на одном экране.
5. После инцидента (например, ошибочное изменение статуса заказа) можно по audit-лог восстановить, кто и когда сделал.
6. Заблокированный недобросовестный пользователь не может оформить новый заказ.
7. Контент-менеджер может вручную задать «с этим часто покупают» для конкретного товара; изменения видны на витрине ≤5 мин.
8. При удалении товара рекомендации с ним автоматически чистятся — нет «битых» ссылок в карточках.

---

## Open Questions

- [x] **OQ1** ✅ **РЕШЕНО (24.04.2026):** Локальный volume на MVP. Причины: (а) нет трафика, преждевременно тащить MinIO; (б) `FileStorage` уже спроектирован как ABC — swap на S3 позже стоит ~0.5 дня; (в) меньше контейнеров в `docker-compose.yml`, проще деплой; (г) nginx уже в стеке. **Действие:** в Фазе 6 реализуется только `LocalFileStorage`; задокументировать переход на S3 как отдельный issue в `docs/design-docs/FILE-STORAGE-ROADMAP.md`.
- [x] **OQ2** ✅ **РЕШЕНО (24.04.2026):** Тарифы подписок — **полноценный entity с CRUD в админке**. Если в Фазе 0 окажутся хардкодом — добавить в Фазу 8 миграцию + seed существующих тарифов. **Действие:** Фаза 8 теперь содержит CRUD тарифов как обязательную часть (а не «если ещё не»).
- [ ] **OQ3** Промокоды — в скоупе админки или отдельный план? По умолчанию — НЕ в этом плане.
- [x] **OQ4** ✅ **РЕШЕНО (24.04.2026):** Только 2 роли: `admin` / `customer`. Без «контент-менеджера», «оператора заказов» и т.п. **Действие:** Фаза 1 не меняется (`UserRole` enum остаётся бинарным); Фаза 9 audit-лог фиксирует все действия — этого достаточно для разделения ответственности на старте.
- [ ] **OQ5** Двухфакторная аутентификация для админов? Не в скоупе MVP; отдельный план.
- [ ] **OQ6** Экспорт данных (CSV / Excel) для заказов и юзеров? Не в скоупе; отдельный план.
- [ ] **OQ7** Web-сокеты для real-time уведомлений (новый заказ → бейдж в админке)? Не в скоупе; пока polling раз в 30с.
- [ ] **OQ8** Языки админки: только русский (как и весь UI) или EN/RU? По умолчанию — только RU, по конвенциям.
- [ ] **OQ9** Domain events: вводим event-bus уже в Фазе 7A (для будущей каскадной чистки рекомендаций) или откладываем до Фазы 10 с рефактором `DeleteDesignAdmin`/`DeletePanelAdmin`? Рекомендация — ввести лёгкий sync event-bus в 7A, дешевле в перспективе.
- [ ] **OQ10** Кросс-типовые рекомендации (для дизайна показывать в т.ч. панели и наоборот) — в скоупе MVP или только same-type? По умолчанию — да, в скоупе (см. Фазу 10 модель). Если нет — упрощается DTO и UI.
- [ ] **OQ11** Аналитика рекомендаций (CTR, влияние на конверсию) — в скоупе? По умолчанию — нет, отдельный план; в Фазе 10 только настройка, не измерение.

---

## Что делать дальше

1. ~~Закрыть OQ1, OQ2, OQ4~~ — ✅ закрыты 24.04.2026 (см. секцию Open Questions).
2. Запустить **Фазу 0** (аудит, 0.5 дня) — ключевое: подтвердить наличие Alembic, проверить, тарифы entity или хардкод (от этого зависит длина Фазы 8).
3. По итогам аудита — уточнить трудозатраты Фазы 8 (миграция тарифов) и Фазы 6 (готовность nginx-конфига).
4. Зафиксировать релизный порядок: 1 → 2 → (3 ‖ 4A) → 4B → 5 → 6 → (7A → 7B ‖ 8) → 10 → 9.
   - **Фаза 10 после 7A/7B** (нужны товары как source/target) и **до или после 9** (audit для рекомендаций — хорошо, но не блокирует).
   - Если ввести event-bus в 7A (см. OQ9) — каскадная чистка работает «из коробки», бэкфил не нужен.
5. Создать issue/branch на каждую фазу. Не мерджить фазы N+1 без merged N.
