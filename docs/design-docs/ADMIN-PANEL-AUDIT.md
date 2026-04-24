# Admin Panel — Audit (Фаза 0)

> Результат Фазы 0 плана [PLAN-ADMIN-PANEL.md](../exec-plans/active/PLAN-ADMIN-PANEL.md).
> **Дата аудита:** 2026-04-24
> **Цель:** Зафиксировать фактическое состояние кодовой базы перед стартом Фазы 1; подтвердить/скорректировать оценки и риски плана.
> **Код не писался.**

---

## Сводка по чек-листу

| # | Пункт чек-листа | Статус | Ключевой вывод |
|---|---|---|---|
| 1 | Subscription: entity или хардкод? | ✅ проверено | **Хардкод.** `SUBSCRIPTION_PLANS` — module-level list в `domain/subscription/entities.py`. Нет `SubscriptionPlanModel`. |
| 2 | `seed_data.py` + `container.py` — in-memory или Sql? | ✅ проверено | **И то, и то.** Флаг `USE_MEMORY_REPOS` переключает; Sql-репозитории уже реализованы для всех доменов. |
| 3 | Alembic present? | ✅ присутствует | `alembic.ini` + `alembic/env.py` + `alembic/versions/` (5 миграций: 001–005). |
| 4 | `frontend/src/shared/router.tsx` | ✅ проверено | Все роуты внутри `<ShopLayout>`. Есть `<RequireAuth>`. Lazy-роуты установлены как паттерн. |
| 5 | `domains/auth/` — store и типы | ✅ проверено | Zustand + `persist`. В типе `User` **нет** `role`. Mock-login + реальный `setAuth`. |
| 6 | `nginx/nginx.conf` | ✅ проверено | Нет location `/uploads/`. `client_max_body_size 10M` — **ниже лимита Фазы 6 (20M)**. |
| 7 | Агрегирующие API | ✅ проверено | **Нет.** `catalog.py` / `orders.py` отдают объекты, агрегатов/top-N нет. Фаза 3 строит с нуля. |
| 8 | Первый админ — механизм | ✅ решено | Нет `app/cli.py`. Есть только `scripts/seed_db.py`. **Фаза 1 создаёт новый `app/cli.py`** с подкомандой `grant_admin`. |

---

## Детальные находки

### 1. Subscription (Фаза 8)

**Файл:** `backend/app/domain/subscription/entities.py:19-55`

```python
SUBSCRIPTION_PLANS: list[SubscriptionPlan] = [
    SubscriptionPlan(id="starter", name="Стартовый", price=7000, area_limit_m2=15, ...),
    SubscriptionPlan(id="popular", name="Популярный", price=12000, ...),
    SubscriptionPlan(id="business", name="Бизнес", price=18000, area_limit_m2=0, ...),
]
```

- `SubscriptionPlan` — `@dataclass`, но хранится как модульная константа.
- В `infrastructure/persistence/models.py` есть `SubscriptionModel`, но **нет** `SubscriptionPlanModel`.
- `Subscription._get_plan()` (entities.py:93) тянет план именно из этого списка — плотная связь с хардкодом.
- `SubscriptionTier` enum в `value_objects.py` **объявлен, но не используется** в entity (`plan_id: str` — без типобезопасности).

**Вывод:** подтверждает OQ2. **Фаза 8 обязана содержать:**
1. Миграцию `create_subscription_plans` + seed текущих трёх планов.
2. `SubscriptionPlanModel` в ORM + `SubscriptionPlanRepository`.
3. Рефактор `Subscription._get_plan()` на репозиторий (с осторожностью: это меняет сигнатуру use cases подписок).

**Уточнение оценки:** Фаза 8 не дорожает сверх плана, но риск: рефактор `_get_plan()` затронет use cases подписок — регрессия.

---

### 2. Container / репозитории (Фаза 1)

**Файл:** `backend/app/container.py`

- In-memory репозитории: `InMemory*Repository` для всех доменов (User, Order, Design, Category, Review, Subscription, Project, Visualization).
- Sql-репозитории: `SqlDesignRepository, SqlCategoryRepository, SqlReviewRepository, SqlOrderRepository, SqlSubscriptionRepository, SqlUserRepository, SqlProjectRepository, SqlVisualizationProjectRepository` — все существуют.
- Выбор — через `settings.USE_MEMORY_REPOS` в FastAPI dependency.
- **BC-aliases** на уровне модуля (`design_repo = _mem_design_repo` и т.д.) — **используются существующими тестами**. Любые изменения не должны их ломать.

