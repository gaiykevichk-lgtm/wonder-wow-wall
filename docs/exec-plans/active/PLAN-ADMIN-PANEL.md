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

## Фаза 3: Дашборд статистики ⚠️ РЕАЛИЗОВАНО С ЗАМЕЧАНИЯМИ (2026-04-24)

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
1. **`conversion_funnel` не реализован** — заменён на `totals`. Либо добавить funnel в Фазе 3.x, либо обновить контракт в REQUIREMENTS.
2. **Перф-тест отсутствует** — `test_dashboard_perf.py` не создан. Перенести в бэклог tech-debt.
3. **`DashboardDTO.range_start/range_end: str`** (`use_cases.py:23-24`) — HTTP-формат в application-слое. Заменить на `date` + форматирование в API-схеме.
4. **`_mem_analytics_repo` читает приватные `_orders`/`_users`** (`container.py:46-47`) — инкапсуляция нарушена. Добавить публичные `orders()`/`users()` на in-memory репо.
5. **`_order_total` дублирует `Order.total`** (`analytics_repo.py:55`) — использовать property.
6. **Readonly-сессия не реализована** — `SqlAnalyticsRepository` берёт обычную `AsyncSession`. Приемлемо для MVP.
7. **`test_admin_gets_full_payload` сидирует общий `_mem_order_repo`** (`test_dashboard.py:139-152`) без отката. Assertion `revenue == 3000` хрупок: любой будущий тест, создающий CONFIRMED/DELIVERED заказ до него, сломает кейс. Добавить `_mem_order_repo._orders.clear()` в setup кейса.
8. **`top_designs` SQL: `func.max(design_name)`** (`analytics_repo.py:226`) — выбор имени при переименовании дизайна недетерминирован. Минорно.
9. **`datetime.utcnow()`** в `DateRange.last_n_days` (`value_objects.py:73`) — deprecation warning на Python 3.12+. Общая проблема проекта, не Phase 3.
10. **Нет UI-теста** на `AdminDashboardPage.tsx` (plan не требовал, но 420 строк с условной отрисовкой — покрытие тонкое). Tech-debt.
11. **Cache key `(days,)` агрегирует все SQL-сессии** в один бакет — сегодня безвредно (данные глобальные, TTL короткий), но поведение имплицитное. Добавить комментарий в `cache.py`.

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

## Фаза 4A: Заказы — список и фильтры

> **Цель:** Просмотр всех заказов с фильтрами/пагинацией/поиском.

### Backend
- [ ] Domain: расширить `OrderRepository` методом `find_paginated(filters: OrderFilters, page: int, size: int) -> tuple[list[Order], int]`. `OrderFilters` — VO с полями `status?`, `user_id?`, `date_from?`, `date_to?`, `search?` (по номеру/email).
- [ ] Application: use case `ListOrdersAdmin.execute(filters, page, size)`.
- [ ] Infrastructure: реализация `SqlOrderRepository.find_paginated` с индексами. **Миграция: добавить индексы** `idx_orders_status`, `idx_orders_created_at`, `idx_orders_user_id` (если ещё нет).
- [ ] Infrastructure: эндпоинт `GET /api/admin/orders?status=&from=&to=&search=&page=&size=` → `OrdersListResponse { items, total, page, size }`.

### Frontend
- [ ] `domains/admin/model/ordersAdminStore.ts` — фильтры, пагинация.
- [ ] `domains/admin/api/ordersAdminApi.ts`.
- [ ] `domains/admin/ui/AdminOrdersPage.tsx` — Ant Design `<Table>` со столбцами: №, Дата, Клиент, Сумма, Статус, Действия. `<Tag>` цветом по статусу.
- [ ] Фильтры в шапке: `<Select>` статус, `<DatePicker.RangePicker>`, `<Input.Search>`.
- [ ] Пагинация — встроенная в Ant Design Table; persist `page/size/filters` в URL search params.
- [ ] Клик по строке → переход на `/admin/orders/:id` (заглушка, реализация в 4B).

