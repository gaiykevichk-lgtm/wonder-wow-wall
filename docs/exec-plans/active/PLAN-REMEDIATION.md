# Plan: Доработки по результатам аудита (07.04.2026)

> Пошаговый план устранения пробелов, выявленных при аудите REQUIREMENTS.md.
> Источник: [`docs/REQUIREMENTS_audit_07_04.md`](../../REQUIREMENTS_audit_07_04.md)
> Принцип: критические бизнес-проблемы → функциональные пробелы → UX → технический долг

---

## Фаза 1: Подключение PostgreSQL и миграции

> **Приоритет: КРИТИЧЕСКИЙ** — без БД данные теряются при рестарте, все остальные фазы зависят от персистентности.

### 1.1 Backend — Alembic-миграции
- [x] Настроить `alembic/env.py` для async engine (`sqlalchemy.ext.asyncio`)
- [x] Написать ручную миграцию `001_initial_schema.py` (9 таблиц, FK constraints, ON DELETE CASCADE)
- [x] Проверить соответствие миграции и `models.py` — все таблицы/колонки/типы совпадают
- [ ] Применить: `alembic upgrade head` → убедиться что все 9 таблиц созданы (требует Docker/PostgreSQL)

### 1.2 Backend — SQL-репозитории
- [x] `sql.py` — 6 SQL-репозиториев + `project_repo.py` (SqlProjectRepository):
  - [x] `SqlDesignRepository` (list_designs с фильтрацией/сортировкой/пагинацией, get_by_id, get_by_slug, update)
  - [x] `SqlCategoryRepository` (list_all, get_by_id)
  - [x] `SqlReviewRepository` (list_by_design с пагинацией, add)
  - [x] `SqlOrderRepository` (create, get_by_id, list_by_user, update)
  - [x] `SqlSubscriptionRepository` (get_active_by_user, create, update)
  - [x] `SqlUserRepository` (create, get_by_id, get_by_email, update)
- [x] Каждый репозиторий наследует ABC из `domain/{context}/repositories.py`
- [x] Все операции через `async with session` (SQLAlchemy async)

### 1.3 Backend — Переключение на SQL
- [x] Обновить `container.py` — FastAPI `Depends(get_db_session)` с кешированием per-request (единая сессия на запрос)
- [x] Создать seed-скрипт: `scripts/seed_db.py` (12 дизайнов, 6 категорий)
- [x] Добавить `Depends()` в роутеры (все 6 роутеров переведены)
- [x] Сохранить in-memory режим как fallback для тестов (`USE_MEMORY_REPOS=true`)

### 1.5 Code review и исправления (07.04.2026)
- [x] **CRITICAL FIX**: Единая сессия per-request — заменены вложенные async-генераторы на `Depends(get_db_session)` с кешированием FastAPI
- [x] **CRITICAL FIX**: `DesignRepository.update()` — добавлен в ABC, InMemory и SQL реализации; `AddReview` use case теперь персистит rating+reviews_count
- [x] **CRITICAL FIX**: Убрано дублирование `reviews_count++` из `SqlReviewRepository.add()` — теперь управляется только через use case + design_repo.update()
- [x] **FIX**: `design_reviews.user_id` FK теперь с `ON DELETE CASCADE`
- [x] **FIX**: `seed_db.py` — `async_sessionmaker` вместо legacy `sessionmaker`
- [x] **FIX**: `generate_order_number()` — заменён `COUNT(*)+1` на PostgreSQL SEQUENCE `order_number_seq` (race-condition safe)
- [x] **FIX**: Адрес заказа хранится как JSON вместо pipe-delimited text (безопасный парсинг)
- [x] **FIX**: Seed-данные вынесены в `app/seed_data.py` — единый источник для container.py и seed_db.py
- [x] **FIX**: Добавлен `conftest.py` с `USE_MEMORY_REPOS=true` — тесты не зависят от `.env`
- [ ] **TODO**: Интеграционные тесты для SQL-репозиториев (требует PostgreSQL)