**Вывод:** Фаза 1 **не удлиняется** — SqlUserRepository уже есть. Нужно только добавить поле `role` к `UserModel` + миграция + `promote_to_admin` в entity.

---

### 3. Alembic (все фазы с миграциями)

**Файлы:** `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/`

Существующие миграции:
```
001_initial_schema.py
002_add_installation_date.py
003_subscription_area_model.py
004_visualization_projects.py
005_add_perspective_calibration_to_scenes.py
```

**Вывод:** формат миграций установлен. Новые миграции должны следовать нумерации (006, 007, …) и содержать `downgrade()`. Никаких сюрпризов по миграциям в Фазах 1, 4B, 5, 6, 7A, 7B, 8, 9, 10.

---

### 4. Frontend router (Фаза 2)

**Файл:** `frontend/src/shared/router.tsx`

- Все роуты вложены в `<Route element={<ShopLayout />}>`.
- `RequireAuth` — **импортируется напрямую из `domains/auth/ui/RequireAuth`**, используется как wrapper для `/account/*`.
- Lazy-импорт всех страниц через `React.lazy` — паттерн зафиксирован.

**Важное уточнение к плану (Фаза 2):** маршруты `/admin/*` **не должны** вкладываться в `<ShopLayout>` — им нужен собственный `<AdminLayout>` с боковым меню. Выглядит так:

```tsx
<Route element={<ShopLayout />}>
  {/* public */}
</Route>
<Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
  <Route index element={<AdminDashboardPage />} />
  <Route path="orders" element={<AdminOrdersPage />} />
  {/* ... */}
</Route>
```

Это явно не было выделено в плане — **фиксирую здесь** как уточнение Фазы 2.

---

### 5. Auth store и типы (Фаза 1)

**Файл:** `frontend/src/domains/auth/model/authStore.ts`, `types.ts`

- Zustand с `persist` — ключ хранения `wow-wall-auth`.
- Тип `User`: `id, name, email, phone, avatar?, addresses, createdAt` — **нет `role`**.
- `login` / `register` — **mock-реализации** (принимают любой email с `mock-jwt-token`).
- `setAuth(apiUser, token)` — setter для реального API (вероятно вызывается где-то в `domains/auth/api/*`). Проверено: `api/` директория существует.

**Вывод:**
- Фаза 1 расширяет тип `User` → `role: UserRole`.
- `setAuth` нужно обновить, чтобы принимать `role` из API-ответа.
- Mock-`login/register` — ортогональны Фазе 1 (можно оставить, если реальный backend-login уже интегрирован через другие пути). Это **не блокер**, но отмечено для контекста.

**Новое уточнение:** `persist` хранит старую форму User в localStorage. Нужен миграционный хук `persist.migrate` или `version` bump, иначе пользователи с сохранённым state (без `role`) попадут в «битое» состояние. **Добавить в DoD Фазы 1:** версионирование persist-слайса.

---

### 6. nginx.conf (Фаза 6)

**Файл:** `nginx/nginx.conf`

Текущая конфигурация:
```nginx
upstream backend { server backend:8080; }
upstream frontend { server frontend:80; }

server {
    client_max_body_size 10M;   # ← ниже лимита Фазы 6
    location /api/  { proxy_pass http://backend; ... }
    location /      { proxy_pass http://frontend; ... }
}
```

**Проблемы и действия Фазы 6:**
1. `client_max_body_size 10M` → **поднять до 20M** (соответствие DoD Фазы 6).
2. **Добавить `location /uploads/`** с `alias` на volume файлсторейджа — **выше** `location /`, чтобы не перехватывалось SPA-фолбэком.
3. Добавить `expires` / `Cache-Control` для `/uploads/` (30 дней, immutable для UUID-файлов).
4. Заголовки безопасности — `X-Content-Type-Options nosniff` (уже глобальный) + `Content-Disposition: inline` для изображений.

**R4 (риск из плана) актуален** — SPA-fallback через proxy к frontend (не `try_files ... /index.html`), но принцип тот же: порядок location важен.

---

### 7. Агрегирующие API (Фаза 3)

Проверены `infrastructure/api/catalog.py` и `orders.py`:

- `catalog.py` — `GET /designs` (пагинация) + `GET /designs/:id` + `GET /categories`. Популярных/top/aggregations нет.
- `orders.py` — `POST /orders` (создание) + `GET /orders/me` + переходы статусов. Агрегатов нет.
- Полей `total` в ответах — это total пагинации, **не** бизнес-метрика.

**Вывод:** Фаза 3 строит **полностью новый** домен `analytics` с нуля, как описано в плане. Переиспользование отсутствует — переоценки нет.

---

### 8. CLI (Фаза 1)

**Файлы:** `backend/scripts/seed_db.py` — есть; `backend/app/cli.py` — **не существует**.

**Действие Фазы 1:**
1. Создать `backend/app/cli.py` с интерфейсом `argparse` / `click`. В плане упомянут `python -m app.cli grant_admin <email>`.
2. CLI использует `GrantAdminRole.execute("SYSTEM", user.id)` (actor `"SYSTEM"` — зарезервированный ID системного актора для audit).
3. В `Dockerfile`/docker-compose команда доступна: `docker-compose run --rm backend python -m app.cli grant_admin admin@local`.

---

## Дополнительные находки (сверх чек-листа)

### A. JWT payload

**Файл:** `backend/app/infrastructure/security/jwt.py`

```python
def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": expire}
    ...

def decode_access_token(token: str) -> str | None:
    return payload.get("sub")
```

- Сигнатуры **меняются в Фазе 1**: `create_access_token(user_id, role)`, `decode_access_token → (user_id, role) | None`.
- **R1 (риск легаси-токенов):** при отсутствии claim `role` в payload старого токена — интерпретировать как `CUSTOMER`. Тест `test_legacy_token.py` обязателен.

### B. UserModel (ORM) — поля

**Файл:** `backend/app/infrastructure/persistence/models.py:18-33`

Текущие поля `UserModel`: `id, email, password_hash, name, phone, created_at` + relationships.
**Нет** полей `role`, `is_blocked`, `is_protected`. Все добавляются:
- Фаза 1 → `role`
- Фаза 5 → `is_blocked`
- Фаза 5 / E5 → `is_protected` (опционально — для защиты `SYSTEM`-админа)

### C. User entity — методы

**Файл:** `backend/app/domain/user/entities.py`

- `User` — `@dataclass` с методами `update_profile`, `add_address`, `remove_address`, `set_default_address`.
- **Нет** методов `promote_to_admin`, `demote_to_customer`, `block`, `unblock` — добавляются в Фазах 1 и 5.

### D. Dependencies

**Файл:** `backend/app/utils/dependencies.py`

- Есть `get_current_user_id` (401 если нет токена) и `get_optional_user_id`.
- **Нет** `get_current_admin_id` — добавляется в Фазе 1.
- `ContextVar[str]` для `actor_id` (D5 из плана) — **отсутствует**. План рекомендует заложить в Фазе 1; подтверждаю.

### E. Domain events / event-bus

**Нет** инфраструктуры domain events в коде (искал по `Event`, `dispatch`, `handler` — ничего связанного). Это подтверждает **D6/OQ9** плана: если не ввести лёгкий sync event-bus в Фазе 7A, то каскадная чистка `Recommendation` при удалении товара (Фаза 10) потребует рефактора `DeleteDesignAdmin` / `DeletePanelAdmin`.

**Рекомендация к OQ9:** решаю в пользу **ввести event-bus в Фазе 7A**. Дешевле: +0.5 дня в 7A против +1 дня рефактора в 10 + риск regression.

### F. API routers — префиксы

**Файл:** `backend/app/main.py:55-62`

```python
app.include_router(auth.router, prefix="/api/auth", ...)
app.include_router(catalog.router, prefix="/api", ...)
app.include_router(orders.router, prefix="/api/orders", ...)
...
```

- Префиксы задаются в `main.py`, **не** в роутерах. Следуем тому же паттерну для админки: `app.include_router(admin.router, prefix="/api/admin", tags=["admin"])`.
- **Но** в плане предлагается структура `infrastructure/api/admin/__init__.py` + `admin/auth.py`, `admin/dashboard.py` и т.д. (суб-роутеры). Это **новое** для проекта — текущие роутеры плоские. Допустимо, но добавляет mental overhead — готов к этому.

---

## Обновлённая карта рисков после аудита