### Тесты
- [ ] `tests/domain/order/test_order_filters.py` — построение `OrderFilters`.
- [ ] `tests/application/order/test_list_orders_admin.py` — фильтрация, пагинация, права.
- [ ] `tests/api/admin/test_orders_list.py` — 200 + контракт ответа.
- [ ] `frontend/src/domains/admin/__tests__/ordersAdminStore.test.ts` — URL ↔ store sync.

### Definition of Done
- 1000 фейковых заказов отдаются страницей по 50 за <300мс.
- Фильтры и пагинация переживают F5 (через URL).

---

## Фаза 4B: Заказы — детальный просмотр и управление статусом

> **Цель:** Карточка заказа с возможностью смены статуса, отмены, добавления внутренней заметки.

### Backend
- [ ] Domain: расширить `Order` методами `complete()`, `cancel(reason: str)`, `refund(reason: str)`. Каждый — с гард-условием по текущему статусу (см. паттерн `confirm/start_work` в `entities.py:42`).
- [ ] Domain: добавить `OrderNote` (entity внутри агрегата `Order`) — `id`, `author_id`, `text`, `created_at`. Метод `Order.add_note(author_id, text)`.
- [ ] Domain: исключения `InvalidOrderTransitionError`, `OrderAlreadyCancelledError`.
- [ ] Application: use cases `UpdateOrderStatusAdmin.execute(actor_id, order_id, new_status, reason?)`, `AddOrderNoteAdmin.execute(actor_id, order_id, text)`, `GetOrderAdmin.execute(order_id)`.
- [ ] Infrastructure: миграция `add_order_notes` (новая таблица) + `add_cancel_reason_to_orders` (колонка nullable). Обязательный `downgrade()`.
- [ ] Infrastructure: эндпоинты `GET /api/admin/orders/:id`, `PATCH /api/admin/orders/:id/status`, `POST /api/admin/orders/:id/notes`.
- [ ] Mapping: `InvalidOrderTransitionError` → HTTP 409 в `error_handlers.py`.

### Frontend
- [ ] `domains/admin/ui/AdminOrderDetailPage.tsx` — три блока: header (статус как `<Tag>`, кнопки действий), items (Ant Design `<List>` с превью дизайнов), сайдбар (адрес, дата установки, юзер, заметки).
- [ ] Кнопки смены статуса — disabled по правилам (например, нельзя «отменить» уже завершённый). Логика — на фронте дублирует домен; на бэке — авторитативная.
- [ ] Модалка отмены — обязательное поле `reason` (Ant Design `<Modal>` + `<Form>`).
- [ ] Заметки — список + textarea + кнопка «Добавить» (внутренняя заметка, не видна клиенту).

### Тесты
- [ ] `tests/domain/order/test_status_transitions.py` — все валидные/невалидные переходы.
- [ ] `tests/domain/order/test_order_notes.py`.
- [ ] `tests/application/order/test_update_order_status_admin.py` — happy path + permission + транзиции.
- [ ] `tests/api/admin/test_orders_detail.py`.
- [ ] `frontend/src/domains/admin/__tests__/AdminOrderDetailPage.test.tsx` — кнопки disabled по статусу.

### Definition of Done
- Полный жизненный цикл заказа кликается из UI.
- Запрещённые переходы → toast «Нельзя перевести из X в Y», 409 с бэка.

---

## Фаза 5: Управление пользователями

> **Цель:** Список / поиск / просмотр профиля; назначение роли admin; блокировка.

### Backend
- [ ] Domain: добавить `User.is_blocked: bool = False`. Методы `User.block()`, `User.unblock()`. Заблокированный — не может логиниться (`Login.execute` кидает `UserBlockedError`).
- [ ] Application: use cases `ListUsersAdmin.execute(filters, page, size)`, `GetUserAdmin.execute(user_id)`, `BlockUserAdmin`, `UnblockUserAdmin`. Use cases `GrantAdminRole`/`RevokeAdminRole` уже из Фазы 1.
- [ ] Infrastructure: миграция `add_is_blocked_to_users`.
- [ ] Infrastructure: эндпоинты `GET /api/admin/users`, `GET /api/admin/users/:id`, `POST /api/admin/users/:id/block`, `POST /api/admin/users/:id/unblock`, `POST /api/admin/users/:id/grant-admin`, `POST /api/admin/users/:id/revoke-admin`.
- [ ] `Login.execute` обновить — отказ при `is_blocked`.
- [ ] Mapping: `UserBlockedError` → 403 с код `USER_BLOCKED`.

