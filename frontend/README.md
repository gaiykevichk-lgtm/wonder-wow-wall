# Wonder Wow Wall — Frontend

React SPA для B2C интернет-магазина модульных стеновых панелей.
Архитектура: **Domain-Driven Design (DDD)** с Bounded Contexts.

## Запуск

```bash
npm install
npm run dev -- --host 0.0.0.0    # Dev-сервер на http://localhost:3000
npm run build                     # Продакшн-сборка в dist/
npm run preview                   # Превью сборки
npx tsc --noEmit                  # Проверка типов
```

## Стек

| Библиотека | Версия | Назначение |
|-----------|--------|-----------|
| React | 19.2 | UI-фреймворк |
| TypeScript | 5.9 | Типизация |
| Vite | 8.0 | Сборка и dev-сервер |
| Ant Design | 6.3 | UI-компоненты (Button, Card, Select, Modal, Drawer...) |
| Framer Motion | 12.38 | Анимации (fade-in, scale, стaggered) |
| Zustand | 5.0 | Стейт-менеджмент (корзина, подписка, авторизация, аккаунт) |
| React Router | 7.13 | Клиентская маршрутизация (21 маршрут, lazy-loading) |
| TanStack Query | 5.91 | Data fetching (подготовлено для API) |

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
│   │   └── ui/
│   │       ├── CatalogPage.tsx   # Каталог: фильтры, поиск, grid/list, сортировка
│   │       └── ProductPage.tsx   # Товар: галерея, характеристики, похожие
│   │
│   ├── order/                    # Домен: Заказы
│   │   ├── model/
│   │   │   ├── types.ts          # CartItem
│   │   │   └── cartStore.ts      # Zustand: items, addItem, removeItem, total
│   │   └── ui/
│   │       └── CheckoutPage.tsx  # Оформление: 3 шага (контакты, доставка, оплата)
│   │
│   ├── subscription/             # Домен: Подписка
│   │   ├── model/
│   │   │   ├── types.ts          # SubscriptionPlan
│   │   │   └── subscriptionStore.ts # Zustand с persist (localStorage)
│   │   └── ui/
│   │       └── PricingPage.tsx   # Тарифы: покупка vs подписка, 3 плана
│   │
│   ├── constructor/              # Домен: Конструктор стен
│   │   ├── model/
│   │   │   └── types.ts          # ConstructorPanel
│   │   └── ui/
│   │       └── ConstructorPage.tsx # Snap-to-grid, drag&drop, расчёт стоимости
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
│   ├── config/
│   │   └── constants.ts          # PANEL_SIZES, BASE_PANEL_PRICES, DESIGN_OVERLAY_PRICE
│   │
│   ├── api/                      # (подготовлено для будущего API)
│   ├── hooks/                    # (подготовлено для будущих хуков)
│   ├── router.tsx                # Все маршруты + lazy-loading
│   └── theme.ts                  # Ant Design тема (цвета, шрифты, border-radius)
│
└── index.css                     # Глобальные стили (Inter, scrollbar, hover-эффекты)
```

### Bounded Contexts (домены)

| Домен | Ответственность | Model | UI |
|-------|----------------|-------|-----|
| **catalog** | Дизайны, категории, отзывы | types.ts, data.ts | CatalogPage, ProductPage |
| **order** | Корзина, оформление заказа | types.ts, cartStore.ts | CheckoutPage |
| **subscription** | Планы, управление подпиской | types.ts, subscriptionStore.ts | PricingPage |
| **constructor** | Визуальный редактор стены | types.ts | ConstructorPage |
| **auth** | Авторизация, JWT, защита маршрутов | types.ts, authStore.ts | LoginPage, RegisterPage, ForgotPasswordPage, RequireAuth |
| **account** | Личный кабинет пользователя | types.ts, accountStore.ts | AccountLayout, ProfileSection, OrdersSection, ProjectsSection, AccountConstructorSection, FavoritesSection, AccountSubscriptionSection |
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
domains/content  ──→  domains/catalog (данные для главной)
shared/ui        ──→  domains/* (кросс-доменная интеграция)
```

