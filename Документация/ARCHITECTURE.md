# Wonder Wow Wall — Архитектура

## Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                        │
│                    React 19 + TypeScript                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Catalog   │ │  Order   │ │   Auth   │ │Visualizer│       │
│  │ Context   │ │  Context │ │  Context │ │  Context │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend (API)                         │
│                   FastAPI + SQLAlchemy                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Domain Layer (DDD)                     │    │
│  │  Catalog │ Order │ Subscription │ User │ Visualizer │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │            Application Layer (Use Cases)            │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Infrastructure (Persistence, API)          │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        ┌──────────┐         ┌──────────┐
        │PostgreSQL│         │  Redis   │
        │   (DB)   │         │  (Cache) │
        └──────────┘         └──────────┘
```

## Стек технологий

### Frontend

| Слой | Технологии |
|------|-----------|
| UI Framework | React 19 + TypeScript 5.9 |
| Bundler | Vite 8 |
| UI Library | Ant Design 6 + Framer Motion 12 |
| State Management | Zustand 5 (4 stores: cart, subscription, auth, account) |
| Routing | React Router 7 (21 route, lazy-loading) |
| Data Fetching | TanStack Query 5 |
| API Client | Fetch wrapper (JWT auto-attach) |
| Testing | Vitest + React Testing Library (156 tests) |
| Canvas (Visualizer) | Konva + React-Konva |

### Backend

| Слой | Технологии |
|------|-----------|
| Framework | FastAPI 0.115 + Uvicorn |
| Language | Python 3.12 |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| Validation | Pydantic 2.11 |
| Testing | pytest + httpx (97 tests) |

### Infrastructure

| Компонент | Решение |
|-----------|---------|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| Database | PostgreSQL (managed) |
| Cache | Redis (managed) |
| Hosting | VM (ssh://root@72.56.37.191) |

## Bounded Contexts (DDD)

### Frontend Domains

| Домен | Описание | Aggregate Root | Model Files | UI Pages |
|-------|---------|----------------|------------|----------|
| **catalog** | Дизайны, категории, отзывы | Design | types.ts, data.ts, catalogApi.ts, adapters.ts | CatalogPage, ProductPage |
| **order** | Корзина, оформление заказа | Order | types.ts, cartStore.ts, orderApi.ts | CheckoutPage |
| **subscription** | Планы, управление подпиской | Subscription | types.ts, subscriptionStore.ts, subscriptionApi.ts | PricingPage |
| **constructor** | Snap-to-grid редактор стен | — | types.ts | ConstructorPage |
| **auth** | Регистрация, вход, JWT | User | types.ts, authStore.ts, authApi.ts | LoginPage, RegisterPage, ForgotPasswordPage |
| **account** | Профиль, заказы, проекты | — | types.ts, accountStore.ts, accountApi.ts | AccountLayout + 6 sections |
| **visualizer** | Фото-редактор стен | VisualizationProject | types.ts, visualizerStore.ts, adapters.ts + lib/ | PhotoEditorPage + 8 subcomponents |
| **content** | Информационные страницы | — | — | Home, About, FAQ, Portfolio, Contacts... |

### Backend Domains

| Домен | Aggregate Root | Entities | Value Objects |
|-------|---------------|----------|---------------|
| **Catalog** | Design | Category, DesignReview | PanelSize, Color, Price |
| **Order** | Order | OrderItem | Address, OrderStatus, Money |
| **Subscription** | Subscription | SubscriptionPlan | SubscriptionTier, BillingPeriod |
| **User** | User | UserAddress | Email, Password |
| **Visualizer** | VisualizationProject | Scene, WallMask, ObjectMask | — |

## Структура проекта

```
wonder-wow-wall/
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── app/                      # Application layer
│   │   │   ├── App.tsx               # Router + providers
│   │   │   └── main.tsx              # Entry point
│   │   ├── domains/                  # Bounded Contexts
│   │   │   ├── catalog/              # Каталог дизайнов
│   │   │   ├── order/                # Заказы
│   │   │   ├── subscription/         # Подписка
│   │   │   ├── constructor/          # Конструктор стен
│   │   │   ├── auth/                 # Авторизация
│   │   │   ├── account/              # Личный кабинет
│   │   │   ├── visualizer/           # Фото-редактор
│   │   │   └── content/              # Информационные страницы
│   │   └── shared/                   # Cross-cutting
│   │       ├── ui/                   # Layout, Header, Footer, CartDrawer
│   │       ├── api/                  # client.ts, types.ts
│   │       ├── config/               # constants.ts
│   │       ├── router.tsx            # Routes
│   │       └── theme.ts              # Ant Design theme
│   ├── Dockerfile
│   └── package.json
│
├── backend/                          # FastAPI API
│   ├── app/
│   │   ├── main.py                   # FastAPI app
│   │   ├── config.py                 # Settings
│   │   ├── container.py              # DI container
│   │   ├── domain/                   # Domain Layer
│   │   │   ├── catalog/              # Design, Category, Review
│   │   │   ├── order/                # Order, OrderItem
│   │   │   ├── subscription/         # Subscription, Plan
│   │   │   └── user/                 # User, Address
│   │   ├── application/              # Application Layer
│   │   │   ├── catalog/use_cases.py
│   │   │   ├── order/use_cases.py
│   │   │   ├── subscription/use_cases.py
│   │   │   └── user/use_cases.py
│   │   └── infrastructure/           # Infrastructure Layer
│   │       ├── api/                  # FastAPI routers
│   │       ├── persistence/          # DB models + repos
│   │       └── security/             # JWT
│   ├── tests/                        # pytest tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml                # All services
├── nginx/                           # Nginx config
└── docs/                            # Documentation
```

## Dependency Rule (DDD)

```
┌─────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                     │
│           (Persistence, API Routers, Security)              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Application Layer                         │
│                    (Use Cases)                               │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      Domain Layer                            │
│              (Entities, Value Objects, Services)             │
└─────────────────────────────────────────────────────────────┘
```

**Правило**: Зависимости направлены только внутрь. Инфраструктура зависит от Application, Application зависит от Domain. Обратное невозможно.

## API Endpoints (Backend)

### Auth (`/api/auth`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/register` | Регистрация | — |
| POST | `/api/auth/login` | Авторизация | — |
| GET | `/api/auth/me` | Профиль | Bearer |
| PATCH | `/api/auth/me` | Обновить профиль | Bearer |

