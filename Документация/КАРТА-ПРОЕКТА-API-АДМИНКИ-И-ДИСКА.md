# Карта проекта, API, админки и диска

Аудит по исходникам локального репозитория на 2026-09-28. Это карта *реализации*, а не утверждение, что каждый сценарий проверен в production. Ниже список HTTP-обработчиков получен из декораторов FastAPI; динамические маршруты и фактическая доступность зависимостей могут требовать отдельной runtime-проверки. Никакие данные не удалены.

## 1. Контуры и зависимости

```text
Браузер / React 19 + Vite 8 + TypeScript
  ├─ публичные страницы: каталог, товар, пространства, конфигуратор,
  │  визуализатор, корзина/checkout, подписки, контент
  ├─ личный кабинет: профиль, заказы, проекты, избранное, подписка
  └─ /admin: dashboard, заказы, пользователи, каталог, магазин, аудит
       │ API-клиент fetch (JWT Bearer), multipart XHR, presigned PUT в S3
       ▼
FastAPI: app/main.py → app/infrastructure/api/**
  ├─ dependency: токен/роль (utils/dependencies.py)
  ├─ application/**: сценарии CRUD, расчётов, валидации и переходов
  ├─ domain/**: сущности, правила, интерфейсы репозиториев
  └─ container.py → infrastructure/persistence/** → PostgreSQL (DATABASE_URL)
                 → infrastructure/storage/** → S3 или локальные uploads
                 → process-memory: сессии конфигуратора, отдельные временные данные
                 → AI preview: внешний multimodal API (при настройке ключа)
Nginx / Vite proxy: /api → FastAPI; /uploads → локальные файлы по конфигурации
```

Исходники: `frontend/src/shared/router.tsx`, `frontend/src/shared/api/client.ts`, `backend/app/main.py`, `backend/app/container.py`. Основные frontend-зависимости: React, Ant Design, React Router, Zustand, TanStack Query, Framer Motion, Konva, OpenCV.js, Transformers.js; dev: Vite, TypeScript, Vitest. Backend: FastAPI, Pydantic, SQLAlchemy/asyncpg/Alembic, JWT, boto3, Pillow, OpenCV/NumPy; Redis указан как зависимость/URL, но `backend/app/utils/cache.py` описывает process-local cache без Redis. `backend/requirements.txt` включает aiosqlite для тестов миграций; production БД — PostgreSQL, не SQLite.

Контейнер выбирает SQL-репозитории при `USE_MEMORY_REPOS=false` (значение по умолчанию); in-memory реализации остаются для тестов/dev. Админское разграничение: UI `RequireAdmin` проверяет сохранённую роль, серверные `/api/admin/*` проверяют JWT/роль через `get_current_admin_id` в обработчиках; отдельные use cases повторно читают роль. Не следует считать UI-проверку достаточной защитой API.

**Важные несоответствия для последующей проверки:**
- `docker-compose.yml` передаёт `MEDIA_STORAGE_ROOT` и монтирует том uploads, но не передаёт S3 credentials/`USE_S3` в backend. При default `USE_S3=true` этот compose-путь не тождественен локальной записи в том; фактические runtime env нужно проверять отдельно.
- `backend/app/infrastructure/api/admin/textures_visualization.py` объявляет пути начиная с `/admin/texture-visualizations`, а весь admin-router уже подключён под `/api/admin`: результирующий префикс **`/api/admin/admin/texture-visualizations`**, если нет иных переписанных путей. Это возможное расхождение с клиентом, не исправлялось в рамках карты.
- `configurator.py` хранит `_SESSIONS` в RAM с TTL 30 дней: перезапуск backend теряет сессии независимо от наличия PostgreSQL/S3. Восстановление на клиенте не эквивалентно серверной persistence.
- Наличие S3 credentials локально и успешные read-only `head_bucket`/`list_objects_v2` в предыдущей диагностике подтверждают доступ к бакету, но не подтверждают сквозную загрузку из браузера или production-конфигурацию.

