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
- **Новый домен `admin` на фронте** — изолированный bounded context. Кросс-доменные импорты только типов из `catalog/order/user/subscription`. UI-импорты — только в `shared/ui/` либо внутри admin.
- **Аудит-лог как поперечная capability** — отдельный домен `audit` (backend), не «прокидываем» через каждый use case вручную; используем декоратор/middleware на admin-роутерах.
- **Хранилище файлов** — абстракция `FileStorage` (ABC) в `infrastructure/storage/`, реализация: локальный volume через nginx (MVP), S3-совместимый адаптер позже. **Не лочимся на конкретного провайдера в use case-ах.**

---

## Фаза 0: Аудит и подготовка

> **Цель:** Зафиксировать текущее состояние и закрыть открытые вопросы. Не пишем код.
> **Результат:** Короткий отчёт `docs/design-docs/ADMIN-PANEL-AUDIT.md`.

### Чек-лист аудита
- [ ] Прочитать `backend/app/domain/subscription/{entities,value_objects}.py` — выяснить, тарифы это сущность или хардкод. От этого зависит Фаза 6B.
- [ ] Прочитать `backend/app/seed_data.py` и `backend/app/container.py` — выяснить, какие репозитории сейчас in-memory, какие — Postgres. Если in-memory → Фаза 1 удлиняется на миграцию.
- [ ] Проверить наличие Alembic в `backend/`: `alembic.ini`, `migrations/versions/`. От этого зависит формат всех новых миграций (1, 4, 6, 7).
- [ ] Прочитать `frontend/src/shared/router.tsx` — увидеть текущие маршруты, понять, как встроить `/admin/*` lazy-routes.
- [ ] Прочитать `frontend/src/domains/auth/` — понять существующий store (Zustand) и как добавить туда `role`.
- [ ] Прочитать `nginx/nginx.conf` — понять, как раздаются статические файлы; куда монтировать `/uploads/` для MVP-файлсторейджа.
- [ ] Проверить, какие API уже агрегируют данные (есть ли `GET /api/orders/me`, `GET /api/catalog/popular`) — переиспользуемая логика для дашборда.
- [ ] Зафиксировать первого админа: «как назначить» (seed-fixture / CLI-команда / ручной SQL). Решение: CLI-команда `python -m app.cli grant_admin <email>`.

> Аудит — обязателен. Без него Фаза 1 либо длиннее (если нет Alembic), либо ломает существующее (если auth-store не Zustand).

---

## Фаза 1: Роль admin + guard + первый админ

> **Цель:** В `User` появляется `role`; есть guard для эндпоинтов и frontend-route; первый админ создан через CLI.
> **Self-contained релиз** — без UI админки, проверяется через 401/403 и `/api/admin/me`.

### Backend
- [ ] Domain: добавить `UserRole` в `domain/user/value_objects.py` как `Enum` (`CUSTOMER`, `ADMIN`). Добавить поле `role: UserRole = UserRole.CUSTOMER` в `User` entity.
- [ ] Domain: метод `User.promote_to_admin()` / `User.demote_to_customer()` (раннее блокирование демоутинга последнего админа — решается на уровне use case).
- [ ] Domain: исключение `LastAdminRemovalError(DomainException)`.
- [ ] Application: use case `GrantAdminRole.execute(actor_id, target_user_id)` и `RevokeAdminRole.execute(actor_id, target_user_id)`. `actor_id` нужен для аудита.
- [ ] Application: use case `RequireAdmin.execute(user_id)` — кидает `NotAuthorizedError` если не админ.
- [ ] Infrastructure: миграция Alembic `add_role_to_users` с `downgrade()` (default `CUSTOMER` для всех существующих).
- [ ] Infrastructure: обновить `UserModel` (ORM) — колонка `role VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER'`.
- [ ] Infrastructure: обновить `jwt.create_access_token` — добавить claim `role` в payload. Обновить `decode_access_token` → возвращает `(user_id, role)`.
- [ ] Infrastructure: dependency `get_current_admin_id` (parallel к `get_current_user_id`) в `app/utils/dependencies.py` — возвращает 403 если не admin.
- [ ] Infrastructure: CLI-команда `app/cli.py` с подкомандой `grant_admin <email>` (использует `GrantAdminRole.execute('SYSTEM', user.id)`).
- [ ] Infrastructure: новый роутер `infrastructure/api/admin/__init__.py` + `admin/auth.py` с эндпоинтом `GET /api/admin/me` под guard.

