# Wonder Wow Wall — Frontend

React SPA для B2C интернет-магазина модульных стеновых панелей.
Архитектура: **Domain-Driven Design (DDD)** с Bounded Contexts.

## Запуск

```bash
npm install
npm run dev -- --host 0.0.0.0    # Dev-сервер на http://localhost:3000
npm run build                     # Продакшн-сборка в dist/
npm run preview                   # Превью сборки
npm run test                      # Запуск тестов (vitest)
npm run test:watch                # Тесты в watch-режиме
npm run lint                      # ESLint проверка
npx tsc --noEmit                  # Проверка типов
```

## Стек

| Библиотека | Версия | Назначение |
|-----------|--------|-----------|
| React | 19.2 | UI-фреймворк |
| TypeScript | 5.9 | Типизация (strict mode) |
| Vite | 8.0 | Сборка и dev-сервер |
| Ant Design | 6.3 | UI-компоненты (Button, Card, Select, Modal, Drawer...) |
| Framer Motion | 12.38 | Анимации (fade-in, scale, staggered) |
| Zustand | 5.0 | Стейт-менеджмент (корзина, подписка, авторизация, аккаунт) |
| React Router | 7.13 | Клиентская маршрутизация (21 маршрут, lazy-loading) |
| TanStack Query | 5.91 | Data fetching + кеширование (интегрировано с Backend API) |
| Vitest | 4.1 | Unit/интеграционное тестирование |
| React Testing Library | 16.3 | Тестирование компонентов |

## Архитектура (DDD)

Код организован по бизнес-доменам (Bounded Contexts), а не по техническим слоям.

