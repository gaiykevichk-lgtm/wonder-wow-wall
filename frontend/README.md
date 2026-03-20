# Wonder Wow Wall — Frontend

React SPA для B2C интернет-магазина модульных стеновых панелей.

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
| Zustand | 5.0 | Стейт-менеджмент (корзина, подписка) |
| React Router | 7.13 | Клиентская маршрутизация (11 маршрутов) |
| TanStack Query | 5.91 | Data fetching (подготовлено для API) |

## Архитектура

```
src/
├── main.tsx                     # Точка входа: BrowserRouter + AntD ConfigProvider + QueryClient
├── App.tsx                      # Рендер AppRouter
├── index.css                    # Глобальные стили (Inter, scrollbar, hover-эффекты)
│
├── pages/                       # Страницы (lazy-loaded через React.lazy + Suspense)
│   ├── home/HomePage.tsx        # Главная: Hero, категории, популярные, отзывы
│   ├── catalog/CatalogPage.tsx  # Каталог: фильтры, поиск, grid/list, сортировка
│   ├── product/ProductPage.tsx  # Товар: галерея, характеристики, похожие
│   ├── constructor/             # Конструктор стен: snap-to-grid, drag&drop, расчёт
│   ├── checkout/                # Оформление: 3 шага (контакты, доставка, оплата)
│   ├── pricing/                 # Тарифы: покупка vs подписка, 3 плана
│   ├── about/                   # О компании
│   ├── contacts/                # Контакты + форма
│   ├── how-it-works/            # Как это работает (4 шага)
│   ├── portfolio/               # Портфолио проектов
│   └── faq/                     # FAQ (Collapse-секции)
│
└── shared/
    ├── ui/                      # Общие UI-компоненты
    │   ├── ShopLayout.tsx       # Обёртка: Header + Outlet + Footer + CartDrawer + SubModal
    │   ├── ShopHeader.tsx       # Фиксированный хедер, scroll-эффект, подписка-бейдж
    │   ├── ShopFooter.tsx       # 4-колоночный футер
    │   ├── CartDrawer.tsx       # Корзина (Ant Design Drawer)
    │   └── SubscriptionModal.tsx # 3-шаговая модалка подписки
    │
    ├── store/                   # Zustand stores
    │   ├── cartStore.ts         # Корзина: items, addItem, removeItem, total
    │   └── subscriptionStore.ts # Подписка: plans, subscribe, cancel, persist(localStorage)
    │
    ├── data/
    │   └── products.ts          # Моковые данные: 12 дизайнов, категории, цены, отзывы
    │
    ├── types/
    │   └── index.ts             # Интерфейсы: PanelProduct, CartItem, Category, Review
    │
    ├── router.tsx               # Все маршруты + lazy-loading
    └── theme.ts                 # Ant Design тема (цвета, шрифты, border-radius)
```

## Маршруты

| Путь | Страница | Описание |
|------|---------|---------|
| `/` | HomePage | Главная с Hero, категориями, отзывами |
| `/catalog` | CatalogPage | Каталог дизайнов с фильтрами |
| `/product/:id` | ProductPage | Детальная страница дизайна |
| `/constructor` | ConstructorPage | Визуальный конструктор стен |
| `/checkout` | CheckoutPage | Оформление заказа (3 шага) |
| `/pricing` | PricingPage | Тарифы: покупка и подписка |
| `/about` | AboutPage | О компании |
| `/contacts` | ContactsPage | Контакты и форма |
| `/how-it-works` | HowItWorksPage | Как это работает |
| `/portfolio` | PortfolioPage | Портфолио проектов |
| `/faq` | FaqPage | Часто задаваемые вопросы |

## Состояние (State)

### CartStore
- `items: CartItem[]` — товары в корзине
- `addItem()` — добавить (объединяет дубли)
- `removeItem()` / `updateQuantity()` / `clearCart()`
- `total()` / `totalItems()` — вычисляемые значения

### SubscriptionStore (persist → localStorage)
- `activePlanId` — текущий план (null / starter / popular / business)
- `subscribe(planId)` — активировать подписку
- `cancelSubscription()` — отменить
- `hasSubscription()` — есть ли активная подписка
- `getActivePlan()` — данные текущего плана
- Modal: `openModal()` / `closeModal()` / `setModalStep()`

## Бизнес-логика

### Ценообразование
- **Базовая панель** (разовая покупка):
  - 30×30 см → 890 ₽
  - 30×60 см → 1 490 ₽
  - 60×60 см → 2 490 ₽
- **Накладка с дизайном**: 1 200 ₽ (единая цена для всех дизайнов)
- **Подписчики**: накладки бесплатно (включены в план)

### Конструктор
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