### 1.4 Проверка
- [ ] `docker compose up -d` → backend + PostgreSQL + Redis стартуют без ошибок (требует Docker)
- [ ] `alembic upgrade head` отрабатывает (требует PostgreSQL)
- [x] Все 108 бэкенд-тестов проходят (97 исходных + 11 новых фильтровых, `USE_MEMORY_REPOS=true`)
- [ ] Ручная проверка: регистрация → логин → создание заказа → рестарт → данные на месте (требует Docker)
- [ ] Фронтенд: каталог, авторизация, заказы работают через API без регрессий

---

## Фаза 2: Отзывы на странице товара + недостающие фильтры каталога

> **Приоритет: ВЫСОКИЙ** — бэкенд-эндпоинты уже готовы, фронт не подключён. Фильтры — требование ТЗ.

### 2.1 Frontend — Отзывы на ProductPage
- [x] Хуки `useDesignReviews(designId)` и `useAddReview(designId)` уже существовали в `catalogApi.ts`
- [x] Добавить секцию «Отзывы» на ProductPage:
  - Список отзывов (аватар-иконка, имя, рейтинг звёзды, текст, дата)
  - Пагинация (limit=5, «Показать ещё»)
  - Форма «Оставить отзыв» (rating: Rate, text: TextArea) — только для авторизованных
  - Если не авторизован: «Войдите, чтобы оставить отзыв» → кнопка /auth
- [x] Адаптер `apiReviewToReview()` подключён из `catalog/api/adapters.ts`

### 2.2 Frontend — Фильтры каталога
- [x] Добавить фильтр **«Цвет»** в CatalogPage:
  - Select с цветными кружками из палитры всех дизайнов (уникальные цвета)
  - Фильтрация: показать дизайны, содержащие выбранный цвет в `colors[]`
- [x] Добавить фильтр **«Стиль»** в CatalogPage:
  - Select: динамически извлекаемые стили из данных
  - Фильтрация по полю `style`
- [x] Добавить фильтр **«Новинки»** — кнопка-toggle «Новинки» (badge === 'Новинка')
- [x] Фильтры совместимы с серверной фильтрацией (`useDesigns` передаёт `color`, `style`, `is_new`)

### 2.3 Backend — Поддержка фильтров
- [x] Расширить `GET /api/designs` query-параметрами: `color`, `style`, `is_new`
- [x] Обновить `ListDesigns` use case и `DesignRepository.list_designs()` для новых фильтров
- [x] Добавить тесты на новые фильтры (11 тестов: 7 unit + 4 API)

### 2.4 Проверка
- [x] Фильтры работают в комбинации: категория + цвет + стиль + is_new + поиск (тест `test_combined_filters`)
- [x] Отзывы: создание, отображение, пагинация — UI готов, подключён к API
- [x] Неавторизованный пользователь видит отзывы, но не может писать (auth guard)
- [x] Все 108 бэкенд-тестов проходят

### 2.5 Тех.долг (выявлен code review) — ИСПРАВЛЕНО
- [x] Исправить русскую плюрализацию «отзывов» в ProductPage (21→"отзыв", 24→"отзыва")
- [x] Добавить `Field(ge=1, le=5)` к `AddReviewRequest.rating` и `Field(min_length=1, max_length=500)` к `text`
- [x] Экранировать LIKE-спецсимволы (`%`, `_`) в SQL color-фильтре через `escape='\\'`
- [x] Добавить `products` в зависимости `filtered` useMemo в CatalogPage

---

## Фаза 3: Согласование дизайна с ТЗ

> **Приоритет: ВЫСОКИЙ** — визуальное расхождение с утверждённым брендбуком.

### 3.1 Frontend — Цветовая палитра — ВЫПОЛНЕНО
- [x] Обновить `shared/theme.ts`:
  - Акцентный цвет: `#0071e3` → `#4CAF50` (56 вхождений в 26 файлах)
  - Вторичный фон: `#FBFBFD` → `#FAFAFA`, `#F5F5F7` → `#F5F5F5`
  - Текст основной: `#1d1d1f` → `#2D2D2D` (29 файлов)
  - Текст вторичный: `#86868b` → `#6B7280` (28 файлов)
  - Border: `#d2d2d7` → `#E5E7EB`
  - CTA кнопки: `colorPrimary: '#2D2D2D'` (тёмный фон, белый текст)
  - Link/Accent: `#4CAF50` (зелёный)