### Frontend
- [ ] `domains/admin/ui/AdminUsersPage.tsx` — таблица: имя, email, телефон, роль (`<Tag>`), статус (active/blocked), дата регистрации.
- [ ] Фильтр по роли + поиск по email/имени/телефону.
- [ ] `domains/admin/ui/AdminUserDetailPage.tsx` — профиль + история заказов (переиспользует `ListOrdersAdmin` с `user_id`).
- [ ] Действия: «Сделать админом» / «Снять админа» / «Заблокировать» / «Разблокировать» — каждое через `<Popconfirm>`.

### Тесты
- [ ] `tests/domain/user/test_block_unblock.py`.
- [ ] `tests/application/user/test_block_user_admin.py`.
- [ ] `tests/application/user/test_login_blocked.py` — `Login` отказ.
- [ ] `tests/api/admin/test_users_list.py`.
- [ ] `frontend/src/domains/admin/__tests__/AdminUsersPage.test.tsx`.

### Definition of Done
- Заблокированный юзер получает 403 при попытке логина.
- Последнего админа нельзя ни заблокировать, ни снять с роли.

---

## Фаза 6: Хранилище файлов (инфраструктурная фаза)

> **Цель:** Готовая инфраструктура для загрузки и раздачи файлов. Без UI. Без неё — Фазы 7A/7B заблокированы.
> Self-contained релиз: проверяется через curl + nginx serve.

### Backend
- [ ] Domain: новый домен `media`. Entity `MediaAsset` (`id`, `path`, `mime`, `size_bytes`, `original_name`, `uploaded_by`, `uploaded_at`, `purpose: MediaPurpose`).
- [ ] Domain: VO `MediaPurpose` (`DESIGN_PREVIEW`, `PANEL_PHOTO`, `BANNER`, `MISC`). VO `MediaConstraints` per purpose (max size, allowed mimes, min/max dimensions).
- [ ] Domain: исключения `MediaTooLargeError`, `MediaInvalidMimeError`, `MediaInvalidDimensionsError`.
- [ ] Domain: интерфейс `FileStorage` (ABC) — `save(stream, path) -> str`, `delete(path)`, `url_for(path) -> str`.
- [ ] Application: use case `UploadMedia.execute(actor_id, file: UploadedFile, purpose: MediaPurpose) -> MediaAssetResponse`.
- [ ] Infrastructure: `LocalFileStorage` (единственная реализация на MVP, см. OQ1) — пишет в `/var/uploads/<purpose>/<uuid>.<ext>`, путь публичен через nginx. Roadmap миграции на S3-совместимое хранилище — отдельный issue + design-doc `docs/design-docs/FILE-STORAGE-ROADMAP.md`.
- [ ] Infrastructure: миграция `create_media_assets` (id PK, purpose, path UNIQUE, ...).
- [ ] Infrastructure: эндпоинт `POST /api/admin/media` (`multipart/form-data` + query `purpose`).
- [ ] Infrastructure: nginx — location `/uploads/` → alias на volume; отдельный volume в `docker-compose.yml`.
- [ ] Валидация изображений на сервере: `Pillow` для проверки размеров/целостности (без полного декода в память для больших файлов — chunked).
- [ ] **Антивирус-эвристика для MVP**: проверка magic bytes + max 20MB; полноценный av-scan — потом, флаг в audit-log.

### Frontend
- [ ] Хелпер `domains/admin/lib/uploadFile.ts` — обёртка над `fetch` с прогрессом (XMLHttpRequest для onProgress).
- [ ] Компонент `shared/ui/AdminFileUpload.tsx` — обёртка Ant Design `<Upload>` с превью и прогрессом.

