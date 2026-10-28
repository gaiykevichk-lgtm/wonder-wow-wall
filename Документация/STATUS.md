## 2026-09-14 — TLS/автопродление сертификата

- Диагностирована причина истечения: HTTP-01 challenge после редиректа на HTTPS попадал в SPA, поэтому Certbot получал 403 вместо challenge-файла.
- Выпущен единый ECDSA-сертификат Let’s Encrypt для `wonderwowwall.ru` и `www.wonderwowwall.ru`, действующий до 2026-12-13 15:07:03 UTC.
- На production nginx маршрут `/.well-known/acme-challenge/` обслуживается из `/var/www/html` по HTTP и HTTPS; добавлен deploy-hook проверки и reload nginx после продления.
- Добавлены HSTS и CSP `upgrade-insecure-requests`; ACME-маршрут, TLS-цепочка, оба имени и прод-страница `/catalog` проверены снаружи.

# Wonder Wow Wall — Текущий статус

## Последнее обновление — 2026-09-13 (Spaces: доведение ТЗ 06 до конца — режим, цены, чистые фильтры)

- **«Пространства» (`/spaces`) — закрыты оставшиеся пробелы против ТЗ 06 (commit `6ad668d`):**
  - **SPC-06/SPC-07 — режим моно/комбинация:** переключатель был косметическим (менял только подпись бейджа). Теперь в данных есть `mode` (mono|combined), `areaM2`, `panelSize` для всех 14 сцен; модалка открывается в «родном» режиме интерьера; добавлена `WallLayoutPreview` — схема раскладки панелей, которая реально меняется и от фактуры (цвет поясов), и от режима (моно = одна фактура, комбинация = вертикальные пояса). Пропорции ячеек из `panelSize`; для 300×600 — меньше рядов, чтобы не растягивалось на 360px.
  - **SPC-10 — цены:** добавлены `estimateSpacePrice`/`formatSpacePrice` на тех же константах, что каталог и конфигуратор (`BASE_PANEL_PRICES` + `DESIGN_OVERLAY_PRICE`), чтобы цифры не расходились с корзиной. Цена видна в карточке.
  - **Чистые фильтры:** `availableRoomOptions`/`availableZoneOptions` показывают только то, под что есть реальные сцены — «Ресторан» (SPC-03) больше не даёт пустой выдачи; устаревший `room` из URL считается «все типы».
  - **Свотч фактуры** в подписи фото — смена фактуры даёт отклик и на изображении.
  - `validateSpacesData` ужесточён: `mode`, положительная площадь, известный `panelSize`, для combined — минимум 2 фактуры.
  - **Тесты: +19 проверок** (69 в content, **814 всего / 74 файла — все зелёные**).
  - **Деплой:** bundle `index-DIKd_qF_.js` + `index-BdDgSXQx.css` + `SpacesPage-D_Gml_8l.js` на wonderwowwall.ru. `/spaces` → HTTP 200. Скриншот 322 KB, 1147 цветов — реальный контент (тёмные editorial-карточки 35.9%, белый текст 0.9%, серый UI 4.7%, синий CTA 0.2%).

## Последнее обновление — 2026-09-13 (Spaces: план PLAN-SPACES выполнен полностью)