## 2. Слои backend

| Слой | Где | За что отвечает |
|---|---|---|
| HTTP | `backend/app/infrastructure/api/` | Разбор запросов, авторизация через Depends, схемы, коды ошибок |
| Сценарии | `backend/app/application/` | Бизнес-операции: каталог, заказы, подписки, пользователи, медиа, визуализатор, магазин, аналитика, аудит |
| Домен | `backend/app/domain/` | Сущности/правила, контракты репозиториев |
| Хранение | `backend/app/infrastructure/persistence/` | SQLAlchemy модели, SQL- и тестовые memory-репозитории; миграции в `backend/alembic/` |
| Медиа | `backend/app/infrastructure/storage/` | `s3_storage.py` — FileStorage для загрузок медиа; `s3.py` — presigned URL и ключи вариантов; `local.py` — локальный адаптер |
| Безопасность | `backend/app/infrastructure/security/`, `backend/app/utils/dependencies.py` | JWT, rate limit, заголовки, проверки ролей |

Основной поток запроса: `router → Depends(get_current_user_id/get_current_admin_id и repo) → application use case → domain rules → repo/storage → response`. Операции создания/изменения заказа, каталога и медиаресурсов в разных bounded contexts — не одна большая таблица и не один handler. Глобальные преобразователи доменных ошибок в HTTP зарегистрированы в `backend/app/main.py`.

## 3. Админка: экраны → API → бизнес-логика

| Экран | Frontend | Backend router / префикс | Основная логика |
|---|---|---|---|
| Dashboard | `domains/admin/ui/AdminDashboardPage.tsx`, `api/analyticsApi.ts` | `admin/dashboard.py` | Агрегированная аналитика из репозиториев |
| Заказы и детали | `AdminOrdersPage.tsx`, `AdminOrderDetailPage.tsx`, `api/ordersAdminApi.ts` | `admin/orders.py` | Список, детали, статусные переходы, заметки; правила в `domain/order` и `application/order` |
| Пользователи | `AdminUsersPage.tsx`, `AdminUserDetailPage.tsx`, `api/usersAdminApi.ts` | `admin/users.py` | Список, блокировка, назначение/отзыв роли; защита последнего админа |
| Каталог | `AdminCatalogPage.tsx`, `api/*AdminApi.ts` | `admin/catalog.py`, `panels.py`, `panel_variants.py`, `textures.py`, `panel_texture_assignments.py`, `recommendations.py`, `textures_visualization.py` | Категории, дизайны, панели, варианты, фактуры, цвета, назначения, изображения и рекомендации |
| Загрузка медиа | `AdminUploadPage.tsx`, `lib/uploadFile.ts` | `admin/media.py`, `admin/uploads.py` | Multipart upload через API с проверкой файла; отдельно presigned PUT напрямую в S3 для фото вариантов |
| Магазин | `AdminShopPage.tsx`, `api/shopAdminApi.ts` | `admin/shop_settings.py`, `banners.py`, `subscription_plans.py` | Настройки, баннеры, тарифы |
| Аудит | `AdminAuditPage.tsx`, `api/auditApi.ts` | `admin/audit.py` | Чтение журнала административных действий |

Меню `AdminLayout` содержит Dashboard, Заказы, Пользователи, Каталог, Магазин, Аудит. В `AdminCatalogPage` восемь вкладок: варианты панелей, базовые формы, текстуры, варианты исполнений, цвета, фото в дизайне, рекомендации, изображения. Старые admin URL перенаправляются на вкладки каталога в `frontend/src/shared/router.tsx`.

## 4. Реестр ручек

Ниже перечислены все статически найденные `@router.get/post/put/patch/delete` из `backend/app/infrastructure/api/` с именами обработчиков. Для admin-файлов префикс `/api/admin`, для остальных — как указан в `backend/app/main.py`. `GET /api/health` зарегистрирован прямо в `main.py`. Реестр позволяет проследить каждый handler до логики и не подменяет OpenAPI/runtime-тест.