### Тесты
- [ ] `tests/domain/media/test_constraints.py`.
- [ ] `tests/application/media/test_upload_media.py` — все ошибки + happy path (mock `FileStorage`).
- [ ] `tests/api/admin/test_media_upload.py` — 200 / 413 (too large) / 415 (wrong mime) / 422 (bad dimensions) / 403.
- [ ] Manual: загрузить через curl → файл в volume → доступен по `https://.../uploads/...`.

### Definition of Done
- Загрузка 10MB JPEG проходит за <2с локально.
- Файлы > лимита отклоняются ДО полного приёма (Content-Length check).
- Удалённый из MediaAsset файл удаляется и из volume.

---

## Фаза 7A: Управление каталогом — категории и дизайны

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

## Фаза 7B: Загрузка панелей (физических SKU)

> **Цель:** Сейчас «панель» — это только размер из `constants.ts`. Превратить в полноценный товар с фото, описанием, базовой ценой.

### Backend
- [ ] Domain: новый агрегат `Panel` (в `domain/catalog/`): `id`, `name`, `size: PanelSize` (VO), `base_price: int`, `description`, `photo_path` (MediaAsset path), `is_active: bool`.
- [ ] Domain: VO `PanelSize` — `width_cm`, `height_cm`, `key` (например, `MEDIUM_60x40`).
- [ ] Domain: интерфейс `PanelRepository`.
- [ ] Application: CRUD use cases `CreatePanelAdmin`, `UpdatePanelAdmin`, `DeletePanelAdmin`, `ListPanelsAdmin`, `GetPanelAdmin`.
- [ ] Infrastructure: миграция `create_panels` + `seed_initial_panels` (перенос текущих `PANEL_SIZES` из `constants.ts` в БД).
- [ ] Infrastructure: эндпоинты `/api/admin/panels` CRUD + публичный `GET /api/catalog/panels` (для фронта-конструктора).
- [ ] Постепенный отказ от `frontend/src/shared/config/constants.ts` (PANEL_SIZES, BASE_PANEL_PRICES) — фронт начинает их получать из API. **Бек-совместимость:** на время миграции константы остаются как fallback.

### Frontend
- [ ] `domains/admin/ui/AdminUploadPage.tsx` — список панелей + кнопка «Добавить панель».
- [ ] Модалка панели: name, размер (width/height InputNumber), key (auto-gen), цена, описание (Textarea), upload фото через `AdminFileUpload`.
- [ ] Toggle активности.
- [ ] **Конструктор:** `domains/constructor/` обновить, чтобы получать панели из API (через TanStack Query), не из `constants.ts`. Совместимость fallback на 1 релиз.

### Тесты
- [ ] `tests/domain/catalog/test_panel.py`.
- [ ] `tests/application/catalog/test_panel_crud_admin.py`.
- [ ] `tests/api/admin/test_panels_crud.py`.
- [ ] `tests/api/catalog/test_public_panels.py`.
- [ ] `frontend/src/domains/constructor/__tests__/usePanels.test.ts` — fallback на константы при ошибке API.

### Definition of Done
- В админке создаётся панель → доступна в конструкторе.
- Конструктор не падает при пустой БД (fallback на дефолтные).

---

## Фаза 8: Управление магазином (настройки и тарифы)

> **Цель:** Управление подписками, базовой ценой overlay, баннерами главной, промокодами (опционально).

### Backend
- [ ] Domain: `SubscriptionPlan` приводится к виду entity с CRUD (решение OQ2). Если по итогам Фазы 0 — хардкод, миграция `create_subscription_plans` + seed существующих планов идёт первой задачей фазы. Если уже entity — переходим сразу к use cases.
- [ ] Domain: новый агрегат `ShopSettings` (singleton-row): `design_overlay_price`, `installation_price`, `min_order_amount`, etc.
- [ ] Domain: новый агрегат `Banner`: `id`, `image_path`, `title`, `cta_text`, `cta_link`, `position`, `is_active`, `priority`.
- [ ] Application: use cases `UpdateShopSettings`, CRUD баннеров, **CRUD планов подписок (обязательно, см. OQ2)** — `CreateSubscriptionPlanAdmin`, `UpdateSubscriptionPlanAdmin`, `DeleteSubscriptionPlanAdmin`, `ListSubscriptionPlansAdmin`. Удаление плана с активными подписками → `SubscriptionPlanInUseError` (409).
- [ ] Infrastructure: миграции `create_shop_settings`, `create_banners`, `create_subscription_plans` (последняя — обязательна, если в Фазе 0 выяснилось, что планы хардкод; включает seed существующих планов).
- [ ] Infrastructure: эндпоинты `/api/admin/shop/settings`, `/api/admin/shop/banners`, `/api/admin/subscription-plans`.
- [ ] Публичный `GET /api/shop/settings` (без auth) — фронт берёт цены оттуда.
- [ ] Публичный `GET /api/shop/banners?position=` — для главной.

