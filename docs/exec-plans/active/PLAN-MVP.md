# Plan: Wonder Wow Wall MVP — B2C Web-App

> Полный план реализации веб-приложения для физических лиц.
> Стек: React 19 + Vite 8 + Ant Design 6 + Zustand 5 + FastAPI + PostgreSQL.

---

## Фаза 0: Фундамент ✅ ЗАВЕРШЕНА

### 0.1 Инициализация проекта
- [x] React + Vite + TypeScript проект
- [x] ESLint настроен
- [x] DDD-структура: app/, domains/ (catalog, order, subscription, constructor, content), shared/
- [x] Подключены: Ant Design 6, Framer Motion 12, Zustand 5, React Router 7, TanStack Query 5

### 0.2 Дизайн-система и тема
- [x] Ant Design тема: белый/чёрный/серый + зелёный (#4CAF50) акцент
- [x] Шрифт Inter (400-800)
- [x] Логотип Wonder Wow Wall (PNG, прозрачный фон)
- [x] Глобальные стили (index.css)

### 0.3 Данные и типы
- [x] TypeScript интерфейсы: PanelProduct, CartItem, Category, Review, ConstructorPanel
- [x] 12 дизайнов накладок, 7 категорий
- [x] 3 фиксированных размера панелей: 30×30, 30×60, 60×60 см
- [x] Единая цена дизайна: 1 200 ₽

---

## Фаза 1: Лейаут и навигация ✅ ЗАВЕРШЕНА

- [x] ShopLayout: Header + Outlet + Footer + CartDrawer + SubscriptionModal
- [x] Header: логотип, навигация, корзина (badge), подписка-бейдж, мобильное меню
- [x] Header: прозрачный → белый при скролле (scroll effect)
- [x] Footer: 4 колонки, соцсети, подписка на рассылку
- [x] 11 маршрутов с lazy-loading + Suspense
- [x] CartDrawer: список товаров, количество, итого

---

## Фаза 2: Главная страница ✅ ЗАВЕРШЕНА

- [x] Hero-секция: заголовок, подзаголовок, 2 CTA-кнопки, фото-коллаж
- [x] «Как это работает» — 4 шага с иконками
- [x] Популярные дизайны — карточки с ценой, рейтингом, палитрой
- [x] Категории — сетка с фото
- [x] Калькулятор CTA
- [x] Отзывы клиентов

---

## Фаза 3: Каталог и страница товара ✅ ЗАВЕРШЕНА

- [x] Каталог: grid/list переключение, фильтры (категория, цена, поиск), сортировка
- [x] Карточки товаров с фото, ценой, рейтингом, цветами
- [x] Страница товара: галерея, характеристики, выбор цвета/размера
- [x] Калькулятор площади и стоимости
- [x] Похожие дизайны
- [x] Добавление в корзину

---

## Фаза 4: Конструктор стен ✅ ЗАВЕРШЕНА

- [x] Настройки стены: размеры (ячейки × 30 см), цвет
- [x] Выбор дизайна накладки + оттенок + размер
- [x] Snap-to-grid размещение (клик на ячейку)
- [x] Drag & drop перемещение
- [x] «Заполнить» — автозаполнение стены
- [x] Удаление панелей (крестик)
- [x] Расчёт в реальном времени: базовые панели + накладки = итого
- [x] Добавление проекта в корзину
- [x] Призрак-превью при наведении
- [x] Интеграция с подпиской (накладки бесплатно для подписчиков)

---

## Фаза 5: Корзина и Checkout ✅ ЗАВЕРШЕНА

- [x] Корзина (Drawer): товары, количество, удаление, итого
- [x] Checkout: 3 шага (контакты, доставка, оплата)
- [x] Sidebar со сводкой заказа

---

## Фаза 6: Подписка ✅ ЗАВЕРШЕНА

- [x] 3 плана: Стартовый (4 900 ₽), Популярный (9 900 ₽), Бизнес (19 900 ₽)
- [x] Модальное окно оформления (3 шага: выбор → форма → подтверждение)
- [x] Zustand store с persist (localStorage)
- [x] Бейдж подписки в хедере
- [x] Скидка в конструкторе (накладки = 0 ₽)
- [x] Отображение на странице тарифов (активный план, отмена)
- [x] Баннер в конструкторе с информацией о подписке

---

## Фаза 7: Информационные страницы ✅ ЗАВЕРШЕНА

- [x] О компании (история, технология, статистика)
- [x] Как это работает (4 шага, гарантии, FAQ)
- [x] Портфолио (сетка проектов, фильтры)
- [x] Тарифы (покупка vs подписка, прозрачное ценообразование)
- [x] FAQ (Collapse-секции, 4 категории)
- [x] Контакты (форма, карта, информация)

---

## Фаза 8: Авторизация и личный кабинет ✅ ЗАВЕРШЕНА

### 8.1 Авторизация
- [x] Страницы: Вход (email + пароль), Регистрация, Восстановление пароля
- [x] Zustand auth store с persist (token, user, isAuth, login, register, logout)
- [x] Protected routes — RequireAuth обёртка (редирект на /login)

### 8.2 Личный кабинет (AccountLayout + sidebar)
- [x] Sidebar-навигация: Профиль, Заказы, Мои проекты, Конструктор, Избранное, Подписка
- [x] Профиль: просмотр/редактирование данных (имя, email, телефон, адреса)
- [x] История заказов: список, статусы (оформлен → в работе → доставлен → установлен)
- [x] Сохранённые проекты конструктора (список с превью, загрузка в конструктор)
- [x] Конструктор в ЛК: полноценный конструктор стен внутри аккаунта (авто-сохранение проектов)
- [x] Избранные дизайны (сердечко на карточках каталога)
- [x] Управление подпиской (текущий план, смена, отмена, история платежей)

### 8.3 Стор данных аккаунта
- [x] accountStore.ts — Zustand + persist (orders, projects, favorites)
- [x] Моковые данные для заказов и проектов
- [x] Интеграция избранного в каталог (карточки товаров)

---

## Фаза 8.5: Фото-редактор стен (Visualizer) ✅ ЗАВЕРШЕНА (Frontend MVP)

> Полная спецификация: [`docs/product-specs/PHOTO-WALL-EDITOR.md`](../../product-specs/PHOTO-WALL-EDITOR.md)
> Архитектура: [`docs/design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md`](../../design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md)

### 8.5.1 MVP фото-редактора — Frontend ✅
- [x] Bounded Context `visualizer`: model/ (types, store, adapters) + ui/ (8 компонентов) + lib/ (4 утилиты)
- [x] Загрузка фото стены (drag & drop, файл, камера) — PhotoUploader
- [x] Отображение WallMask и ObjectMask поверх фото — WallCanvas (Canvas 2D)
- [x] Ручная коррекция маски (кисть, ластик, undo/redo) — MaskToolbar + maskUtils
- [x] Авторазмещение панелей на WallMask (Layout Engine) — layoutEngine.ts
- [x] Панели не перекрывают объекты (ObjectMask) — wallCoverageInRect ≥70%
- [x] Выбор дизайна, размера, цвета из каталога — PanelPicker
- [x] Canvas-визуализация панелей на фото — WallCanvas (прямоугольники с лейблами)
- [x] Расчёт стоимости (с учётом подписки) — costCalculator + CostSummary
- [x] Добавление проекта в корзину — adapters.ts → cartStore
- [x] Маршрут `/visualizer` — lazy-loaded
- [x] Сравнение до/после (slider) — BeforeAfterSlider
- [x] Zoom/Pan (колесо мыши + alt-click)
- [x] 3 режима размещения: ручной, авто, акцент — PlacementControls
- [x] Тесты: 90 тестов (maskUtils, layoutEngine, costCalculator, adapters, store, UI)

### 8.5.1b MVP — Ожидает Backend
- [ ] Интеграция с серверной ML-сегментацией (SAM 2) — `POST /api/visualizer/upload`
- [ ] Автоматическое определение стен и объектов (пока — мок-маска)

### 8.5.2 Реалистичность (Phase 2) — Планируется
- [ ] Определение перспективы стены
- [ ] Перспективная трансформация панелей (WebGL)
- [ ] Учёт освещения на фото
- [ ] Тени швов между панелями

### 8.5.3 Продвинутые функции (Phase 3) — Планируется
- [ ] Калибровка масштаба (2 точки → реальное расстояние)
- [ ] Режим «Акцентная зона»
- [ ] Комбинирование нескольких дизайнов
- [ ] Экспорт визуализации в JPEG/PNG
- [ ] Сохранение проектов в ЛК
- [ ] Мобильная версия (touch, pinch-to-zoom)

---

## Фаза 9: Backend API (FastAPI + DDD) ✅ ЗАВЕРШЕНА

Архитектура: **Domain-Driven Design** — Domain / Application / Infrastructure layers.

### 9.1 Инфраструктура и DDD-каркас
- [x] FastAPI + SQLAlchemy (async) + PostgreSQL (ORM модели готовы, in-memory для dev)
- [x] DDD-структура: `domain/` → `application/` → `infrastructure/`
- [x] Docker + docker-compose (backend + PostgreSQL + Redis)
- [x] Pydantic v2 для валидации (DTO в infrastructure/api/)

### 9.2 Domain Layer — Bounded Contexts
- [x] **Catalog**: entities (Design — AR, Category, DesignReview), value objects (PanelSize, Color, Price), ABC репозитории
- [x] **Order**: entities (Order — AR, OrderItem), value objects (Address, OrderStatus, Money), PricingService
- [x] **Subscription**: entities (Subscription — AR, SubscriptionPlan), value objects (SubscriptionTier, SubscriptionStatus)
- [x] **User**: entities (User — AR, UserAddress), value objects (Email), ABC репозитории

### 9.3 Application Layer — Use Cases
- [x] Catalog: ListDesigns, GetDesignDetails, ListCategories, AddReview, ListReviews
- [x] Order: CreateOrder, GetOrderHistory, GetOrderDetails, CalculateWallCost
- [x] Subscription: GetPlans, Subscribe, GetSubscriptionStatus, CancelSubscription
- [x] User: Register, Login, GetProfile, UpdateProfile

### 9.4 Infrastructure Layer — Persistence
- [x] SQLAlchemy ORM-модели (UserModel, DesignModel, OrderModel, SubscriptionModel, ProjectModel)
- [x] In-memory репозитории с seed-данными (12 дизайнов, 6 категорий)
- [x] Async сессии, database.py

### 9.5 Infrastructure Layer — API (FastAPI роутеры, 29 маршрутов)
- [x] Auth: POST `/api/auth/register`, `/api/auth/login`, GET/PATCH `/api/auth/me`
- [x] Catalog: GET `/api/designs`, `/api/designs/:id`, `/api/categories`, GET/POST `/api/designs/:id/reviews`
- [x] Orders: POST `/api/orders`, GET `/api/orders`, `/api/orders/:id`, POST `/api/orders/calculate`
- [x] Subscriptions: GET `/api/subscriptions/plans`, POST/DELETE `/api/subscriptions`, GET `/api/subscriptions/status`
- [x] Projects: CRUD `/api/projects`
- [x] Other: POST `/api/calculator`, POST `/api/contacts`, GET `/api/health`

### 9.6 Infrastructure Layer — Security
- [x] JWT tokens (python-jose)
- [x] Password hashing (bcrypt)
- [x] FastAPI dependencies (get_current_user_id, get_optional_user_id)

### 9.7 Тесты по DDD-слоям — 97 тестов, 100% pass
- [x] `tests/domain/` — unit-тесты: catalog (18), order (13), subscription (12), user (10) = 53
- [x] `tests/application/` — тесты use cases: catalog (10), order (7) = 17
- [x] `tests/api/` — интеграционные тесты API: 18 endpoints, auth flow, CRUD = 27

---

## Фаза 10: Интеграция Frontend ↔ Backend ✅ ЗАВЕРШЕНА

### 10.1 API Client
- [x] Fetch wrapper с base URL, JWT auto-attach, error handling (`shared/api/client.ts`)
- [x] Типы API-ответов, совпадающие с Pydantic-схемами бэкенда (`shared/api/types.ts`)
- [x] ApiError класс с status + detail
- [x] Автоочистка auth state и redirect на /login при 401

### 10.2 TanStack Query Hooks (5 доменов)
- [x] **Catalog**: useDesigns, useDesign, useCategories, useDesignReviews, useAddReview
- [x] **Auth**: useProfile, useLoginMutation, useRegisterMutation, useUpdateProfileMutation
- [x] **Orders**: useOrders, useOrder, useCreateOrder, useCalculateWallCost
- [x] **Subscriptions**: usePlans, useSubscriptionStatus, useSubscribe, useCancelSubscription
- [x] **Projects**: useProjects, useProject, useCreateProject, useUpdateProject, useDeleteProject
- [x] **Contacts**: useSubmitContact, useCalculator

### 10.3 Интеграция в страницы
- [x] CatalogPage → API дизайнов + категорий с fallback на моки
- [x] ProductPage → API дизайна + related designs с fallback
- [x] LoginPage → useLoginMutation (API, с ApiError обработкой)
- [x] RegisterPage → useRegisterMutation (API, с ApiError обработкой)
- [x] ProfileSection → useUpdateProfileMutation (API + локальный fallback)
- [x] OrdersSection → useOrders (API с fallback на accountStore)
- [x] ContactsPage → useSubmitContact (API с graceful fallback)
- [x] authStore.setAuth() — маппинг API user → frontend User

### 10.4 Error Handling & Loading States
- [x] ApiError с message.error() toast-уведомлениями (Login, Register)
- [x] Skeleton loading: каталог (6 карточек), товар (2 колонки), заказы
- [x] QueryClient defaults: retry=1, staleTime=30s, refetchOnWindowFocus=false

### 10.5 Инфраструктура
- [x] Vite proxy: /api → http://localhost:8080
- [x] Адаптеры: apiDesignToProduct, apiCategoryToCategory, apiReviewToReview

### 10.6 Тесты — 26 новых, всего 182
- [x] `shared/api/__tests__/client.test.ts` — 9 тестов (GET/POST/PATCH/PUT/DELETE, JWT, 401, errors)
- [x] `shared/api/__tests__/types.test.ts` — 8 тестов (все API типы)
- [x] `domains/catalog/api/__tests__/adapters.test.ts` — 9 тестов (маппинг Design→Product, Category, Review)

---

## Фаза 11: Полировка и деплой

### 11.1 UX/UI
- [ ] Анимации переходов между страницами
- [ ] Skeleton loading для карточек
- [ ] Lazy loading изображений
- [ ] 404 страница
- [ ] Empty states (пустая корзина, нет заказов)

### 11.2 SEO и производительность
- [ ] Meta-теги, title для каждой страницы
- [ ] Open Graph теги
- [ ] Favicon из лого W!
- [ ] Оптимизация бандла (code splitting)
- [ ] Lighthouse: 90+ score

### 11.3 Адаптивность
- [ ] 375px, 768px, 1024px, 1920px
- [ ] Мобильный конструктор (упрощённый)
- [ ] Touch-события для drag & drop

### 11.4 Деплой
- [ ] Dockerfile (frontend: Vite build + Nginx)
- [ ] Docker Compose (frontend + backend + PostgreSQL + Redis)
- [ ] CI/CD (GitHub Actions)
- [ ] HTTPS (Certbot / Cloudflare)

---

## Прогресс

| Фаза | Описание | Статус | Приоритет |
|------|---------|--------|-----------|
| 0 | Фундамент | ✅ Завершена | — |
| 1 | Лейаут и навигация | ✅ Завершена | — |
| 2 | Главная страница | ✅ Завершена | — |
| 3 | Каталог и товар | ✅ Завершена | — |
| 4 | Конструктор стен | ✅ Завершена | — |
| 5 | Корзина и Checkout | ✅ Завершена | — |
| 6 | Подписка | ✅ Завершена | — |
| 7 | Информационные страницы | ✅ Завершена | — |
| 8 | Авторизация и ЛК | ✅ Завершена | — |
| 8.5 | Фото-редактор стен (Visualizer) | ✅ Frontend MVP | — |
| 9 | Backend API | ✅ Завершена | — |
| 10 | Интеграция | ✅ Завершена | — |
| 11 | Полировка и деплой | ⬜ Планируется | Средний |

**Завершено: 12 из 13 фаз (92%)**