<!-- GENERATED ROUTES START -->
Статически найдено **148** обработчиков в router-файлах, из них **92** административных; дополнительно `GET /api/health` в `main.py`.

### `admin/audit.py` — 1
- `GET /api/admin/audit` → `list_audit_entries`

### `admin/auth.py` — 1
- `GET /api/admin/me` → `admin_me`

### `admin/banners.py` — 5
- `GET /api/admin/shop/banners` → `list_banners_admin`
- `GET /api/admin/shop/banners/{banner_id}` → `get_banner_admin`
- `POST /api/admin/shop/banners` → `create_banner_admin`
- `PATCH /api/admin/shop/banners/{banner_id}` → `update_banner_admin`
- `DELETE /api/admin/shop/banners/{banner_id}` → `delete_banner_admin`

### `admin/catalog.py` — 10
- `GET /api/admin/categories` → `list_categories_admin`
- `POST /api/admin/categories` → `create_category_admin`
- `PATCH /api/admin/categories/{category_id}` → `update_category_admin`
- `DELETE /api/admin/categories/{category_id}` → `delete_category_admin`
- `GET /api/admin/designs` → `list_designs_admin`
- `GET /api/admin/designs/{design_id}` → `get_design_admin`
- `POST /api/admin/designs` → `create_design_admin`
- `PATCH /api/admin/designs/{design_id}` → `update_design_admin`
- `POST /api/admin/designs/{design_id}/toggle-visibility` → `toggle_design_visibility_admin`
- `DELETE /api/admin/designs/{design_id}` → `delete_design_admin`

### `admin/dashboard.py` — 1
- `GET /api/admin/analytics/dashboard` → `dashboard`

### `admin/media.py` — 3
- `GET /api/admin/media/constraints` → `get_constraints`
- `POST /api/admin/media` → `upload_media`
- `DELETE /api/admin/media/{asset_id}` → `delete_media`

### `admin/orders.py` — 4
- `GET /api/admin/orders/{order_id}` → `get_order_admin`
- `PATCH /api/admin/orders/{order_id}/status` → `update_order_status_admin`
- `POST /api/admin/orders/{order_id}/notes` → `add_order_note_admin`
- `GET /api/admin/orders` → `list_orders_admin`

### `admin/panel_texture_assignments.py` — 4
- `GET /api/admin/panel-texture-assignments` → `list_panel_texture_assignments`
- `PUT /api/admin/panels/{panel_id}/texture-assignments` → `replace_panel_texture_assignments`
- `DELETE /api/admin/panel-texture-assignments/{assignment_id}` → `disable_panel_texture_assignment`
- `POST /api/admin/panel-texture-assignments/batch` → `batch_panel_texture_assignments`

### `admin/panel_variants.py` — 15
- `GET /api/admin/panel-variants` → `list_panel_variants_admin`
- `GET /api/admin/panel-variants/{variant_id}` → `get_panel_variant_admin`
- `POST /api/admin/panel-variants` → `create_panel_variant_admin`
- `POST /api/admin/panel-variants/batch` → `create_panel_variants_batch_admin`
- `PATCH /api/admin/panel-variants/{variant_id}` → `update_panel_variant_admin`
- `PATCH /api/admin/panel-variant-rows/texture` → `update_panel_variant_row_texture_admin`
- `PATCH /api/admin/panel-variant-groups/reorder` → `reorder_panel_variants_admin`
- `POST /api/admin/panel-variants/{variant_id}/images` → `add_variant_image_admin`
- `DELETE /api/admin/panel-variants/{variant_id}/images/{image_path:path}` → `remove_variant_image_admin`
- `PATCH /api/admin/panel-variants/{variant_id}/reorder` → `reorder_variant_images_admin`
- `POST /api/admin/panel-variant-groups/duplicate` → `duplicate_panel_variant_group_admin`
- `DELETE /api/admin/panel-variant-rows` → `delete_panel_variant_row_admin`
- `DELETE /api/admin/panel-variant-groups` → `delete_panel_variant_group_admin`
- `DELETE /api/admin/panel-variants/{variant_id}` → `delete_panel_variant_admin`
- `PATCH /api/admin/panel-variant-rows/activity` → `update_panel_variant_row_activity_admin`