### Frontend
- [ ] `domains/admin/ui/AdminShopPage.tsx` — табы «Настройки» / «Баннеры» / «Тарифы».
- [ ] Форма настроек (Ant Design Form) с InputNumber для цен.
- [ ] Список баннеров с drag-to-reorder (приоритет), upload изображений.
- [ ] CRUD тарифов — модалка с полями: name, price, billing_period (enum), features-массив (динамический список), is_active. Запрет удаления плана с активными подписками — toast «есть N активных подписок».
- [ ] **Frontend публично**: `shared/config/constants.ts` → постепенный refactor. Цены приходят из `/api/shop/settings` (TanStack Query, кеш 5 мин). Fallback на константы при offline.

### Тесты
- [ ] `tests/domain/shop/test_settings.py`.
- [ ] `tests/application/shop/test_update_settings.py`.
- [ ] `tests/api/admin/test_shop.py`.
- [ ] `frontend/src/shared/__tests__/useShopSettings.test.ts`.

### Definition of Done
- Изменение `design_overlay_price` в админке → новая цена видна в каталоге через ≤5 минут (TTL).
- Баннеры с активным флагом и приоритетом отображаются в правильном порядке.

---

## Фаза 9: Аудит-лог

> **Цель:** Каждое критичное админ-действие записывается в `audit_log` для разбора инцидентов.

### Backend
- [ ] Domain: новый домен `audit`. Entity `AuditEntry` (`id`, `actor_id`, `action`, `target_type`, `target_id`, `payload_json`, `ip`, `created_at`).
- [ ] Domain: VO `AuditAction` (Enum: `USER_BLOCK`, `USER_UNBLOCK`, `ROLE_GRANT`, `ROLE_REVOKE`, `ORDER_STATUS_CHANGE`, `ORDER_REFUND`, `DESIGN_DELETE`, `PANEL_DELETE`, `SETTINGS_UPDATE`, `MEDIA_UPLOAD_SUSPICIOUS`).
- [ ] Application: use case `RecordAuditEntry.execute(...)`. Use case `ListAuditEntries.execute(filters, page, size)`.
- [ ] Infrastructure: декоратор `@audited(action: AuditAction)` для оборачивания admin use cases — извлекает `actor_id` из контекста, payload — из аргументов (с маскировкой sensitive полей).
- [ ] Infrastructure: миграция `create_audit_log` с индексами `(actor_id, created_at)`, `(target_type, target_id)`.
- [ ] Infrastructure: эндпоинты `GET /api/admin/audit?action=&actor_id=&target_id=&from=&to=&page=&size=`.
- [ ] **Ретроактивно** обернуть use cases из Фаз 1, 4B, 5, 7, 8 декоратором `@audited(...)`. Это значит — Фаза 9 затрагивает уже написанный код. См. [R7].

### Frontend
- [ ] `domains/admin/ui/AdminAuditPage.tsx` — таблица audit-entries с фильтрами.
- [ ] Расшифровка `action` на русском (мап `auditActionLabels`).
- [ ] Клик по `target_id` → переход в соответствующий раздел (заказ/юзер/дизайн).

### Тесты
- [ ] `tests/domain/audit/test_audit_entry.py`.
- [ ] `tests/application/audit/test_record.py`.
- [ ] `tests/application/order/test_update_status_audited.py` — проверка, что обновление статуса создаёт audit entry. **Регрессия для Фазы 4B**.
- [ ] `tests/api/admin/test_audit.py`.