### Frontend
- [ ] Расширить `domains/auth/model/types.ts` — `UserRole`, поле `role` в типе `AuthUser`.
- [ ] Обновить `domains/auth/model/authStore.ts` — хранить `role`, селектор `useIsAdmin`.
- [ ] `shared/router.tsx` — компонент `<RequireAdmin>` (HOC/wrapper), редирект на `/login?from=/admin` при отсутствии роли.
- [ ] Заглушка-страница `domains/admin/ui/AdminPlaceholderPage.tsx` (просто «Админ-панель — Фаза 1 OK»).
- [ ] Lazy-route `/admin` → `AdminPlaceholderPage` под `<RequireAdmin>`.

### Тесты
- [ ] `tests/domain/user/test_role.py` — переходы ролей, last-admin protection.
- [ ] `tests/application/user/test_grant_revoke_admin.py` — happy path + permission errors.
- [ ] `tests/api/admin/test_admin_auth.py` — 401 без токена, 403 с customer-токеном, 200 с admin-токеном.
- [ ] `frontend/src/domains/auth/__tests__/authStore.role.test.ts` — селектор `useIsAdmin`.
- [ ] Manual: `docker-compose run --rm backend python -m app.cli grant_admin admin@local` → залогиниться с фронта → редирект на `/admin` без 403.

### Definition of Done
- Миграция применяется и откатывается без ошибок.
- Существующие unit/integration-тесты не падают.
- В `/api/admin/me` возвращается profile + `role: 'ADMIN'`.
- Customer не может зайти на `/admin` — видит редирект.

---

## Фаза 2: Базовый layout админки + навигация

> **Цель:** Каркас `/admin` с боковым меню и пустыми страницами-разделами. Каждый раздел — отдельный route. Это «UI shell» для всех последующих фаз.

### Backend
- (нет изменений)

### Frontend
- [ ] `domains/admin/ui/AdminLayout.tsx` — `<Layout>` с `<Sider>` (Ant Design), боковое меню разделов: Дашборд / Заказы / Пользователи / Каталог / Магазин / Загрузка / Аудит.
- [ ] Цветовые константы Design System в файле компонента (DARK / GREEN / GRAY_TEXT / FONT) — по [`frontend/CONVENTIONS.md`](../../../frontend/CONVENTIONS.md).
- [ ] Заглушки страниц: `AdminDashboardPage`, `AdminOrdersPage`, `AdminUsersPage`, `AdminCatalogPage`, `AdminShopPage`, `AdminUploadPage`, `AdminAuditPage` — каждая в `domains/admin/ui/`.
- [ ] Все маршруты `/admin/*` через `<RequireAdmin>` (общий wrapper в `router.tsx`).
- [ ] Hook `useAdminNavigation()` — только активный раздел; без бизнес-логики.
- [ ] Mobile: при `max-width: 768px` сайдбар сворачивается в `<Drawer>` (по конвенциям — через `<style>` блок media query).
- [ ] Топ-бар: имя текущего админа, кнопка «Выйти» (вызов `authStore.logout`).

### Тесты
- [ ] `frontend/src/domains/admin/__tests__/AdminLayout.test.tsx` — рендер меню, активный раздел, выход.
- [ ] Manual: пройти по всем 7 разделам, проверить URL и активный пункт меню.

### Definition of Done
- Все 7 разделов открываются, маршрут отражается в URL.
- На мобильном сайдбар работает как drawer.
- Customer на любую `/admin/*` страницу → редирект на `/login`.

---

## Фаза 3: Дашборд статистики

> **Цель:** Главный экран `/admin` с ключевыми метриками. **Только агрегаты — без drill-down.**