```
src/
├── app/                          # Application layer (точка входа, провайдеры)
│   ├── App.tsx                   # Рендер AppRouter
│   └── main.tsx                  # BrowserRouter + AntD ConfigProvider + QueryClient
│
├── domains/                      # Bounded Contexts (бизнес-домены)
│   ├── catalog/                  # Домен: Каталог дизайнов
│   │   ├── model/
│   │   │   ├── types.ts          # PanelProduct, Category, Review
│   │   │   └── data.ts           # Моковые данные: 12 дизайнов, категории, отзывы
│   │   ├── api/
│   │   │   ├── catalogApi.ts     # TanStack Query хуки: useDesigns, useDesign, useCategories...
│   │   │   └── adapters.ts       # Преобразование API → доменные типы
│   │   └── ui/
│   │       ├── CatalogPage.tsx   # Каталог: фильтры, поиск, grid/list, сортировка
│   │       └── ProductPage.tsx   # Товар: галерея, характеристики, похожие
│   │
│   ├── order/                    # Домен: Заказы
│   │   ├── model/
│   │   │   ├── types.ts          # CartItem
│   │   │   ├── cartStore.ts      # Zustand: items, addItem, removeItem, total
│   │   │   └── orderApi.ts       # useCreateOrder
│   │   └── ui/
│   │       └── CheckoutPage.tsx  # Оформление: 3 шага (контакты, доставка, оплата)
│   │
│   ├── subscription/             # Домен: Подписка
│   │   ├── model/
│   │   │   ├── types.ts          # SubscriptionPlan
│   │   │   ├── subscriptionStore.ts # Zustand с persist (localStorage)
│   │   │   └── subscriptionApi.ts   # useSubscribe, useCancelSubscription
│   │   └── ui/
│   │       └── PricingPage.tsx   # Тарифы: покупка vs подписка, 3 плана
│   │
│   ├── constructor/              # Домен: Конструктор стен
│   │   ├── model/
│   │   │   └── types.ts          # ConstructorPanel
│   │   └── ui/
│   │       └── ConstructorPage.tsx # Snap-to-grid, drag&drop, расчёт стоимости
│   │
│   ├── auth/                     # Домен: Авторизация
│   │   ├── model/
│   │   │   ├── types.ts          # User, Address, LoginPayload, RegisterPayload
│   │   │   ├── authStore.ts      # Zustand с persist: user, token, isAuth, login/logout
│   │   │   └── authApi.ts        # useLogin, useRegister
│   │   └── ui/
│   │       ├── LoginPage.tsx     # Вход в аккаунт
│   │       ├── RegisterPage.tsx  # Регистрация
│   │       ├── ForgotPasswordPage.tsx # Восстановление пароля
│   │       └── RequireAuth.tsx   # HOC защиты маршрутов (редирект → /login)
│   │
│   ├── account/                  # Домен: Личный кабинет
│   │   ├── model/
│   │   │   ├── types.ts          # Order, SavedProject, SavedProjectPanel
│   │   │   ├── accountStore.ts   # Zustand с persist: orders, projects, favorites
│   │   │   └── accountApi.ts     # useOrders, useSaveProject, useUpdateProject...
│   │   └── ui/
│   │       ├── AccountLayout.tsx # Навигация ЛК (sidebar + Outlet)
│   │       ├── ProfileSection.tsx
│   │       ├── OrdersSection.tsx
│   │       ├── ProjectsSection.tsx
│   │       ├── FavoritesSection.tsx
│   │       ├── AccountConstructorSection.tsx
│   │       └── AccountSubscriptionSection.tsx
│   │
│   ├── visualizer/               # Домен: Фото-редактор стен
│   │   ├── model/
│   │   │   ├── types.ts          # Scene, WallMask, PlacedPanel, VisualizationProject
│   │   │   ├── visualizerStore.ts # Zustand: scene, layout, маски, undo-стек (20 шагов)
│   │   │   └── adapters.ts       # placedPanelsToCartItems → cartStore
│   │   ├── lib/
│   │   │   ├── costCalculator.ts # Расчёт стоимости с учётом подписки
│   │   │   ├── imageProcessing.ts # Обработка загруженных изображений
│   │   │   ├── layoutEngine.ts   # Алгоритмы авто-размещения панелей
│   │   │   └── maskUtils.ts      # Редактирование масок (brush, eraser)
│   │   └── ui/
│   │       ├── PhotoEditorPage.tsx # Основная страница редактора
│   │       ├── PhotoUploader.tsx   # Загрузка фото стены
│   │       ├── WallCanvas.tsx      # Канвас с маской и панелями
│   │       ├── MaskToolbar.tsx     # Инструменты маски (brush/eraser)
│   │       ├── PanelPicker.tsx     # Выбор дизайна/размера/цвета
│   │       ├── PlacementControls.tsx # Авто/ручное размещение
│   │       ├── CostSummary.tsx     # Итог стоимости
│   │       └── BeforeAfterSlider.tsx # До/после сравнение
│   │
│   └── content/                  # Домен: Контент (информационные страницы)
│       └── ui/
│           ├── HomePage.tsx      # Главная: Hero, категории, популярные, отзывы
│           ├── AboutPage.tsx     # О компании
│           ├── ContactsPage.tsx  # Контакты + форма
│           ├── HowItWorksPage.tsx # Как это работает (4 шага)
│           ├── PortfolioPage.tsx # Портфолио проектов
│           └── FaqPage.tsx       # FAQ (Collapse-секции)
│
├── shared/                       # Cross-cutting concerns (кросс-доменные модули)
│   ├── ui/                       # Общие UI-компоненты
│   │   ├── ShopLayout.tsx        # Обёртка: Header + Outlet + Footer + CartDrawer + SubModal
│   │   ├── ShopHeader.tsx        # Фиксированный хедер, scroll-эффект, подписка-бейдж
│   │   ├── ShopFooter.tsx        # 4-колоночный футер
│   │   ├── CartDrawer.tsx        # Корзина (кросс-доменный: order + catalog)
│   │   └── SubscriptionModal.tsx # 3-шаговая модалка подписки (кросс-доменный)
│   │
│   ├── api/
│   │   ├── client.ts             # Fetch-обёртка: JWT авто-подстановка, 401 → logout
│   │   └── types.ts              # API-типы (DTO): ApiDesign, ApiOrder, ApiPlan...
│   │
│   ├── config/
│   │   └── constants.ts          # PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE
│   │
│   ├── router.tsx                # Все маршруты + lazy-loading + Suspense
│   └── theme.ts                  # Ant Design тема (цвета, шрифты, border-radius)
│
└── index.css                     # Глобальные стили (Inter, scrollbar, hover-эффекты)
```

### Bounded Contexts (домены)

| Домен | Ответственность | Model | UI |
|-------|----------------|-------|-----|
| **catalog** | Дизайны, категории, отзывы | types.ts, data.ts, catalogApi.ts, adapters.ts | CatalogPage, ProductPage |
| **order** | Корзина, оформление заказа | types.ts, cartStore.ts, orderApi.ts | CheckoutPage |
| **subscription** | Планы, управление подпиской | types.ts, subscriptionStore.ts, subscriptionApi.ts | PricingPage |
| **constructor** | Визуальный редактор стены | types.ts | ConstructorPage |
| **auth** | Авторизация, JWT, защита маршрутов | types.ts, authStore.ts, authApi.ts | LoginPage, RegisterPage, ForgotPasswordPage, RequireAuth |
| **account** | Личный кабинет пользователя | types.ts, accountStore.ts, accountApi.ts | AccountLayout, ProfileSection, OrdersSection, ProjectsSection, FavoritesSection, AccountConstructorSection, AccountSubscriptionSection |
| **visualizer** | Фото-редактор стен (загрузка фото, маски, панели) | types.ts, visualizerStore.ts, adapters.ts + lib/ (4 файла) | PhotoEditorPage, PhotoUploader, WallCanvas, MaskToolbar, PanelPicker, PlacementControls, CostSummary, BeforeAfterSlider |
| **content** | Информационные страницы | — | Home, About, FAQ... |