### `admin/panels.py` — 7
- `GET /api/admin/panels` → `list_panels_admin`
- `POST /api/admin/panels/sizes` → `create_panel_sizes_admin`
- `GET /api/admin/panels/{panel_id}` → `get_panel_admin`
- `POST /api/admin/panels` → `create_panel_admin`
- `POST /api/admin/panels/{panel_id}/duplicate` → `duplicate_unassigned_panel_admin`
- `PATCH /api/admin/panels/{panel_id}` → `update_panel_admin`
- `DELETE /api/admin/panels/{panel_id}` → `delete_panel_admin`

### `admin/recommendations.py` — 5
- `GET /api/admin/recommendations` → `list_recommendations_admin`
- `GET /api/admin/recommendations/{source_type}/{source_id}` → `get_recommendation_admin`
- `PUT /api/admin/recommendations/{source_type}/{source_id}` → `upsert_recommendation_admin`
- `POST /api/admin/recommendations/{source_type}/{source_id}/copy-from` → `copy_recommendations_admin`
- `DELETE /api/admin/recommendations/{source_type}/{source_id}` → `delete_recommendation_admin`

### `admin/shop_settings.py` — 2
- `GET /api/admin/shop/settings` → `get_shop_settings_admin`
- `PATCH /api/admin/shop/settings` → `patch_shop_settings_admin`

### `admin/subscription_plans.py` — 5
- `GET /api/admin/subscription-plans` → `list_plans_admin`
- `GET /api/admin/subscription-plans/{plan_id}` → `get_plan_admin`
- `POST /api/admin/subscription-plans` → `create_plan_admin`
- `PATCH /api/admin/subscription-plans/{plan_id}` → `update_plan_admin`
- `DELETE /api/admin/subscription-plans/{plan_id}` → `delete_plan_admin`

### `admin/textures.py` — 15
- `GET /api/admin/textures` → `list_textures_admin`
- `POST /api/admin/textures` → `create_texture_admin`
- `PATCH /api/admin/textures/{texture_id}` → `update_texture_admin`
- `DELETE /api/admin/textures/{texture_id}` → `delete_texture_admin`
- `GET /api/admin/textures/{texture_id}/colors` → `list_texture_colors_admin`
- `POST /api/admin/textures/{texture_id}/colors` → `create_texture_color_admin`
- `PATCH /api/admin/texture-colors/{color_id}` → `update_texture_color_admin`
- `DELETE /api/admin/texture-colors/{color_id}` → `delete_texture_color_admin`
- `GET /api/admin/texture-combination-images` → `list_texture_combination_images_admin`
- `POST /api/admin/texture-combination-images` → `create_texture_combination_image_admin`
- `PATCH /api/admin/texture-combination-images/{combination_id}` → `update_texture_combination_image_admin`
- `DELETE /api/admin/texture-combination-images/{combination_id}` → `delete_texture_combination_image_admin`
- `GET /api/admin/variant-images` → `list_variant_images_admin`
- `POST /api/admin/variant-images` → `create_variant_image_admin`
- `DELETE /api/admin/variant-images/{variant_id}` → `delete_variant_image_admin`

### `admin/textures_visualization.py` — 5
- `GET /api/admin/admin/texture-visualizations` → `list_texture_visualizations`
- `GET /api/admin/admin/texture-visualizations/{viz_id}` → `get_texture_visualization`
- `POST /api/admin/admin/texture-visualizations` → `create_texture_visualization`
- `PATCH /api/admin/admin/texture-visualizations/{viz_id}` → `update_texture_visualization`
- `DELETE /api/admin/admin/texture-visualizations/{viz_id}` → `delete_texture_visualization`