- **«Пространства» (`/spaces`) — все 6 фаз плана [PLAN-SPACES](../docs/exec-plans/completed/PLAN-SPACES.md) закрыты:**
  - Данные вынесены в `public/content/spaces.json` + `useSpacesInteriors()` со состояниями loading/error/success и retry; `validateSpacesData()` — доменная проверка целостности.
  - SPC-08: все `textures[]` интерьера ссылаются на ту же сцену (раньше подставлялись фото других комнат).
  - Фильтры синхронизированы с URL (`cat/room/zone/style/tex`), сброс зависимых фильтров, пустая комбинация → reset без перезагрузки.
  - ТЗ-19: переход в карточку панели с `interiorId`/`variantId`; бейдж «Из интерьера» + предвыбор текстуры по семейству фактуры; в модалке — быстрая смена панели (relatedPanels).
  - A11y (SPC-10): roving tabindex + стрелки/Home/End в фильтрах, `aria-pressed`, focus-visible; в модалке — стрелки ←/→ и свайп.
  - Hero (SPC-11/SPC-12): убраны декоративные рамки; триггер раскрытия — завершение жеста скролла (settle-анимация до целостного состояния); `prefers-reduced-motion` — контент сразу без 3D.
  - Тесты: целостность `spaces.json`, поведение `SpacesPage`, контекст в `CatalogPanelPage`. Всего frontend: **781 тест / 73 файла — все зелёные**.
  - Заодно актуализированы устаревшие проверки: HomePage (копирайт), theme (шрифт SF Pro Display), imageProcessing (MIN_WIDTH=600).
- **Деплой:** bundle `index-CGAClntV.js` на wonderwowwall.ru, `/spaces` — HTTP 200.

## Последнее обновление — 2026-09-13 (Configurator: светлая тема + guard visibleStep)

- **Конфигуратор — визуальный фикс (commit `06407ea`):**
  - **CSS:** блок `www-configurator-*`, `upload-card`, `dialog-*`, `zone-*`, `proposal-*` переписан со «слепой тёмной темы» (`rgba(255,255,255,*)` на прозрачном фоне, невидимой на белой странице) на светлую дизайн-систему: `#2D2D2D` текст, `#E5E7EB` рамки, `#F5F5F5/#FAFAFA` фоны, `#4CAF50` зелёный акцент, белые карточки с мягкой тенью `0 1px 2px rgba(0,0,0,0.04)`, степпер-пиллы `active` → тёмный `#2D2D2D` с белым текстом, `done` → белый с зелёной рамкой.
  - **Guard `visibleStep`:** добавлен derived-state `visibleStep = step>1 && !sessionUsable ? 1 : step` (`sessionUsable = !!sessionId && !sessionQuery.isError`). Без него у пользователя, который раньше дошёл до шага 2/3, а потом открыл страницу с мёртвой/просроченной сессией (мобильный браузер убил вкладку, бэкенд перезапустился, TTL истёк), рендерилась **полностью пустая страница** — только степпер и футер, без контента. Это объясняет жалобу «на мобильной вёрстке он не работает и выглядит по старому»: прод-кэш здесь ни при чём (index.html идёт с `Cache-Control: no-cache, no-store, must-revalidate`, CDN нет, DNS указывает напрямую на VM), причина была чисто в localStorage + клиентском guard'е.
  - **Loading state:** добавлен `<Spin size="large" />` для шага ≥2 пока `sessionQuery.isLoading` — устраняет мерцание пустоты сразу после успешной загрузки фото.
  - Мобильный breakpoint `@media (max-width: 860px)` сохранён и расширен: padding step-panel `20px 16px`, склейка колонок `two-col`, уменьшенные border-radius.
  - **Прод-верификация (визуальный + программный анализ скриншота 1440×900):** размер 60 KB (было 36 KB на тёмной), 692 уникальных цвета (было 209), присутствуют `#2D2D2D` (0.59%, тёмный текст и активный пилл), `#4CAF50` (0.17%, зелёный акцент), `#D8DBE0` (0.16%, пунктирная рамка dropzone), `#6B7280` (вторичный текст), `#F5F5F5` (78.8%, фон). Vision-баланс исчерпан, поэтому для визуального подтверждения использован программный анализ палитры.
  - Деплой: bundle `index-DWDikar1.js` + `index-rgP2VxkH.css`, новая страница `/configurator` отвечает HTTP 200. Тесты: **795 frontend (74 файла, все зелёные)**.

## Последнее обновление — 2026-09-13 (Configurator + TZ 07)