### Кросс-доменные компоненты (shared)

Компоненты, которые работают с данными нескольких доменов, размещаются в `shared/ui/`:
- **CartDrawer** — использует `order.cartStore` + данные из `catalog`
- **SubscriptionModal** — использует `subscription.subscriptionStore`
- **ShopHeader** — показывает badge корзины (order) и статус подписки (subscription)

### Правило зависимостей

```
domains/catalog  ──→  shared/config
domains/order    ──→  shared/config, domains/catalog (типы)
domains/subscription ──→ shared/config
domains/constructor  ──→ domains/catalog, domains/order, domains/subscription
domains/auth     ──→  shared/api
domains/account  ──→  shared/api, domains/catalog (типы)
domains/visualizer ──→ shared/config, domains/catalog, domains/order, domains/subscription
domains/content  ──→  domains/catalog (данные для главной)
shared/ui        ──→  domains/* (кросс-доменная интеграция)
```

- Домены **не** импортируют друг друга напрямую (кроме зависимостей через типы)
- `shared/` содержит кросс-доменную логику и общую инфраструктуру
- Каждый домен инкапсулирует свои model (типы, сторы, данные) и ui (страницы)

## Маршруты

Все страницы загружаются лениво (`React.lazy`) с `<Suspense>` fallback.
Защищённые маршруты обёрнуты в `<RequireAuth>` — при отсутствии авторизации редирект на `/login`.

| Путь | Домен | Страница | Описание |
|------|-------|---------|---------|
| `/` | content | HomePage | Главная с Hero, категориями, отзывами |
| `/catalog` | catalog | CatalogPage | Каталог дизайнов с фильтрами |
| `/product/:id` | catalog | ProductPage | Детальная страница дизайна |
| `/constructor` | constructor | ConstructorPage | Визуальный конструктор стен |
| `/visualizer` | visualizer | PhotoEditorPage | Фото-редактор стен |
| `/checkout` | order | CheckoutPage | Оформление заказа (3 шага) |
| `/pricing` | subscription | PricingPage | Тарифы: покупка и подписка |
| `/about` | content | AboutPage | О компании |
| `/contacts` | content | ContactsPage | Контакты и форма |
| `/how-it-works` | content | HowItWorksPage | Как это работает |
| `/portfolio` | content | PortfolioPage | Портфолио проектов |
| `/faq` | content | FaqPage | Часто задаваемые вопросы |
| `/login` | auth | LoginPage | Вход в аккаунт |
| `/register` | auth | RegisterPage | Регистрация |
| `/forgot-password` | auth | ForgotPasswordPage | Восстановление пароля |
| `/account` | account | ProfileSection | Профиль (protected) |
| `/account/orders` | account | OrdersSection | История заказов (protected) |
| `/account/projects` | account | ProjectsSection | Сохранённые проекты (protected) |
| `/account/constructor` | account | AccountConstructorSection | Конструктор в ЛК (protected) |
| `/account/favorites` | account | FavoritesSection | Избранные дизайны (protected) |
| `/account/subscription` | account | AccountSubscriptionSection | Управление подпиской (protected) |

`*` (wildcard) → HomePage (fallback для 404).

## Состояние (State)

5 Zustand-сторов. Persist-сторы сохраняются в localStorage.

### CartStore (`domains/order/model/cartStore.ts`)
- `items: CartItem[]` — товары в корзине (эфемерный, без persist)
- `addItem()` — добавить (объединяет дубли)
- `removeItem()` / `updateQuantity()` / `clearCart()`
- `total()` / `totalItems()` — вычисляемые значения

### SubscriptionStore (`domains/subscription/model/subscriptionStore.ts`)
- `activePlanId` — текущий план (null / starter / popular / business)
- `subscribe(planId)` / `cancelSubscription()` / `hasSubscription()` / `getActivePlan()`
- `useOverlay()` / `getOverlayDiscount()` — учёт использованных накладок
- Modal: `openModal()` / `closeModal()` / `setModalStep()`
- Persist → localStorage (ключ: `wow-wall-subscription`)

### AuthStore (`domains/auth/model/authStore.ts`)
- `user: User | null`, `token: string | null`, `isAuth: boolean`
- `login(email, password)` / `register(name, email, phone, password)`
- `logout()` — сброс состояния
- `updateProfile(data)` / `addAddress()` / `removeAddress()` / `setDefaultAddress()`
- Persist → localStorage (ключ: `wow-wall-auth`)

### AccountStore (`domains/account/model/accountStore.ts`)
- `orders: Order[]` — история заказов
- `projects: SavedProject[]` — сохранённые проекты конструктора
- `favoriteIds: string[]` — ID избранных дизайнов
- `saveProject()` / `updateProject()` / `deleteProject()` — CRUD проектов
- `toggleFavorite()` / `isFavorite()` — управление избранным
- Persist → localStorage (ключ: `wow-wall-account`)