- Домены **не** импортируют друг друга напрямую (кроме зависимостей через типы)
- `shared/` содержит кросс-доменную логику и общую инфраструктуру
- Каждый домен инкапсулирует свои model (типы, сторы, данные) и ui (страницы)

## Маршруты

| Путь | Домен | Страница | Описание |
|------|-------|---------|---------|
| `/` | content | HomePage | Главная с Hero, категориями, отзывами |
| `/catalog` | catalog | CatalogPage | Каталог дизайнов с фильтрами |
| `/product/:id` | catalog | ProductPage | Детальная страница дизайна |
| `/constructor` | constructor | ConstructorPage | Визуальный конструктор стен |
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

## Состояние (State)

### Домен order — CartStore (`domains/order/model/cartStore.ts`)
- `items: CartItem[]` — товары в корзине
- `addItem()` — добавить (объединяет дубли)
- `removeItem()` / `updateQuantity()` / `clearCart()`
- `total()` / `totalItems()` — вычисляемые значения

### Домен subscription — SubscriptionStore (`domains/subscription/model/subscriptionStore.ts`)
- `activePlanId` — текущий план (null / starter / popular / business)
- `subscribe(planId)` — активировать подписку
- `cancelSubscription()` — отменить
- `hasSubscription()` — есть ли активная подписка
- `getActivePlan()` — данные текущего плана
- Modal: `openModal()` / `closeModal()` / `setModalStep()`
- Persist → localStorage (ключ: `wow-wall-subscription`)

### Домен auth — AuthStore (`domains/auth/model/authStore.ts`)
- `user: User | null` — текущий пользователь
- `token: string | null` — JWT-токен (мок)
- `isAuth: boolean` — авторизован ли
- `login(email, password)` / `register(name, email, phone, password)` — мок-реализация
- `logout()` — сброс состояния
- `updateProfile(data)` — обновление имени, email, телефона
- `addAddress()` / `removeAddress()` / `setDefaultAddress()` — управление адресами
- Persist → localStorage (ключ: `wow-wall-auth`)

### Домен account — AccountStore (`domains/account/model/accountStore.ts`)
- `orders: Order[]` — история заказов (мок-данные)
- `projects: SavedProject[]` — сохранённые проекты конструктора
- `favoriteIds: string[]` — ID избранных дизайнов
- `saveProject()` / `updateProject()` / `deleteProject()` — CRUD проектов
- `toggleFavorite()` / `isFavorite()` — управление избранным
- Persist → localStorage (ключ: `wow-wall-account`)

## Бизнес-логика

### Ценообразование (shared/config/constants.ts)
- **Базовая панель** (разовая покупка):
  - 30×30 см → 890 ₽
  - 30×60 см → 1 490 ₽
  - 60×60 см → 2 490 ₽
- **Накладка с дизайном**: 1 200 ₽ (единая цена для всех дизайнов)
- **Подписчики**: накладки бесплатно (включены в план)

### Конструктор (domains/constructor)
- Сетка 30×30 см (1 ячейка = 60px)
- Размеры панелей: 1×1, 1×2, 2×2 ячейки
- Snap-to-grid размещение (клик или drag & drop)
- «Заполнить» — автозаполнение свободных ячеек
- Расчёт стоимости в реальном времени

## Дизайн-система

- **Цвета**: фон `#FFFFFF` / `#F5F5F5`, текст `#2D2D2D`, акцент `#4CAF50` (только для бейджей, статусов)
- **Шрифт**: Inter (400–800)
- **Радиусы**: 8px кнопки, 12px карточки, 20px планы подписки
- **Стилизация**: inline style objects (без CSS-модулей)
- **Подробнее**: [`docs/design-docs/DESIGN-SYSTEM.md`](../docs/design-docs/DESIGN-SYSTEM.md)

## Переменные окружения

На текущем этапе (MVP с моковыми данными) переменные не требуются. При подключении API:

```env
VITE_API_URL=http://localhost:8080/api
```