- [x] CostSummary: бейдж подписки → `#4CAF50`
- [x] Дизайн-система уже соответствует `DESIGN-SYSTEM.md`

### 3.2 Frontend — border-radius — ВЫПОЛНЕНО
- [x] Кнопки: `980px` → `8px` (88 вхождений в 18 файлах + theme.ts)
- [x] Карточки: `12-16px` (по ТЗ, `Card.borderRadiusLG: 16`)
- [x] Инпуты: `8px` (theme.ts `Input.borderRadius: 8`)
- [x] Select: `8px` (theme.ts `Select.borderRadius: 8`)
- [x] Tags/badges: `6px` (theme.ts `Tag.borderRadiusSM: 6`)

### 3.3 Проверка — ВЫПОЛНЕНО
- [x] TypeScript компиляция: 0 ошибок
- [x] Frontend тесты: 182/182 pass
- [x] Backend тесты: 108/108 pass
- [x] Зелёный акцент `#4CAF50`: ссылки, бейджи, статусы, активные элементы
- [x] CTA кнопки: `#2D2D2D` через `colorPrimary` в theme
- [x] Dev server работает (port 5173)

### 3.4 Тех.долг (выявлен code review)
- [x] Переименовать `const BLUE = '#4CAF50'` → `const ACCENT = '#4CAF50'` (17 файлов) ✅
- [x] Заменить `borderRadius: 20` → `borderRadius: 16` на карточках/контейнерах (64 вхождения, 27 файлов) ✅

---

## Фаза 4: Checkout и заказы — недостающие функции

> **Приоритет: СРЕДНИЙ** — критичные для бизнес-процесса покупки.

### 4.1 Frontend — Выбор даты/времени монтажа
- [x] Добавить `DatePicker` + `TimePicker` (Ant Design) на шаг доставки в CheckoutPage
- [x] Ограничения: только будущие даты, рабочие часы (9:00–20:00), шаг 30 мин
- [x] Валидация: дата и время обязательны, включены в fieldsToValidate шага 2

### 4.2 Frontend — Оплата через СБП
- [x] Добавить опцию «СБП» в список способов оплаты (Radio.Group)
- [x] Описание: «Система Быстрых Платежей», между картой и рассрочкой

### 4.3 Frontend — Кнопка «Примерить на фото» и «Примерить в конструкторе»
- [x] ProductPage: кнопка «Примерить в конструкторе» → `/constructor?designId={id}`
- [x] ProductPage: кнопка «Примерить на фото» → `/visualizer?designId={id}`
- [x] CatalogPage: кнопка (иконка камеры) на карточке товара → `/visualizer?designId={id}`
- [x] ConstructorPage: принимает `?designId` из URL, предвыбирает дизайн (с валидацией)
- [x] PhotoEditorPage: принимает `?designId` из URL, предвыбирает дизайн (с валидацией)

### 4.4 Backend — Дата монтажа в заказе
- [x] Поле `installation_date: datetime | None` в `Order` entity и `OrderModel`
- [x] `CreateOrderRequest` DTO обновлён
- [x] Alembic-миграция `002_add_installation_date.py`
- [x] Тесты: 6 новых (2 domain, 2 use case, 2 API) — 114 passed

### 4.5 Проверка
- [x] TypeScript: 0 ошибок
- [x] Backend тесты: 114/114 pass
- [x] 4 способа оплаты: карта, СБП, рассрочка, наличные

### 4.6 Тех.долг (выявлен code review)
- [x] CheckoutPage.tsx — `disabledMinutes` для часа 20 (запрещён 20:30) ✅
- [x] ProductPage.tsx — hover-цвет `#0077ED` → `#3d8b40` (2 места) ✅
- [x] Backend orders.py — `field_validator` для `installation_date` (будущая дата + рабочие часы 9:00-20:00) + 2 теста ✅

---

## Фаза 5: Личный кабинет и авторизация — пробелы

> **Приоритет: СРЕДНИЙ** — улучшение UX авторизованных пользователей.

### 5.1 Frontend — Header: поиск и избранное
- [x] Добавить иконку поиска (SearchOutlined) в ShopHeader → по клику разворачивает Input
- [x] Поиск в хедере → навигация на `/catalog?search={query}`
- [x] Добавить иконку избранного (HeartOutlined) в ShopHeader с badge (количество)
- [x] Клик → `/account/favorites` (если авторизован) или `/login?redirect=/account/favorites`