### Catalog (`/api`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/designs` | Список дизайнов | — |
| GET | `/api/designs/{id}` | Детали дизайна | — |
| GET | `/api/categories` | Категории | — |
| GET | `/api/designs/{id}/reviews` | Отзывы | — |
| POST | `/api/designs/{id}/reviews` | Добавить отзыв | Bearer |

### Orders (`/api/orders`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/orders` | Создать заказ | Bearer |
| GET | `/api/orders` | Мои заказы | Bearer |
| GET | `/api/orders/{id}` | Детали заказа | Bearer |
| POST | `/api/orders/calculate` | Расчёт стоимости | — |

### Subscriptions (`/api/subscriptions`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/subscriptions/plans` | Доступные планы | — |
| POST | `/api/subscriptions` | Оформить подписку | Bearer |
| GET | `/api/subscriptions/status` | Статус | Bearer |
| DELETE | `/api/subscriptions` | Отменить | Bearer |

### Projects (`/api/projects`)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| CRUD | `/api/projects/*` | Управление проектами | Bearer |

**Total: 25+ endpoints**

## Frontend State Management

### Zustand Stores

| Store | File | Persist | Key | Purpose |
|-------|------|---------|-----|---------|
| CartStore | `domains/order/model/cartStore.ts` | ❌ | — | Cart items, totals |
| SubscriptionStore | `domains/subscription/model/subscriptionStore.ts` | ✅ | `wow-wall-subscription` | Active plan, modal state |
| AuthStore | `domains/auth/model/authStore.ts` | ✅ | `wow-wall-auth` | User, JWT token |
| AccountStore | `domains/account/model/accountStore.ts` | ✅ | `wow-wall-account` | Orders, projects, favorites |
| VisualizerStore | `domains/visualizer/model/visualizerStore.ts` | ❌ | — | Scene, masks, panels, undo stack |

### API Integration (TanStack Query)

| Hook | Domain | Purpose |
|------|--------|---------|
| `useDesigns()`, `useDesign()` | catalog | Fetch designs |
| `useCategories()` | catalog | Fetch categories |
| `useDesignReviews()` | catalog | Fetch/add reviews |
| `useLogin()`, `useRegister()` | auth | Auth operations |
| `useCreateOrder()` | order | Create orders |
| `useOrders()` | account | Fetch order history |
| `useSubscribe()`, `useCancelSubscription()` | subscription | Subscription management |
| `useProjects()` | account | CRUD projects |

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx (port 80)                      │
│              Reverse proxy → frontend + backend              │
└────────┬─────────────────────────────────┬──────────────────┘
         │                                 │
         ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│    Frontend      │              │     Backend      │
│   (React SPA)    │              │    (FastAPI)     │
│    Port 80       │              │    Port 8080    │
└──────────────────┘              └────────┬─────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                          ▼                ▼                ▼
                   ┌──────────┐     ┌──────────────┐  ┌──────────┐
                   │PostgreSQL│     │    Redis     │  │  Uploads │
                   │  :5432   │     │    :6379    │  │  Volume  │
                   └──────────┘     └──────────────┘  └──────────┘
```

## Дизайн-система

### Цвета
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#FFFFFF` / `#FBFBFD` | Основной фон |
| Text Primary | `#1d1d1f` | Основной текст |
| Text Secondary | `#86868b` | Вторичный текст |
| Accent | `#0071e3` | Кнопки, ссылки |
| Success | `#34c759` | Успех |
| Error | `#ff3b30` | Ошибки |

### Типографика
- **Font**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700, 800, 900

### Spacing
- Base unit: 8px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96

### Border Radius
- General: 12px
- Buttons: 980px (pill)
- Cards: 20px

Подробнее: [`docs/design-docs/DESIGN-SYSTEM.md`](../docs/design-docs/DESIGN-SYSTEM.md)
