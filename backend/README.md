# Wonder Wow Wall — Backend

REST API для B2C интернет-магазина модульных стеновых панелей.
Архитектура: **Domain-Driven Design (DDD)** — Domain / Application / Infrastructure layers.

> **Статус**: ✅ реализовано (Фаза 9). DDD-архитектура, in-memory репозитории, 29 API-маршрутов, 97 тестов.

## Стек (планируемый)

| Технология | Назначение |
|-----------|-----------|
| FastAPI | REST API фреймворк |
| SQLAlchemy 2.0 | ORM (async) |
| PostgreSQL 16 | Основная БД |
| Redis | Кеширование, сессии |
| Alembic | Миграции БД |
| Pydantic v2 | Валидация и сериализация |
| JWT (python-jose) | Аутентификация |
| Docker | Контейнеризация |
| pytest + httpx | Тестирование |

## Запуск (после реализации)

```bash
# Локально
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8080

# Docker
docker compose up -d
```

## Архитектура (DDD)

### Принципы

- **Domain Layer** — чистая бизнес-логика без зависимостей от фреймворков
- **Application Layer** — use cases координируют доменную логику
- **Infrastructure Layer** — реализации (БД, API, JWT) зависят от домена, а не наоборот
- **Dependency Rule**: domain ← application ← infrastructure (зависимости направлены внутрь)

### Структура проекта

```
backend/
├── app/
│   ├── main.py                  # FastAPI приложение, middleware, CORS
│   ├── config.py                # Настройки (Pydantic BaseSettings)
│   │
│   ├── domain/                  # Domain Layer (чистая бизнес-логика)
│   │   ├── catalog/             # Bounded Context: Каталог
│   │   │   ├── entities.py      # Design (Aggregate Root), Category, DesignReview
│   │   │   ├── value_objects.py # PanelSize, Color, Price
│   │   │   ├── repositories.py  # Абстрактные интерфейсы репозиториев (ABC)
│   │   │   └── services.py     # Доменные сервисы каталога
│   │   │
│   │   ├── order/               # Bounded Context: Заказы
│   │   │   ├── entities.py      # Order (Aggregate Root), OrderItem
│   │   │   ├── value_objects.py # Address, OrderStatus, Money
│   │   │   ├── repositories.py
│   │   │   └── services.py     # PricingService (доменный сервис)
│   │   │
│   │   ├── subscription/        # Bounded Context: Подписки
│   │   │   ├── entities.py      # Subscription (Aggregate Root), SubscriptionPlan
│   │   │   ├── value_objects.py # SubscriptionTier, BillingPeriod
│   │   │   ├── repositories.py
│   │   │   └── services.py
│   │   │
│   │   └── user/                # Bounded Context: Пользователи
│   │       ├── entities.py      # User (Aggregate Root)
│   │       ├── value_objects.py # Email, Password
│   │       ├── repositories.py
│   │       └── services.py
│   │
│   ├── application/             # Application Layer (use cases, координация)
│   │   ├── catalog/
│   │   │   └── use_cases.py     # ListDesigns, GetDesignDetails, AddReview
│   │   ├── order/
│   │   │   └── use_cases.py     # CreateOrder, GetOrderHistory, CalculateWallCost
│   │   ├── subscription/
│   │   │   └── use_cases.py     # Subscribe, CancelSubscription, CheckOverlayLimit
│   │   └── user/
│   │       └── use_cases.py     # Register, Login, UpdateProfile
│   │
│   ├── infrastructure/          # Infrastructure Layer (реализации)
│   │   ├── persistence/
│   │   │   ├── database.py      # Async engine, sessionmaker, Base
│   │   │   ├── models.py        # SQLAlchemy ORM-модели (маппинг на доменные сущности)
│   │   │   └── repositories/    # Реализации репозиториев
│   │   │       ├── catalog_repo.py
│   │   │       ├── order_repo.py
│   │   │       ├── subscription_repo.py
│   │   │       └── user_repo.py
│   │   │
│   │   ├── api/                 # FastAPI роутеры (адаптеры)
│   │   │   ├── catalog.py       # GET /api/designs, /categories, /reviews
│   │   │   ├── orders.py        # POST/GET /api/orders
│   │   │   ├── subscriptions.py # POST/GET/DELETE /api/subscriptions
│   │   │   ├── auth.py          # POST /api/auth/register, /login
│   │   │   ├── projects.py      # CRUD /api/projects
│   │   │   └── contacts.py      # POST /api/contacts
│   │   │
│   │   └── security/
│   │       └── jwt.py           # JWT tokens, password hashing
│   │
│   └── utils/
│       └── dependencies.py      # FastAPI Depends (get_db, get_current_user)
│
├── alembic/                     # Миграции
├── tests/                       # Тесты по bounded contexts
│   ├── domain/                  # Unit-тесты доменного слоя
│   │   ├── test_catalog.py
│   │   ├── test_order.py
│   │   └── test_subscription.py
│   ├── application/             # Тесты use cases
│   │   ├── test_catalog_use_cases.py
│   │   └── test_order_use_cases.py
│   └── api/                     # Интеграционные тесты API
│       ├── test_catalog_api.py
│       ├── test_orders_api.py
│       └── test_auth_api.py
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── alembic.ini
├── CONVENTIONS.md
└── README.md                    ← вы здесь
```