### 5.2 Frontend — Забытый пароль
- [x] ForgotPasswordPage: подключить к бэкенду (когда эндпоинт будет готов)

### 5.3 Backend — Забытый пароль
- [x] `POST /api/auth/forgot-password` — принимает email, генерирует reset token (6 цифр), хранит в Redis (TTL 15 мин)
- [x] `POST /api/auth/reset-password` — принимает email + token + new_password
- [x] ⚠️ Реальная отправка email — placeholder (лог в консоль), готовность к SMTP-интеграции

### 5.4 Frontend — Соцсети (placeholder)
- [x] LoginPage и RegisterPage: добавить неактивные кнопки «Войти через Google» и «Войти через VK»
- [x] Стиль: серые, disabled, tooltip «Скоро»

### 5.5 Frontend — Уведомления (настройки)
- [x] Добавить раздел «Уведомления» в AccountLayout (между Избранное и Подписка)
- [x] NotificationsSection: toggle-переключатели (email о заказах, email о подписке, промо-рассылка)
- [x] Persist в localStorage через accountStore (бэкенд — в следующих итерациях)

### 5.6 Frontend — Повтор заказа
- [x] OrdersSection: кнопка «Повторить заказ» в каждом заказе
- [x] Логика: скопировать items → cartStore.addItem() для каждого → открыть CartDrawer

### 5.7 Проверка
- [x] Поиск из хедера работает на всех страницах
- [x] Избранное доступно из хедера с badge
- [x] Восстановление пароля: email → код → новый пароль (E2E через API)
- [x] Кнопки соцсетей отображаются, при клике — «Скоро»
- [x] Повтор заказа добавляет товары в корзину
- [x] Настройки уведомлений сохраняются в localStorage

---

## Фаза 6: Контентные страницы — пробелы

> **Приоритет: СРЕДНИЙ** — контент-страницы неполные по ТЗ.

### 6.1 Frontend — Главная страница
- [x] Добавить блок **«Преимущества»** (между «Как это работает» и «Популярные»):
  - 6 карточек: «100 000+ вариантов», «Монтаж за 2 часа», «Без шума и пыли», «Гибкая подписка», «Гарантия 5 лет», «Доставка по РФ»
- [x] Добавить **промо-баннер** (между секциями): gradient CTA «Скидка 15% на первый заказ»

### 6.2 Frontend — Контакты: карта
- [x] Добавить Yandex Maps iframe в ContactsPage (координаты офиса, marker)
- [x] Fallback: статичное изображение с адресом если iframe не загрузился

### 6.3 Frontend — Портфолио: до/после
- [x] Создать `shared/ui/ImageBeforeAfter.tsx` — image-based before/after slider (pointer events)
- [x] Добавить before/after пары к 3 из 6 проектов в PortfolioPage
- [x] ProjectCard: автоматически показывает slider при наличии `beforeImage`

### 6.4 Frontend — Как это работает: видео
- [x] Добавить секцию с YouTube iframe (после 4 шагов, перед гарантиями)
- [x] Aspect ratio 16:9, lazy loading, fullscreen support

### 6.5 Frontend — Блог (минимальная версия)
- [x] Создать `content/ui/BlogPage.tsx` — список из 5 статей с карточками
- [x] Создать `content/ui/BlogPostPage.tsx` — страница статьи с markdown-like рендером
- [x] Маршруты: `/blog`, `/blog/:slug` (lazy-loading)
- [x] 5 моковых статей: тренды, кейс, 2 совета, детская
- [x] Добавить «Блог» в ShopHeader nav + ShopFooter

### 6.6 Проверка
- [x] TypeScript 0 errors
- [x] Backend 120 tests pass
- [x] Все новые маршруты с lazy-loading

---

## Фаза 7: Фото-редактор — быстрые доработки (без бэкенда)

> **Приоритет: СРЕДНИЙ** — улучшение UX визуализатора без внешних зависимостей.
> Зависимости: Фаза 4.3 (кнопки «Примерить на фото»)

