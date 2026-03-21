# Wonder Wow Wall

> B2C веб-приложение — интернет-магазин модульных стеновых панелей с конструктором и подпиской.
> Архитектура: **Domain-Driven Design (DDD)** с Bounded Contexts.

## Быстрый старт

```bash
# Frontend
cd frontend
npm install
npm run dev -- --host 0.0.0.0    # → http://localhost:3000

# Backend (планируется)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload     # → http://localhost:8080
```

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 8 |
| UI | Ant Design 6 + Framer Motion 12 |
| State | Zustand 5 (cart, subscription, auth, account) |
| Routing | React Router 7 (21 маршрут, lazy-loading) |
| Data Fetching | TanStack Query 5 (интегрировано с API) |
| API Client | Fetch wrapper с JWT auto-attach, ApiError, 401 redirect |
| Backend | FastAPI + SQLAlchemy + PostgreSQL (DDD, 29 API routes) |
| Deploy | Docker + Nginx |

## Архитектура: Domain-Driven Design

Проект организован по принципам **DDD** — код сгруппирован по бизнес-доменам (Bounded Contexts), а не по техническим слоям.

### Bounded Contexts (ограниченные контексты)

| Домен | Описание | Aggregate Root |
|-------|---------|----------------|
| **Catalog** | Дизайны накладок, категории, отзывы | Design |
| **Order** | Корзина, оформление, история заказов | Order |
| **Subscription** | Планы подписки, управление, лимиты накладок | Subscription |
| **Constructor** | Snap-to-grid размещение, визуализация, расчёт стоимости | — |
| **Auth** | Регистрация, вход, JWT, защищённые маршруты | User |
| **Account** | Личный кабинет: профиль, заказы, проекты, избранное, конструктор, подписка | — |
| **Visualizer** | Фото-редактор стен: загрузка фото, сегментация, размещение панелей | VisualizationProject |
| **Content** | Информационные страницы (О нас, FAQ, Портфолио и др.) | — |

### Ubiquitous Language (единый язык)

- **Накладка** (overlay) — сменный дизайн на магнитном креплении
- **Панель** (panel) — базовая стеновая пластина (30×30, 30×60, 60×60 см)
- **Дизайн** (design) — визуальное оформление накладки
- **Подписка** (subscription) — ежемесячное обновление накладок
- **Конструктор** (constructor) — визуальный редактор стены (абстрактная сетка)
- **Визуализатор** (visualizer) — фото-редактор стены (реальное фото + ML-сегментация)

## Структура проекта

```
wonder-wow-wall/
├── AGENTS.md                    ← вы здесь
├── docs/
│   ├── REQUIREMENTS.md          # Полные требования к продукту
│   ├── design-docs/
│   │   └── DESIGN-SYSTEM.md     # Дизайн-система: цвета, шрифты, компоненты
│   └── exec-plans/
│       ├── active/
│       │   └── PLAN-MVP.md      # 12-фазный план разработки
│       └── completed/           # Завершённые планы
│
├── frontend/                    # React SPA (DDD-структура)
│   ├── README.md                # Документация фронтенда
│   ├── CONVENTIONS.md           # Конвенции кода фронтенда
│   └── src/
│       ├── app/                 # Application layer (routing, providers)
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── domains/             # Bounded Contexts (бизнес-домены)
│       │   ├── catalog/         # Каталог дизайнов
│       │   │   ├── model/       # Типы, данные
│       │   │   └── ui/          # Страницы каталога
│       │   ├── order/           # Заказы
│       │   │   ├── model/       # CartItem, cartStore
│       │   │   └── ui/          # CheckoutPage
│       │   ├── subscription/    # Подписка
│       │   │   ├── model/       # SubscriptionPlan, subscriptionStore
│       │   │   └── ui/          # PricingPage
│       │   ├── constructor/     # Конструктор стен (абстрактная сетка)
│       │   │   ├── model/       # ConstructorPanel
│       │   │   └── ui/          # ConstructorPage
│       │   ├── auth/            # Авторизация
│       │   │   ├── model/       # User, Address, authStore
│       │   │   └── ui/          # LoginPage, RegisterPage, ForgotPasswordPage, RequireAuth
│       │   ├── account/         # Личный кабинет
│       │   │   ├── model/       # Order, SavedProject, accountStore
│       │   │   └── ui/          # AccountLayout, Profile, Orders, Projects, Constructor, Favorites, Subscription
│       │   ├── visualizer/      # Фото-редактор стен (реальное фото)
│       │   │   ├── model/       # Scene, WallMask, PanelLayout, VisualizationProject
│       │   │   ├── ui/          # PhotoEditorPage, WallCanvas, MaskOverlay
│       │   │   └── lib/         # canvasRenderer, maskUtils, imageProcessing
│       │   └── content/         # Информационные страницы
│       │       └── ui/          # Home, About, FAQ, Portfolio...
│       ├── shared/              # Cross-cutting concerns
│       │   ├── ui/              # Layout, Header, Footer, CartDrawer, SubscriptionModal
│       │   ├── config/          # Константы (цены, размеры)
│       │   ├── router.tsx       # Маршрутизация
│       │   └── theme.ts         # Ant Design тема
│       └── index.css            # Глобальные стили
│
└── backend/                     # FastAPI (планируется, DDD-архитектура)
    ├── README.md
    ├── CONVENTIONS.md
    └── app/
        ├── domain/              # Domain Layer (чистая бизнес-логика)
        │   ├── catalog/         # Entities, Value Objects, Repositories (ABC)
        │   ├── order/
        │   ├── subscription/
        │   ├── user/
        │   └── visualizer/      # Scene, WallMask, ObjectMask, VisualizationProject
        ├── application/         # Application Layer (use cases)
        │   ├── catalog/
        │   ├── order/
        │   ├── subscription/
        │   ├── user/
        │   └── visualizer/      # UploadPhoto, CorrectMask, SaveProject, ExportImage
        └── infrastructure/      # Infrastructure Layer (БД, API, JWT)
            ├── persistence/     # SQLAlchemy, реализации репозиториев
            ├── api/             # FastAPI роутеры
            └── security/        # JWT, хеширование
```