### VisualizerStore (`domains/visualizer/model/visualizerStore.ts`)
- `scene: Scene | null` — фото стены, маски, статус сегментации
- `layout: PanelLayout` — размещённые панели, стоимость
- `selectedDesignId / selectedSizeKey / selectedColor` — текущий выбор
- `maskTool / brushSize / maskOpacity / maskVisible` — инструменты маски
- `addPanel() / removePanel() / clearPanels() / autoFill()` — управление панелями
- `updateWallMask() / undoMaskEdit()` — редактирование маски (стек 20 шагов)
- Библиотеки: imageProcessing, maskUtils, layoutEngine, costCalculator
- Адаптеры: `placedPanelsToCartItems()` → cartStore

## API-интеграция

### API-клиент (`shared/api/client.ts`)
- Обёртка над Fetch API (не Axios)
- Base URL: `import.meta.env.VITE_API_URL || '/api'`
- JWT-токен автоматически подставляется из localStorage (`wow-wall-auth`)
- 401 → очистка auth-состояния, редирект на `/login`
- Методы: `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.patch<T>()`, `api.delete<T>()`

### TanStack Query хуки (по доменам)
- **Catalog**: `useDesigns()`, `useDesign()`, `useCategories()`, `useDesignReviews()`, `useAddReview()`
- **Auth**: `useLogin()`, `useRegister()`
- **Order**: `useCreateOrder()`
- **Account**: `useOrders()`, `useSaveProject()`, `useUpdateProject()`, `useDeleteProject()`
- **Subscription**: `useSubscribe()`, `useCancelSubscription()`
- **Contacts**: `useSubmitContact()`

QueryClient настройки: retry: 1, staleTime: 30s, refetchOnWindowFocus: false.

## Бизнес-логика

### Ценообразование (shared/config/constants.ts)
- **Базовая панель** (разовая покупка):
  - 30×30 см → 890 ₽
  - 30×60 см → 1 490 ₽
  - 60×60 см → 2 490 ₽
- **Накладка с дизайном**: 1 200 ₽ (единая цена для всех дизайнов)
- **Подписчики**: накладки бесплатно (включены в план)

### Подписки
| План | Цена/мес | Накладок |
|------|---------|---------|
| Starter | 4 900 ₽ | 10 шт |
| Popular | 9 900 ₽ | 25 шт |
| Business | 19 900 ₽ | Без лимита |

### Конструктор (domains/constructor)
- Сетка 30×30 см (1 ячейка = 60px)
- Размеры панелей: 1×1, 1×2, 2×2 ячейки
- Snap-to-grid размещение (клик или drag & drop)
- «Заполнить» — автозаполнение свободных ячеек
- Расчёт стоимости в реальном времени

### Визуализатор (domains/visualizer)
- Загрузка фото стены → определение маски (wall/not-wall)
- Инструменты маски: brush + eraser с undo-стеком (20 шагов)
- Размещение панелей: авто, ручное, акцентное
- Расчёт стоимости с учётом подписки
- Сравнение до/после (BeforeAfterSlider)

## Тестирование

182 теста в 17 файлах. Фреймворк: **Vitest + React Testing Library + jest-dom**.

```bash
npm run test         # Однократный запуск
npm run test:watch   # Watch-режим
```

| Домен / Модуль | Файлов | Что тестируется |
|---------------|--------|----------------|
| visualizer | 9 | store, costCalculator, maskUtils, layoutEngine, imageProcessing, adapters, UI-компоненты |
| catalog | 1 | API-адаптеры |
| order | 1 | cartStore |
| subscription | 1 | subscriptionStore |
| auth | 1 | authStore |
| account | 1 | accountStore |
| shared/api | 2 | HTTP-клиент, API-типы |
| shared/config | 1 | Константы и цены |

## Дизайн-система

- **Цвета**: фон `#FFFFFF` / `#FBFBFD`, текст `#1d1d1f`, вторичный `#86868b`, акцент `#0071e3`
- **Шрифт**: Inter (300–900), Google Fonts
- **Радиусы**: 12px общий, 980px кнопки (pill), 20px карточки
- **Стилизация**: inline style objects (без CSS-модулей / Tailwind)
- **Анимации**: Framer Motion (fade-in, scale, staggered)
- **Подробнее**: [`docs/design-docs/DESIGN-SYSTEM.md`](../docs/design-docs/DESIGN-SYSTEM.md)

## Переменные окружения

API интегрирован. Vite proxy `/api` → `http://localhost:8080`.

```env
VITE_API_URL=http://localhost:8080/api   # По умолчанию: /api (через proxy)
```