### 7.1 Frontend — UI удаления панели
- [ ] WallCanvas: по клику на размещённую панель — показать кнопку удаления (крестик)
- [ ] Вызывать `removePanel(panelId)` из visualizerStore

### 7.2 Frontend — Hover-эффект
- [ ] WallCanvas: подсветка ячейки при наведении в ручном режиме (полупрозрачный прямоугольник)

### 7.3 Frontend — Сохранение проекта в localStorage
- [ ] Добавить Zustand persist в visualizerStore (ключ: `wow-wall-visualizer`)
- [ ] Persist: scene (без imageData — только URL/blob ref), layout, selections
- [ ] Кнопка «Сохранить» → message.success()

### 7.4 Frontend — Экспорт изображения
- [ ] Кнопка «Скачать» (DownloadOutlined) → canvas.toBlob('image/jpeg', 0.92) → download
- [ ] Имя файла: `wow-wall-visualizer-{timestamp}.jpg`

### 7.5 Frontend — Акцентная зона (UI)
- [ ] Режим «Зона» в PlacementControls: при активации рисование прямоугольника на Canvas
- [ ] mousedown → mousemove → mouseup = AccentZone { x, y, width, height }
- [ ] Передать зону в autoFillWall() (уже поддерживает accentZone)

### 7.6 Проверка
- [ ] Клик на панель → удаление работает
- [ ] Hover подсвечивает ячейку при наведении
- [ ] Сохранение: перезагрузка → проект восстанавливается
- [ ] Скачивание: JPEG-файл сохраняется
- [ ] Акцентная зона: рисование + авторазмещение в зоне
- [ ] Все 90 тестов визуализатора проходят

---

## Фаза 8: 152-ФЗ и юридическое соответствие

> **Приоритет: СРЕДНИЙ** — юридическое требование для работы с персональными данными.

### 8.1 Frontend — Согласие на обработку ПД
- [ ] Checkbox «Согласен с политикой обработки персональных данных» на:
  - RegisterPage
  - CheckoutPage (шаг контактов)
  - ContactsPage (форма обратной связи)
  - SubscriptionModal (шаг формы)
- [ ] Ссылка на `/privacy-policy`

### 8.2 Frontend — Страница политики конфиденциальности
- [ ] `content/ui/PrivacyPolicyPage.tsx` — текст политики (шаблон 152-ФЗ)
- [ ] Маршрут `/privacy-policy`
- [ ] Ссылка в футере

### 8.3 Проверка
- [ ] Без checkbox формы не отправляются (валидация)
- [ ] Страница политики доступна и содержит все обязательные разделы
- [ ] Ссылки работают из всех форм

---

## Фаза 9: Безопасность бэкенда

> **Приоритет: СРЕДНИЙ** — необходимо перед выходом в продакшн.
> Зависимости: Фаза 1 (PostgreSQL), Фаза 5.3 (forgot-password/Redis)

### 9.1 Backend — CSRF-защита
- [x] Для SPA с JWT: CORS настроен strict (конкретный origin, не `*`)
- [x] `allow_methods` и `allow_headers` — явные списки вместо `["*"]`
- [x] Обновить `config.py`: `CORS_ORIGINS` — конкретный origin фронтенда
- ~~CSRF-middleware~~ — не нужен для SPA с JWT Bearer token (не cookies)

### 9.2 Backend — Rate limiting
- [x] Добавить зависимость `slowapi==0.1.9` в requirements.txt
- [x] Настроить лимиты:
  - `POST /auth/login` — 5 req/min (защита от brute-force)
  - `POST /auth/register` — 3 req/min
  - `POST /auth/forgot-password` — 3 req/min
  - `POST /auth/reset-password` — 5 req/min
  - `POST /contacts` — 5 req/min
  - Глобальный `default_limits=["60/minute"]` (⚠️ применяется только к эндпоинтам с `request: Request`)
- [ ] Хранение состояния в Redis (уже в docker-compose) — TODO для production

### 9.3 Backend — Hardening
- [x] JWT_SECRET guard: `RuntimeError` при `ENV=production` + дефолтный секрет
- [x] `ENV` setting в config (development/production)
- [x] CORS: `allow_methods` и `allow_headers` — конкретные списки
- [x] Security headers middleware: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy

### 9.4 Проверка
- [x] Brute-force логина: после 5 попыток → 429 Too Many Requests (тест)
- [x] CORS: запрос с чужого origin → отклонён (тест)
- [x] Security headers присутствуют в response (тест)
- [x] Все существующие тесты проходят: 130 backend, 183 frontend

### 9.5 Тех.долг (выявлен code review)
- [ ] `config.py:1` — удалить неиспользуемый `import os`
- [ ] `middleware.py:1` — исправить docstring (убрать "rate limiting")
- [ ] Глобальный rate limit 60/min не работает на orders/subscriptions/projects/catalog (нет `request: Request`)

---

## Фаза 10: Инфраструктура и деплой

> **Приоритет: НИЗКИЙ (для MVP)** — необходимо для продакшна, но не блокирует разработку.
> Зависимости: Фаза 1 (PostgreSQL), Фаза 9 (безопасность)

### 10.1 Frontend — Dockerfile
- [ ] `frontend/Dockerfile`: multi-stage build (Node → build → Nginx → serve dist/)
- [ ] `frontend/nginx.conf`: SPA fallback (try_files), gzip, cache headers для статики

### 10.2 Docker Compose — полный стек
- [ ] Добавить frontend сервис в `docker-compose.yml`
- [ ] Nginx reverse proxy: `/ → frontend`, `/api → backend:8080`
- [ ] SSL termination: Certbot volume для Let's Encrypt (или placeholder для Cloudflare)

### 10.3 CI/CD
- [ ] `.github/workflows/ci.yml`:
  - Frontend: `npm ci → lint → tsc --noEmit → vitest run → build`
  - Backend: `pip install → pytest`
  - Docker build (multi-arch)
- [ ] `.github/workflows/deploy.yml` — CD pipeline (placeholder)

### 10.4 SEO и мета-теги
- [ ] `react-helmet-async` или Vite plugin для `<title>` и `<meta>` на каждой странице
- [ ] Open Graph теги (og:title, og:description, og:image)
- [ ] Favicon из логотипа W!

### 10.5 Проверка
- [ ] `docker compose up` → все 4 сервиса стартуют (frontend + backend + db + redis)
- [ ] Доступ через Nginx: `http://host/` → SPA, `/api/health` → backend
- [ ] CI pipeline: green на clean branch
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 90

---

## Фаза 11: Мобильная адаптация

> **Приоритет: НИЗКИЙ** — улучшение опыта на мобильных устройствах.
> Зависимости: Фаза 3 (дизайн), Фаза 7 (визуализатор)

### 11.1 Frontend — Адаптивные breakpoints
- [ ] Пройти по всем страницам и проверить на 375px, 768px, 1024px:
  - [ ] HomePage (hero, секции)
  - [ ] CatalogPage (фильтры → Drawer на мобиле)
  - [ ] ProductPage (галерея → swipe)
  - [ ] ConstructorPage (упрощённый UI)
  - [ ] CheckoutPage (шаги)
  - [ ] AccountLayout (sidebar → tab bar)

### 11.2 Frontend — Визуализатор: touch
- [ ] Pinch-to-zoom на WallCanvas (gesture events)
- [ ] Touch-события для маски (кисть/ластик)
- [ ] Responsive: sidebar → bottom sheet при ≤768px

### 11.3 Frontend — Общий чат-placeholder
- [ ] Floating Action Button в правом нижнем углу (все страницы)
- [ ] По клику → Drawer «Поддержка» с текстом «Напишите нам на support@wonderwowwall.ru»
- [ ] Ссылки: email, телефон, Telegram

### 11.4 Проверка
- [ ] Chrome DevTools → эмуляция iPhone SE, iPad
- [ ] Все страницы корректно отображаются без горизонтальной прокрутки
- [ ] Touch-жесты в визуализаторе работают

---

## Фаза 12: Подписочная модель — согласование

> **Приоритет: БЛОКЕР для согласования** — тарифы в коде не совпадают с ТЗ.
> ⚠️ Эта фаза требует решения заказчика перед выполнением.

### Текущее расхождение