- **Конфигуратор (`/configurator`) — полная интеграция с backend per TZ 07:**
  - Backend: новый `/api/configurator/*` router (sessions, GET/PUT, proposals, stitch). `MediaPurpose.CONFIGURATOR_PHOTO` (20 MB cap, jpeg/png/webp, 480×480..6000×6000). OpenCV-headless для панорамной склейки (CFG-01). 12 backend-тестов.
  - Frontend: `ConfiguratorAiPage` полностью переписан на TanStack Query. Multipart upload, instruction modal на первом визите (CFG-02), зона-выделение drag-прямоугольником (CFG-05), 3 варианта с swipe (CFG-06), реальные `preview_url` с фото пользователя (CFG-07), разные фактуры и покрытия (CFG-08), «Заказать» → cart (CFG-10).
  - Real production smoke-test на `wonderwowwall.ru`: все 5 эндпоинтов отвечают корректно (404, 422 с русскими сообщениями, 200 с 3 вариантами).

## Последнее обновление интерфейса — 2026-09-10 (Spaces)

- **Страница «Пространства» (`/spaces`)** — редизайн после фидбэка:
  - Все картинки интерьеров теперь локальные (никаких внешних Unsplash URL): используются `/scenarios/*` и `/interiors/*` с реальными фото из проекта.
  - В галерее 3D Parallax Unfurling убрана рамка баннера (никакого `border-radius` и `border-width`).
  - Уменьшена высота sticky-секции с 450vh → 180vh, чтобы пользователь успевал досмотреть анимацию прежде, чем докрутить до каталога.
  - Текст заголовка и подзаголовка в hero-блоке получил тёмный backdrop и text-shadow для читаемости поверх картинок.
  - Скругление матрицы и стартовая 3D-ротация ослаблены (rotateY: -18° → -2°, rotateX: 10° → 2°).
  - Все пути изображений унифицированы через `IMG`-константу в `spacesData.ts`.

## Последнее обновление интерфейса — 2026-09-10

- **Админка «Управление наполнением» объединена в единый раздел «Каталог»** с 7 вкладками:
  1. Варианты панелей
  2. Базовые формы
  3. ФАКТУРЫ (бывшие Текстуры)
  4. Цвета
  5. Моно изображения (новая вкладка — texture visualizations)
  6. Комбинаций изображения
  7. Рекомендации
- Левое меню упрощено: Дашборд, Заказы, Пользователи, Каталог, Магазин, Аудит.
- Старые URLы `/admin/textures`, `/admin/panels`, `/admin/upload`, `/admin/recommendations` продолжают работать через redirect.

## Последнее обновление интерфейса — 2026-09-09

- Заголовочный блок страницы панели сделан компактнее.
- Заголовок и пояснения выровнены по левому краю превью (строго по левой границе карточки/колонки).
- На мобильных и планшетных экранах сохранено аккуратное выравнивание по левому краю.

## Общий статус

| Аспект | Статус | Описание |
|--------|--------|----------|
| Frontend | ✅ Готов | MVP реализован, покрыт тестами |
| Backend API | ✅ Готов | DDD архитектура, 25+ эндпоинтов, JWT auth |
| Database | ⚙️ Готов (in-memory) | ORM модели готовы, миграции не созданы |
| Infrastructure | ⚙️ Готов (dev) | Docker Compose настроен, production deployment возможен |
| Testing | ✅ Высокий | 781 frontend-тест (vitest, 73 файла — все зелёные); backend — отдельный pytest-набор |
| Documentation | 🔄 В процессе | Текущая документация обновляется |

## Реализованные фичи

### Frontend (React SPA)

| Фича | Статус | Тесты |
|------|--------|-------|
| Каталог дизайнов | ✅ Готово | — |
| Фильтры и поиск | ✅ Готово | — |
| Страница товара | ✅ Готово | — |
| Конструктор стен | ✅ Готово | 9 тестов |
| Фото-редактор стен | ✅ MVP | 156 тестов |
| Корзина (Drawer) | ✅ Готово | 1 тест |
| Checkout (3 шага) | ✅ Готово | — |
| Подписка | ✅ Готово | 1 тест |
| Авторизация | ✅ Готово | 1 тест |
| Личный кабинет | ✅ Готово | 1 тест |
| Информационные страницы | ✅ Готово | — |
| Избранное | ✅ Готово | 1 тест |