### `admin/uploads.py` — 3
- `POST /api/admin/upload/presigned` → `get_presigned_upload_url`
- `POST /api/admin/upload/temp` → `get_temp_upload_url`
- `GET /api/admin/upload/config` → `get_upload_config`

### `admin/users.py` — 6
- `GET /api/admin/users` → `list_users_admin`
- `GET /api/admin/users/{user_id}` → `get_user_admin`
- `POST /api/admin/users/{user_id}/block` → `block_user`
- `POST /api/admin/users/{user_id}/unblock` → `unblock_user`
- `POST /api/admin/users/{user_id}/grant-admin` → `grant_admin`
- `POST /api/admin/users/{user_id}/revoke-admin` → `revoke_admin`

### `ai_preview.py` — 1
- `POST /api/visualizer/ai-preview` → `generate_preview`

### `auth.py` — 6
- `POST /api/auth/register` → `register`
- `POST /api/auth/login` → `login`
- `GET /api/auth/me` → `me`
- `PATCH /api/auth/me` → `update_profile`
- `POST /api/auth/forgot-password` → `forgot_password`
- `POST /api/auth/reset-password` → `reset_password`

### `calculate.py` — 2
- `POST /api/calculate` → `calculate_project_endpoint`
- `GET /api/calculate/panel-sizes` → `get_panel_sizes`

### `catalog.py` — 14
- `GET /api/designs` → `list_designs`
- `GET /api/designs/{design_id}` → `get_design`
- `GET /api/categories` → `list_categories`
- `GET /api/designs/{design_id}/reviews` → `get_reviews`
- `GET /api/panels` → `list_panels_public`
- `GET /api/recommendations/{source_type}/{source_id}` → `get_public_recommendations`
- `POST /api/designs/{design_id}/reviews` → `add_review`
- `GET /api/textures` → `list_textures_public`
- `GET /api/textures/{texture_id}/colors` → `list_texture_colors_public`
- `GET /api/textures/{texture_id}/visualization` → `get_texture_visualization_public`
- `GET /api/designs/{design_id}/textures` → `list_design_textures`
- `GET /api/designs/{design_id}/variant-image` → `get_variant_image`
- `GET /api/designs/{design_id}/full-config` → `get_full_config`
- `GET /api/panel-variants` → `list_panel_variants_public`

### `configurator.py` — 5
- `POST /api/configurator/sessions` → `create_session`
- `GET /api/configurator/sessions/{session_id}` → `get_session`
- `PUT /api/configurator/sessions/{session_id}` → `update_session`
- `POST /api/configurator/sessions/{session_id}/proposals` → `generate_proposals`
- `POST /api/configurator/stitch` → `stitch_panorama`

### `contacts.py` — 2
- `POST /api/contacts` → `submit_contact`
- `POST /api/calculator` → `calculate`

### `orders.py` — 4
- `POST /api/orders` → `create_order`
- `GET /api/orders` → `list_orders`
- `GET /api/orders/{order_id}` → `get_order`
- `POST /api/orders/calculate` → `calculate_cost`

### `projects.py` — 5
- `POST /api/projects` → `create_project`
- `GET /api/projects` → `list_projects`
- `GET /api/projects/{project_id}` → `get_project`
- `PUT /api/projects/{project_id}` → `update_project`
- `DELETE /api/projects/{project_id}` → `delete_project`

### `shop.py` — 4
- `GET /api/shop/settings` → `get_shop_settings_public`
- `GET /api/shop/banners` → `list_banners_public`
- `GET /api/subscription-plans` → `list_plans_public`
- `POST /api/quick-calculate` → `quick_calculate`

### `subscriptions.py` — 4
- `GET /api/subscriptions/plans` → `list_plans`
- `POST /api/subscriptions` → `subscribe`
- `GET /api/subscriptions/status` → `get_status`
- `DELETE /api/subscriptions` → `cancel`