## Принципы DDD

- **Bounded Contexts**: каждый домен изолирован, общается через чёткие интерфейсы
- **Domain Layer**: чистая бизнес-логика без зависимостей от фреймворков
- **Application Layer**: use cases координируют доменную логику
- **Infrastructure Layer**: реализации (БД, API, внешние сервисы) зависят от домена, а не наоборот
- **Dependency Rule**: domain ← application ← infrastructure (зависимости направлены внутрь)

## Бизнес-модель

- **Базовые панели** (3 размера: 30×30, 30×60, 60×60 см) — крепятся на стену один раз
- **Накладки с дизайном** — магнитное крепление, единая цена 1 200 ₽ за любой дизайн
- **Подписка** — ежемесячное обновление накладок (3 плана: 4 900 / 9 900 / 19 900 ₽)

## Ключевые фичи (реализовано)

- [x] Каталог дизайнов с фильтрами и поиском
- [x] Страница товара с галереей, характеристиками
- [x] Конструктор стен — snap-to-grid, drag & drop, визуализация
- [x] Корзина (Drawer) + Checkout (3 шага)
- [x] Подписка — выбор плана, оформление, статус в хедере, скидки в конструкторе
- [x] Тарифы — покупка vs подписка, прозрачное ценообразование
- [x] Информационные страницы (О нас, FAQ, Портфолио, Контакты)
- [x] Авторизация — вход, регистрация, восстановление пароля, protected routes
- [x] Личный кабинет — профиль, заказы, проекты, конструктор, избранное, подписка
- [x] Фото-редактор стен (Visualizer MVP) — загрузка фото, маски, размещение панелей, расчёт стоимости, корзина
- [x] Backend API (FastAPI + DDD) — 4 bounded contexts, 29 маршрутов, JWT auth, in-memory repos
- [x] Тестовое покрытие — Frontend: 156 тестов (vitest), Backend: 97 тестов (pytest)

## Дальнейшая документация

- Требования: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Дизайн-система: [`docs/design-docs/DESIGN-SYSTEM.md`](docs/design-docs/DESIGN-SYSTEM.md)
- Фото-редактор (архитектура): [`docs/design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md`](docs/design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md)
- Фото-редактор (спецификация): [`docs/product-specs/PHOTO-WALL-EDITOR.md`](docs/product-specs/PHOTO-WALL-EDITOR.md)
- План разработки: [`docs/exec-plans/active/PLAN-MVP.md`](docs/exec-plans/active/PLAN-MVP.md)
- Frontend: [`frontend/README.md`](frontend/README.md)
- Backend: [`backend/README.md`](backend/README.md)