### Backend
- [ ] Domain: новый bounded context `analytics` (read-only). VO `DateRange`, `Metric`, `MetricSeries`. Без entities — domain-сервис над репозиториями других доменов.
- [ ] Domain: интерфейс `AnalyticsRepository` (ABC) — методы `revenue_by_day(range)`, `orders_by_status(range)`, `new_users_by_day(range)`, `top_designs(limit)`, `conversion_funnel(range)`.
- [ ] Application: use case `GetDashboardSnapshot.execute(range: DateRange) -> DashboardDTO`.
- [ ] Infrastructure: `SqlAnalyticsRepository` — оптимизированные SQL-запросы с GROUP BY, без N+1. Использует readonly-сессию.
- [ ] Infrastructure: эндпоинт `GET /api/admin/analytics/dashboard?from=&to=` под guard.
- [ ] Кеширование: in-memory TTL 60 сек на снимок (декоратор `@cached(60)`); инвалидация — по таймеру, не по событиям (для MVP достаточно).

### Frontend
- [ ] `domains/admin/model/dashboardStore.ts` — Zustand: `range`, `snapshot`, `loading`, `setRange`.
- [ ] `domains/admin/api/analyticsApi.ts` — функция `fetchDashboard(range)` с TanStack Query.
- [ ] `domains/admin/ui/AdminDashboardPage.tsx` — 4 карточки метрик + 2 графика (revenue по дням, заказы по статусам). Используем `recharts` (новая зависимость; альтернатива — `@ant-design/charts`).
- [ ] Селектор периода: 7 / 30 / 90 дней (Ant Design `Segmented`).
- [ ] Скелетоны загрузки (Ant Design `Skeleton`).
- [ ] Анимация появления — Framer Motion (`fadeUpVariants` из конвенций).

### Тесты
- [ ] `tests/domain/analytics/test_date_range.py` — валидация диапазона.
- [ ] `tests/application/analytics/test_get_dashboard_snapshot.py` — happy path + пустые данные.
- [ ] `tests/api/admin/test_dashboard.py` — 200 admin, 403 customer, валидация query params.
- [ ] `frontend/src/domains/admin/__tests__/dashboardStore.test.ts` — смена range триггерит refetch.
- [ ] Performance: дашборд за 30 дней при 10k заказов отдаётся за <500мс (замер в тесте `tests/api/admin/test_dashboard_perf.py`).

### Definition of Done
- На пустой БД дашборд показывает нули, не падает.
- Смена периода обновляет данные.
- В DevTools Network — 1 запрос на снимок (агрегаты на бэке, не на фронте).

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
- [ ] Infrastructure: `LocalFileStorage` — пишет в `/var/uploads/<purpose>/<uuid>.<ext>`, путь публичен через nginx.
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
- [ ] Domain: проверить (по итогам Фазы 0) — если `SubscriptionPlan` — entity, добавить CRUD; если хардкод — сначала вынести в БД (миграция + seed).
- [ ] Domain: новый агрегат `ShopSettings` (singleton-row): `design_overlay_price`, `installation_price`, `min_order_amount`, etc.
- [ ] Domain: новый агрегат `Banner`: `id`, `image_path`, `title`, `cta_text`, `cta_link`, `position`, `is_active`, `priority`.
- [ ] Application: use cases `UpdateShopSettings`, CRUD баннеров, CRUD планов подписок.
- [ ] Infrastructure: миграции `create_shop_settings`, `create_banners`, `create_subscription_plans` (если ещё не).
- [ ] Infrastructure: эндпоинты `/api/admin/shop/settings`, `/api/admin/shop/banners`, `/api/admin/subscription-plans`.
- [ ] Публичный `GET /api/shop/settings` (без auth) — фронт берёт цены оттуда.
- [ ] Публичный `GET /api/shop/banners?position=` — для главной.

### Frontend
- [ ] `domains/admin/ui/AdminShopPage.tsx` — табы «Настройки» / «Баннеры» / «Тарифы».
- [ ] Форма настроек (Ant Design Form) с InputNumber для цен.
- [ ] Список баннеров с drag-to-reorder (приоритет), upload изображений.
- [ ] CRUD тарифов — модалка с features-массивом.
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

### D — Неявные зависимости между backend и frontend