### Bounded Contexts (ограниченные контексты)

| Домен | Aggregate Root | Entities | Value Objects |
|-------|---------------|----------|--------------|
| **Catalog** | Design | Category, DesignReview | PanelSize, Color, Price |
| **Order** | Order | OrderItem | Address, OrderStatus, Money |
| **Subscription** | Subscription | SubscriptionPlan | SubscriptionTier, BillingPeriod |
| **User** | User | — | Email, Password |

### Потоки данных (слои)

```
HTTP Request
    ↓
[Infrastructure: API Router] — валидация, сериализация
    ↓
[Application: Use Case] — координация, транзакции
    ↓
[Domain: Entity + Service] — бизнес-правила
    ↓
[Infrastructure: Repository] — персистентность
    ↓
HTTP Response
```

## API Endpoints (план)

### Auth
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Авторизация → JWT |
| POST | `/api/auth/forgot-password` | Восстановление пароля |
| GET | `/api/auth/me` | Текущий пользователь |

### Catalog (designs)
| Метод | Путь | Описание |
|-------|------|---------|
| GET | `/api/designs` | Список дизайнов (фильтры, пагинация) |
| GET | `/api/designs/:id` | Детали дизайна |
| GET | `/api/categories` | Список категорий |
| GET | `/api/designs/:id/reviews` | Отзывы к дизайну |
| POST | `/api/designs/:id/reviews` | Добавить отзыв (auth) |

### Orders
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/orders` | Создать заказ |
| GET | `/api/orders` | Мои заказы (auth) |
| GET | `/api/orders/:id` | Детали заказа (auth) |

### Subscriptions
| Метод | Путь | Описание |
|-------|------|---------|
| GET | `/api/subscriptions/plans` | Доступные планы |
| POST | `/api/subscriptions` | Оформить подписку (auth) |
| GET | `/api/subscriptions/status` | Статус подписки (auth) |
| DELETE | `/api/subscriptions` | Отменить подписку (auth) |

### Projects (конструктор)
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/projects` | Сохранить проект (auth) |
| GET | `/api/projects` | Мои проекты (auth) |
| GET | `/api/projects/:id` | Детали проекта (auth) |
| DELETE | `/api/projects/:id` | Удалить проект (auth) |

### Pricing
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/calculator` | Расчёт стоимости стены |

### Other
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/contacts` | Форма обратной связи |
| GET | `/api/portfolio` | Портфолио проектов |

## Модель данных (доменные сущности)

### Catalog Domain

**Design** (Aggregate Root)
- `id`, `name`, `slug`, `category_id`, `style`, `image_url`, `description`
- `price` = 1 200 ₽ (единая цена для всех дизайнов)
- `colors[]`, `specs{}`, `rating`, `reviews_count`

**PanelSize** (Value Object)
- 3 размера: 300×300, 300×600, 600×600 мм
- Цены: 890 / 1 490 / 2 490 ₽

### Order Domain

**Order** (Aggregate Root)
- `id`, `user_id`, `status`, `total`, `items[]`, `address`, `created_at`
- Статусы: pending → confirmed → in_progress → installed → completed

### Subscription Domain

**Subscription** (Aggregate Root)
- `id`, `user_id`, `plan_id`, `status`, `started_at`, `expires_at`

**SubscriptionPlan**
- `id`, `name`, `price`, `period`, `overlays_per_month`, `features[]`

### User Domain

**User** (Aggregate Root)
- `id`, `email`, `password_hash`, `name`, `phone`, `created_at`

## Переменные окружения (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/wow_wall
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000
```