| | ТЗ (REQUIREMENTS.md) | Реализация |
|---|----------------------|-----------|
| Единица | Площадь (м²/мес) | Количество накладок/мес |
| План 1 | 15 м² — 7 000 ₽ | Стартовый: 10 накладок — 4 900 ₽ |
| План 2 | 30 м² — 12 000 ₽ | Популярный: 25 накладок — 9 900 ₽ |
| План 3 | 50 м² — 18 000 ₽ | Бизнес: безлимит — 19 900 ₽ |

### Варианты решения

**Вариант A: Привести к ТЗ (по площади)**
- [ ] Изменить модель подписки: лимит по площади (м²), а не по количеству накладок
- [ ] Пересчитать: сколько накладок в 15/30/50 м² при разных размерах
- [ ] Обновить: frontend (PricingPage, subscriptionStore, CostSummary), backend (entities, plans)

**Вариант B: Утвердить текущую модель (по накладкам)**
- [ ] Обновить REQUIREMENTS.md — зафиксировать модель по количеству накладок
- [ ] Никаких изменений в коде

**Вариант C: Гибридная модель**
- [ ] Лимит по площади, но отображать как «~N накладок/мес»
- [ ] Цены пересогласовать

> **Действие:** Согласовать с заказчиком и выполнить выбранный вариант.

---

## Сводная таблица

| Фаза | Описание | Задач | Backend | Frontend | Зависит от | Приоритет |
|:----:|---------|:-----:|:-------:|:--------:|:----------:|:---------:|
| 1 | PostgreSQL и миграции | 14 | 14 | 0 | — | Критический |
| 2 | Отзывы + фильтры каталога | 12 | 3 | 9 | Фаза 1 (для persist) | Высокий |
| 3 | Дизайн по ТЗ (цвета, радиусы) | 8 | 0 | 8 | — | Высокий |
| 4 | Checkout + «Примерить» кнопки | 13 | 3 | 10 | — | Средний |
| 5 | ЛК + авторизация пробелы | 14 | 3 | 11 | Фаза 1 (Redis) | Средний |
| 6 | Контентные страницы | 12 | 0 | 12 | — | Средний |
| 7 | Визуализатор: быстрые доработки | 11 | 0 | 11 | Фаза 4.3 | Средний |
| 8 | 152-ФЗ (ПД, политика) | 5 | 0 | 5 | — | Средний |
| 9 | Безопасность бэкенда | 10 | 10 | 0 | Фаза 1 | Средний |
| 10 | Инфраструктура и деплой | 10 | 4 | 6 | Фазы 1, 9 | Низкий |
| 11 | Мобильная адаптация | 10 | 0 | 10 | Фазы 3, 7 | Низкий |
| 12 | Подписка: согласование | 1–6 | 0–3 | 0–3 | Решение заказчика | Блокер |
| **ИТОГО** | | **~120** | **~37** | **~82** | | |

### Граф зависимостей

```
Фаза 1 (PostgreSQL) ──┬──→ Фаза 2 (Отзывы/Фильтры)
                       ├──→ Фаза 5 (ЛК/Auth, Redis)
                       ├──→ Фаза 9 (Безопасность)
                       └──→ Фаза 10 (Деплой)

Фаза 3 (Дизайн) ─────────→ Фаза 11 (Мобильная)

Фаза 4 (Checkout/Примерить) → Фаза 7 (Визуализатор)

Фаза 12 (Подписка) ────────→ Блокирует: ничего (изолирована)

Параллельно (без зависимостей): Фаза 3, Фаза 4, Фаза 6, Фаза 8
```

### Рекомендуемый порядок выполнения

```
Спринт 1:  Фаза 1 (PostgreSQL)  +  Фаза 3 (Дизайн)      — параллельно
Спринт 2:  Фаза 2 (Отзывы)     +  Фаза 4 (Checkout)     — параллельно
Спринт 3:  Фаза 5 (ЛК/Auth)    +  Фаза 6 (Контент)      — параллельно
Спринт 4:  Фаза 7 (Визуализатор)+  Фаза 8 (152-ФЗ)      — параллельно
Спринт 5:  Фаза 9 (Безопасность)+  Фаза 10 (Деплой)     — последовательно
Спринт 6:  Фаза 11 (Мобильная)  +  Фаза 12 (Подписка*)  — параллельно

* Фаза 12 начинается когда заказчик примет решение по модели тарифов
```