### Definition of Done
- После любой из 10 perekrytyx действий в `audit_log` появляется запись.
- Производительность: запись в audit < 5мс, не блокирует основной use case (можно sync — БД с indexed insert).

---

## Фаза 10: Управление рекомендациями («с этим покупают»)

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

- [ ] Domain: новый агрегат `Recommendation` в `domain/catalog/` (рекомендации — часть catalog bounded context).
- [ ] Domain: VO `RecommendationSourceType`, `RecommendationTargetType` (Enum), `RecommendationTarget` (`@dataclass(frozen=True)`).
- [ ] Domain: методы `Recommendation.add_target(target)`, `remove_target(target_id)`, `reorder([target_ids])`, `replace_all([targets])`.
- [ ] Domain: исключения `SelfRecommendationError`, `DuplicateRecommendationTargetError`, `RecommendationLimitExceededError`, `RecommendationTargetNotFoundError`.
- [ ] Domain: интерфейс `RecommendationRepository` (ABC) — `find_by_source(source_type, source_id) -> Recommendation | None`, `save(rec)`, `delete(source_type, source_id)`, `find_all_paginated(filters, page, size)`, `find_by_target(target_type, target_id) -> list[Recommendation]` (для каскадной чистки при удалении товара).
- [ ] Application: use cases `GetRecommendationAdmin`, `UpsertRecommendationAdmin.execute(actor_id, source_type, source_id, targets)`, `DeleteRecommendationAdmin`, `ListRecommendationsAdmin` (для общей таблицы со статусом покрытия), `GetPublicRecommendations.execute(source_type, source_id, limit) -> list[ProductSummaryDTO]` — публичный read-use case с автоматическим fallback на эвристику «по категории».
- [ ] Application: доменный сервис `RecommendationFallbackService` — содержит эвристику (по категории, последним просмотрам, популярности). Используется только когда ручной `Recommendation` отсутствует или содержит < N targets (доборка).
- [ ] Application: при удалении дизайна (Фаза 7A) и панели (Фаза 7B) — каскадно удалять `Recommendation` где этот товар — `source` ИЛИ `target`. Реализуется через domain event `DesignDeleted`/`PanelDeleted` + handler `CleanupRecommendationsOnDelete`. **Регрессия Фаз 7A/7B**, см. [R8].
- [ ] Infrastructure: миграция `create_recommendations` (таблица `recommendations` + `recommendation_targets`):
  - `recommendations(id PK, source_type VARCHAR(16), source_id VARCHAR(36), updated_at, UNIQUE(source_type, source_id))`
  - `recommendation_targets(recommendation_id FK, target_type, target_id, position, UNIQUE(recommendation_id, target_type, target_id))` с индексом `(target_type, target_id)` для каскадной чистки.
  - Обязательный `downgrade()`.
- [ ] Infrastructure: ORM-модели `RecommendationModel`, `RecommendationTargetModel` + `SqlRecommendationRepository`.
- [ ] Infrastructure: Pydantic DTO `RecommendationTargetCreate`, `RecommendationUpsert`, `RecommendationResponse`, `RecommendationListItemResponse`, `PublicRecommendationsResponse`.
- [ ] Infrastructure: эндпоинты:
  - `GET /api/admin/recommendations?source_type=&search=&has_manual=&page=&size=` — таблица всех источников (со статусом «настроено / fallback / нет товара»).
  - `GET /api/admin/recommendations/:source_type/:source_id` — текущие связи + предложения от fallback-сервиса (для UI с кнопкой «Принять авто-предложение»).
  - `PUT /api/admin/recommendations/:source_type/:source_id` — upsert полной коллекции targets (idempotent).
  - `DELETE /api/admin/recommendations/:source_type/:source_id` — сброс к fallback.
  - `GET /api/recommendations/:source_type/:source_id?limit=` — публичный (без auth), используется фронтом-каталогом; кеш `Cache-Control: max-age=300, public`.