**Технические метрики:**
- Строк кода: ~15 000
- React-компонентов: ~80
- Bounded Contexts: 8
- Zustand stores: 5
- TanStack Query hooks: ~20

### Backend (FastAPI)

| Компонент | Статус | Тесты |
|-----------|--------|-------|
| Auth (register, login, JWT) | ✅ Готово | 18 |
| Catalog API (designs, categories, reviews) | ✅ Готово | 19 |
| Orders API (CRUD, calculate) | ✅ Готово | 17 |
| Subscriptions API (plans, subscribe, cancel) | ✅ Готово | 15 |
| Projects API (CRUD) | ✅ Готово | — |
| Contacts API | ✅ Готово | — |
| Calculator API | ✅ Готово | 7 |

**Технические метрики:**
- Строк кода: ~10 000
- API эндпоинтов: 25+
- Domain entities: 12
- Value objects: 10
- Use cases: ~30

## Следующие шаги (Roadmap)

### Ближайшие задачи (1-2 спринта)

1. **Production Deployment**
   - [ ] Настроить CI/CD
   - [ ] Перенести на managed PostgreSQL
   - [ ] SSL/HTTPS сертификаты

2. **Payment Integration**
   - [ ] Интеграция с платёжной системой (ЮKassa / CloudPayments)
   - [ ] Обработка webhook-ов
   - [ ] Чеки и налогообложение

3. **ML Segmentation**
   - [ ] Интеграция Hugging Face Transformers для сегментации стен
   - [ ] Fallback на цветовую сегментацию (OpenCV)
   - [ ] Edge detection для определения границ

### Среднесрочные задачи (1-2 месяца)

4. **Admin Panel**
   - [ ] CRUD для дизайнов и категорий
   - [ ] Управление заказами
   - [ ] Статистика продаж
   - [ ] Email-рассылки

5. **Advanced Visualizer**
   - [ ] Depth estimation для перспективы
   - [ ] Warp-коррекция для наклонных поверхностей
   - [ ] Export в PDF/PNG

6. **Mobile App**
   - [ ] React Native обёртка
   - [ ] Camera integration
   - [ ] Offline режим для визуализатора

### Долгосрочные задачи

7. **E-commerce Features**
   - [ ] Купоны и скидки
   - [ ] Программа лояльности
   - [ ] Реферальная система

8. **Internationalization**
   - [ ] i18n (English, Deutsch)
   - [ ] Мультивалютность
   - [ ] Локализация контента

## Известные ограничения

| Ограничение | Описание | Workaround |
|-------------|----------|------------|
| In-memory repos | Данные не персистятся между рестами | Перейти на PostgreSQL |
| No migrations | Alembic настроен, миграции не созданы | Создать initial migration |
| No real payments | Заглушка для оплаты | Интегрировать платёжную систему |
| No email | Email notifications не реализованы | Интегрировать SMTP/SendGrid |
| No file storage | Заглушка для загрузки файлов | Настроить S3/MinIO |
| ML segmentation | Используется цветовая сегментация | Интегрировать ML model |

## Production Readiness

| Компонент | Готовность | Notes |
|-----------|------------|-------|
| API | ✅ 80% | Нужны: rate limiting, logging, monitoring |
| Frontend | ✅ 90% | SPA статичный, готов к деплою |
| Database | ⚠️ 60% | ORM готов, миграции нет |
| Auth | ✅ 85% | JWT работает, нужно добавить refresh tokens |
| Payment | ❌ 0% | Заглушка |
| Email | ❌ 0% | Не реализовано |
| Monitoring | ❌ 0% | Нужны: logs, metrics, alerts |
| Backup | ❌ 0% | Нужно настроить pg_dump |