| ID | Фазы | Зависимость | Митигация |
|---|---|---|---|
| D1 | 1 | Frontend route guard зависит от поля `role` в auth-store, которое появляется только после backend-релиза JWT с `role` | Сначала backend-релиз, после стабилизации — frontend |
| D2 | 3 | Frontend дашборд завязан на формат `DashboardDTO` | Зафиксировать DTO в design-doc `ADMIN-DASHBOARD-CONTRACT.md` ДО написания кода. Pydantic-схема — single source of truth |
| D3 | 6 → 7 | Загрузка дизайна/панели требует `MediaAsset` API | Жёсткая последовательность: Фаза 6 обязательно перед 7. Документировать в плане |
| D4 | 7B → 8 | `ShopSettings.installation_price` влияет на расчёт стоимости в конструкторе | Конструктор должен брать цены из `/api/shop/settings`. До Фазы 8 — fallback на константы |
| D5 | 9 | Декоратор `@audited` извлекает `actor_id` из request context | Внедрить `ContextVar[str]` для actor_id в middleware ДО Фазы 9 (можно в Фазе 1 закладкой) |

### T — Технически сложные места

| ID | Фаза | Сложность | Митигация |
|---|---|---|---|
| T1 | 3 | Агрегаты дашборда могут стать медленными на больших данных | Индексы при создании; perf-тест на 10k заказов в DoD; кеш 60с |
| T2 | 6 | Загрузка больших файлов через FastAPI: streaming vs full-buffer | Использовать `UploadFile` со `SpooledTemporaryFile`, проверка `Content-Length` в middleware; reject ДО полного приёма |
| T3 | 6 | XSS через имя файла или SVG | Запретить SVG в whitelist mimes для `DESIGN_PREVIEW`; нормализация имени (uuid + ext); `Content-Disposition: attachment` для админ-просмотра |
| T4 | 7B | Миграция `PANEL_SIZES` из фронт-констант в БД без даунтайма | Двухфазный refactor (R6); seed-data в миграции |
| T5 | 9 | Декоратор должен работать с разными сигнатурами use cases | Декоратор-фабрика, явно указывает, какой аргумент — `target_id`. Тест на каждый из 10 use cases |

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
| **Итого** | **18.5** | **14** | **9** | **42** |

> Это голая разработка. Не включает: code review, deploy, hotfixes, design-iter.

---

## Definition of Done (общий для плана)

- [ ] Все фазы 0–9 имеют свой DoD ✓.
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

---

## Open Questions

- [ ] **OQ1** Хранилище файлов: локальный volume на MVP или сразу S3-совместимый (MinIO)? Решение влияет на Фазу 6 (день +/- 1).
- [ ] **OQ2** Тарифы подписок сейчас — entity или хардкод? Зависит от Фазы 0; влияет на Фазу 8.
- [ ] **OQ3** Промокоды — в скоупе админки или отдельный план? По умолчанию — НЕ в этом плане.
- [ ] **OQ4** RBAC сложнее «admin / customer» (например, «контент-менеджер» без доступа к финансам)? По умолчанию — нет, только 2 роли. Если нужно — отдельный план.
- [ ] **OQ5** Двухфакторная аутентификация для админов? Не в скоупе MVP; отдельный план.
- [ ] **OQ6** Экспорт данных (CSV / Excel) для заказов и юзеров? Не в скоупе; отдельный план.
- [ ] **OQ7** Web-сокеты для real-time уведомлений (новый заказ → бейдж в админке)? Не в скоупе; пока polling раз в 30с.
- [ ] **OQ8** Языки админки: только русский (как и весь UI) или EN/RU? По умолчанию — только RU, по конвенциям.

---

## Что делать дальше

1. Закрыть **OQ1, OQ2** (10 минут со стейкхолдером).
2. Запустить **Фазу 0** (аудит, 0.5 дня).
3. По итогам аудита — уточнить трудозатраты Фазы 8 и инфры (Фаза 6).
4. Зафиксировать релизный порядок: 1 → 2 → (3 ‖ 4A) → 4B → 5 → 6 → (7A → 7B ‖ 8) → 9.
5. Создать issue/branch на каждую фазу. Не мерджить фазы N+1 без merged N.