- [ ] Infrastructure: маппинг ошибок в `error_handlers.py`:
  - `SelfRecommendationError` → 422 `RECOMMENDATION_SELF`
  - `DuplicateRecommendationTargetError` → 422 `RECOMMENDATION_DUPLICATE`
  - `RecommendationLimitExceededError` → 422 `RECOMMENDATION_LIMIT_EXCEEDED`
  - `RecommendationTargetNotFoundError` → 404 `RECOMMENDATION_TARGET_NOT_FOUND`
- [ ] Infrastructure: `ShopSettings` (Фаза 8) расширить полем `recommendations_limit_per_source: int = 12`.
- [ ] Audit (Фаза 9): action `RECOMMENDATION_UPSERT`, `RECOMMENDATION_DELETE`. Декоратор `@audited` на admin use cases.

### Frontend

- [ ] `domains/admin/api/recommendationsAdminApi.ts` — fetch list / get one / upsert / delete (TanStack Query mutations с invalidate).
- [ ] `domains/admin/model/recommendationsAdminStore.ts` — фильтры / source_type taб / current draft (для несохранённых изменений в редакторе).
- [ ] `domains/admin/ui/AdminRecommendationsPage.tsx` — таб «Дизайны» / «Панели»; таблица: превью source, имя, категория, статус («настроено вручную: N / fallback: K / пусто»), кнопка «Настроить».
- [ ] `domains/admin/ui/AdminRecommendationEditor.tsx` (модалка/боковая панель):
  - Слева: карточка source-товара.
  - Справа: текущий список targets (drag-to-reorder через `react-dnd` или Ant Design `<Sortable>`-обёртка), кнопка «Удалить» на каждом, индикатор позиции.
  - Снизу: блок «Добавить рекомендацию» — селектор типа (Design/Panel) + `<Select showSearch>` с поиском по имени с дебаунсом 300мс.
  - Блок «Авто-предложения» — chips-список target-кандидатов от fallback-сервиса с кнопкой «+» для каждого.
  - Кнопки «Сохранить» (PUT) / «Отмена» / «Сбросить к авто» (DELETE).
- [ ] **Bulk actions:** в таблице — чекбоксы + кнопка «Скопировать рекомендации с другого товара» (выбор source-донора + confirm) — частый кейс при добавлении новых коллекций.
- [ ] Публично: `domains/catalog/api/recommendationsApi.ts` — `fetchRecommendations(source_type, source_id, limit)` через TanStack Query.
- [ ] **Refactor `ProductPage.tsx:96–107`:**
  - Заменить `useMemo(relatedProducts)` на `useQuery(['recommendations', 'DESIGN', product.id])`.
  - При ошибке/отсутствии данных — оставить старую эвристику как client-side fallback (двойная защита: бэкенд тоже подмешивает fallback, но если API упал, фронт не пуст).
  - Сохранить визуальный дизайн блока (строки 821–860) — изменить только источник данных.

### Тесты

- [ ] `tests/domain/catalog/test_recommendation.py` — все инварианты (self, duplicate, limit, reorder).
- [ ] `tests/application/catalog/test_upsert_recommendation_admin.py` — happy path, ошибки, идемпотентность PUT.
- [ ] `tests/application/catalog/test_get_public_recommendations.py` — fallback ветка (нет manual → эвристика), доборка (manual < limit → добор fallback-ом без дубликатов).
- [ ] `tests/application/catalog/test_cleanup_on_delete.py` — удаление дизайна чистит связи как source И как target. **Регрессия Фазы 7A.**
- [ ] `tests/api/admin/test_recommendations_crud.py` — 200/422/404/403, контракт DTO.
- [ ] `tests/api/catalog/test_public_recommendations.py` — публичный эндпоинт, заголовки кеша, отсутствие auth.
- [ ] `frontend/src/domains/admin/__tests__/recommendationsAdminStore.test.ts`.
- [ ] `frontend/src/domains/admin/__tests__/AdminRecommendationEditor.test.tsx` — drag-reorder, добавление, удаление, дисабл «Сохранить» при отсутствии изменений.
- [ ] `frontend/src/domains/catalog/__tests__/ProductPage.recommendations.test.tsx` — показывает данные из API; при ошибке — fallback на старую эвристику; **регрессия:** визуально блок не изменился.

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