| Риск плана | Статус после аудита | Комментарий |
|---|---|---|
| R1 (JWT legacy) | ✅ подтверждён | JWT минимален (`sub/exp`). Тест `test_legacy_token.py` обязателен. |
| R4 (nginx /uploads/ vs SPA) | ✅ подтверждён | SPA идёт через `proxy_pass`, не `try_files`, но порядок `location` критичен. |
| R5 (is_published default) | ✅ подтверждён | Default `True` и в миграции, и в entity — обязательно. |
| R6 (PANEL_SIZES refactor) | ⚠ нужен доп. аудит | Не проверен `frontend/src/shared/config/constants.ts` и `domains/constructor/`. Предлагаю проверить в начале Фазы 7B. |
| R7 (Фаза 9 затрагивает задеплоенный код) | ✅ подтверждён | Use cases Фаз 1/4B/5/7/8 — ретроактивно оборачиваются. Canary обязательно. |
| R9 (cascade чистка Recommendation) | ✅ подтверждён | Event-bus отсутствует → выбираем введение в 7A. |

**Новый риск R10 (persist auth-store):** `persist` хранит `User` без `role` у существующих клиентов. Нужен версионированный `migrate`-колбэк в persist config. Добавлен в DoD Фазы 1.

---

## Обновлённые трудозатраты

| Фаза | План (дни) | Аудит-корректировка | Итого |
|---|---|---|---|
| 0 | 0.5 | — | 0.5 (факт) |
| 1 | 2.5 | + 0.2 (persist migrate + event-bus заготовка) | 2.7 |
| 2 | 2 | — | 2 |
| 3 | 4.5 | — | 4.5 |
| 4A | 3 | — | 3 |
| 4B | 4.5 | — | 4.5 |
| 5 | 3 | — | 3 |
| 6 | 4 | — | 4 |
| 7A | 5 | + 0.3 (event-bus полноценно — вместо заготовки) | 5.3 |
| 7B | 4.5 | — | 4.5 |
| 8 | 5 | — | 5 |
| 9 | 3.5 | — | 3.5 |
| 10 | 5.5 | − 0.5 (event-bus уже есть из 7A) | 5 |
| **Итого** | **47.5** | **+ 0** | **47.5** |

Переносы компенсируются — общий объём не меняется.

---

## Решения Фазы 0

1. **OQ2:** подтверждено — тарифы хардкод; Фаза 8 обязана содержать `create_subscription_plans` + seed + `SubscriptionPlanModel`.
2. **OQ9:** **решено — ввести sync event-bus в Фазе 7A.** Обоснование: отсутствует любая event-инфраструктура; дешевле заложить сразу, чем рефакторить в Фазе 10.
3. **Уточнение Фазы 2:** `/admin/*` роуты — **вне** `<ShopLayout>`, под собственным `<AdminLayout>`.
4. **Уточнение Фазы 1:** версионирование `persist`-слайса authStore (новый риск R10).
5. **Фаза 6 nginx:** `client_max_body_size 10M → 20M` + `location /uploads/` выше `location /`.
6. **CLI:** создать новый модуль `backend/app/cli.py` (не трогать `scripts/seed_db.py`).
7. **Sub-роутеры админки:** структура `infrastructure/api/admin/{auth,dashboard,orders,users,...}.py` с собственным `__init__.py`, который агрегирует sub-routers. Подключение в `main.py` — один include.

---

## Что нужно проверить в начале соответствующих фаз (не делали сейчас)

- **Перед 7B:** прочитать `frontend/src/shared/config/constants.ts` + `domains/constructor/` — оценить сцепку R6.
- **Перед 3:** решить выбор библиотеки графиков — `recharts` vs `@ant-design/charts` (план упоминает `recharts` как основной; проверить совместимость с существующим `package.json`).
- **Перед 6:** изучить docker-compose — какие volumes уже есть; добавить новый `uploads-data`.

---

## Definition of Done Фазы 0

- [x] Все 8 пунктов чек-листа проверены.
- [x] Дополнительные находки (A–F) зафиксированы.
- [x] Open Questions OQ2 и OQ9 закрыты.
- [x] Отчёт доступен по пути `docs/design-docs/ADMIN-PANEL-AUDIT.md`.
- [x] Новый риск R10 добавлен.
- [x] Трудозатраты пересмотрены (итог — не меняется).

---

## Следующий шаг

**Старт Фазы 1** — «Роль admin + guard + первый админ». Блокеров нет.