## Тесты

### Frontend (156 tests)

```
src/
├── domains/
│   ├── visualizer/      9 files   # store, lib, adapters, components
│   ├── catalog/         1 file    # adapters
│   ├── order/          1 file    # cartStore
│   ├── subscription/   1 file    # subscriptionStore
│   ├── auth/           1 file    # authStore
│   └── account/        1 file    # accountStore
└── shared/
    ├── api/            2 files  # client, types
    └── config/         1 file   # constants
```

### Backend (97 tests)

```
tests/
├── domain/             4 files   # entities & value objects
│   ├── test_catalog.py          19 tests
│   ├── test_order.py            17 tests
│   ├── test_subscription.py    15 tests
│   └── test_user.py            10 tests
├── application/        2 files   # use cases
│   ├── test_catalog_use_cases.py   11 tests
│   └── test_order_use_cases.py       7 tests
└── api/                1 file    # integration
    └── test_api.py              18 tests
```

## Deployment

### Current

```
Production Server: ssh://root@72.56.37.191
Frontend + Backend: Docker Compose
Database: Managed PostgreSQL
Cache: Managed Redis
```

### Infrastructure Status

| Service | Provider | Status |
|---------|----------|--------|
| PostgreSQL | Managed (ru-3) | ✅ Active |
| Redis | Managed (ru-3) | ✅ Active |
| VM (Docker) | Cloud (ru-3) | ✅ Active |
| Domain | — | ⏳ Pending |
| SSL | — | ⏳ Pending |

## Метрики кода

| Metric | Frontend | Backend | Total |
|--------|----------|---------|-------|
| Files | ~150 | ~100 | ~250 |
| Lines of Code | ~15 000 | ~10 000 | ~25 000 |
| Tests | 156 | 97 | 253 |
| Test Coverage | ~60% | ~70% | ~65% |
| Components | ~80 | — | — |
| API Endpoints | — | 25+ | 25+ |
| Routes | 21 | — | 21 |

## Обновления (Changelog)

Последние значимые изменения:

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-07 | 1.0.0 | Visualizer MVP, 253 tests |
| 2026-06 | 0.9.0 | Backend DDD, 97 tests |
| 2026-05 | 0.8.0 | Account domain |
| 2026-04 | 0.7.0 | Subscription + Pricing |
| 2026-03 | 0.6.0 | Constructor + Cart |
| 2026-02 | 0.5.0 | Catalog + Auth |

## 2026-09-14 — светлая версия Spaces
Согласовано: оформление по каталогу и карточке товара. Удаляем матрицу hero,
фотокарточки назначения и тёмные контейнеры. Сохраняем URL-фильтры и текущую
модель данных. Реализация: SpacesPage.tsx + локальные SpacesPage.css.
Проверка: content vitest, build, HTTP /spaces и Preview. Публикация отдельно.

## 2026-09-18 — единая вкладка «Изображения» и несколько фото на выбор

- Вкладки «Моно изображения» и «Комбинации изображений» объединены во вкладку «Изображения».
- Внутри добавлен переключатель «Моно / Комбинации».
- Оба режима используют один сценарий: выбор одной текстуры или пары, загрузка нескольких фото, таблица и удаление отдельного фото.
- Снято уникальное ограничение `texture_combination_images(texture_id_1, texture_id_2)`: одна текстура или пара теперь содержит галерею из нескольких строк.
- Режим «Моно» хранится как `(texture_id, texture_id)`, комбинации — как нормализованная пара разных текстур.
- 6 прежних моно-изображений перенесены в единый список без удаления исходных записей.
- Production DB отмечена ревизией `030`; транзакционный smoke-test подтвердил две моно-фотографии одной текстуры и две фотографии одной пары, временные строки откатились.
- Frontend: TypeScript clean, build success, целевые тесты 22/22 и 40/40. Production bundle `index-Cebk5xLW.js`, SHA-256 совпадает на `wonderwowwall.ru`.