### `visualizer.py` — 9
- `POST /api/visualizer/projects` → `create_visualization_project`
- `GET /api/visualizer/projects` → `list_visualization_projects`
- `GET /api/visualizer/projects/{project_id}` → `get_visualization_project`
- `PUT /api/visualizer/projects/{project_id}` → `update_visualization_project`
- `DELETE /api/visualizer/projects/{project_id}` → `delete_visualization_project`
- `PATCH /api/visualizer/projects/{project_id}/perspective` → `patch_perspective`
- `PATCH /api/visualizer/projects/{project_id}/calibration` → `patch_calibration`
- `POST /api/visualizer/projects/auto-perspective` → `auto_perspective_inline`
- `POST /api/visualizer/projects/{project_id}/auto-perspective` → `auto_perspective`
<!-- GENERATED ROUTES END -->

## 5. Что именно занимает локальный диск

Снимок `promto_disk` на 2026-09-28: лимит 10 GB; видимые размеры файлов ~6.9 GB, оценка запаса ~3.1 GB. Это **apparent file sizes**, в том числе файлы базового образа; метрика не равна только записанным пользователем байтам. `du` показывает несколько другие цифры из-за единиц и способа учёта; ниже цифры именно `promto_disk`. Не складывать дочернюю папку с родительской дважды.

| Место | Размер | Назначение |
|---|---:|---|
| `/home/user/wonder-wow-wall` | ~1.2 GB | **Весь проект с установленными пакетами, сборкой и Git-историей** |
| `.../frontend/node_modules` | ~1018.5 MB | Установленные npm-пакеты; `onnxruntime-node` ~512 MB, `onnxruntime-web` ~128 MB; AntD ~46.6 MB; сборочные бинарники и пр. |
| `.../frontend/dist` | ~64.6 MB | Результат сборки: повторяет часть `public`, не исходный код |
| `.../frontend/public` | ~61.9 MB | Статические медиа и данные фронтенда |
| `.../.git` | ~65.6 MB | История **именно проекта** |
| `.../backend` | ~7.4 MB | Backend с тестами; `frontend/src` отдельно ~2.2 MB |
| `/home/user/.cache` | ~632 MB | Преимущественно rustup/toolchains (~592 MB), вне проекта |
| `/home/user/.pi-promto-sidecar` | ~590 MB | Рабочая среда и журнал агента, вне проекта |
| `/home/user/.git` | ~514 MB | Git-объекты **корня рабочей области**, отдельные от Git-истории проекта |
| `/home/user/.pi-lens` | ~446 MB | Инструменты и данные среды, вне проекта |
| `/home/user/.promto-cli-proxy` | ~335 MB | Зависимости вспомогательного инструмента, вне проекта |
| `/home/user/.codex` | ~105 MB | Файлы среды, вне проекта |
| `/home/user/Загруженные_в_чат_файлы` | ~75 MB | Загруженные в чат пользовательские файлы |
| `/home/user/screenshots` | ~58 MB | Скриншоты |
| `/usr` | ~2.0 GB | Предустановленное ПО: `code-server` ~599 MB, системные библиотеки x86_64 ~561 MB, `/usr/local` ~195 MB, `/usr/bin` ~142 MB, `/usr/share` ~141 MB, `/usr/libexec` ~124 MB |
| `/opt` | ~644 MB | В основном установленный Node.js |
| `/tmp` | ~360 MB | Временные данные; `panel-prod-baseline` ~145 MB, `production-frontend-source-*` ~27 MB и пр. |

**Итого:** проект — примерно 1.2 GB из 6.9 GB видимых файлов. При этом его исходники составляют лишь малую часть: самый большой элемент — локальные npm-пакеты. Остальные ~5.7 GB состоят из окружения, инструментов, кешей и временных файлов по всей файловой системе, а не из S3. Ничего не чистилось: не удалять проект, `.git`, секреты, пользовательские загрузки и рабочие данные вслепую. Большие `onnxruntime-*` нельзя объявить ненужными без проверки графа зависимостей и используемых ML-функций.
