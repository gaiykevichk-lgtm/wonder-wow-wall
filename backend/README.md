# Wonder Wow Wall — Backend

REST API для B2C интернет-магазина модульных стеновых панелей.
Архитектура: **Domain-Driven Design (DDD)** — Domain / Application / Infrastructure layers.

> **Статус**: MVP реализован. DDD-архитектура, in-memory репозитории, 25 API-эндпоинтов, 97 тестов, ORM-модели подготовлены.

## Стек

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| Python | 3.12 | Язык (async/await) |
| FastAPI | 0.115 | REST API фреймворк |
| Uvicorn | 0.34 | ASGI-сервер |
| SQLAlchemy | 2.0 | ORM (async mode) |
| asyncpg | 0.31 | PostgreSQL async-драйвер |
| PostgreSQL | 16 | Основная БД (через Docker) |
| Redis | 7 | Кеширование, сессии (опционально) |
| Alembic | 1.16 | Миграции БД |
| Pydantic | 2.11 | Валидация и сериализация |
| pydantic-settings | 2.9 | Конфигурация из .env |
| python-jose | 3.5 | JWT-аутентификация |
| passlib (bcrypt) | 1.7 | Хеширование паролей |
| pytest + httpx | 8.4 + 0.28 | Тестирование (async) |
| Docker | — | Контейнеризация |

## Запуск

```bash
# Локально (с in-memory репозиториями)
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# Docker (backend + PostgreSQL + Redis)
docker compose up -d    # docker-compose.yml в корне проекта
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
│   ├── main.py                  # FastAPI приложение, CORS, роутеры
│   ├── config.py                # Настройки (Pydantic BaseSettings)
│   ├── container.py             # DI-контейнер, seed-данные (12 дизайнов, 6 категорий)
│   │
│   ├── domain/                  # Domain Layer (чистая бизнес-логика)
│   │   ├── catalog/             # Bounded Context: Каталог
│   │   │   ├── entities.py      # Design (Aggregate Root), Category, DesignReview
│   │   │   ├── value_objects.py # PanelSize, Color, Price
│   │   │   ├── repositories.py  # Абстрактные интерфейсы (ABC)
│   │   │   └── services.py      # Доменные сервисы каталога
│   │   │
│   │   ├── order/               # Bounded Context: Заказы
│   │   │   ├── entities.py      # Order (Aggregate Root), OrderItem
│   │   │   ├── value_objects.py # Address, OrderStatus, Money
│   │   │   ├── repositories.py
│   │   │   └── services.py      # PricingService
│   │   │
│   │   ├── subscription/        # Bounded Context: Подписки
│   │   │   ├── entities.py      # Subscription (Aggregate Root), SubscriptionPlan
│   │   │   ├── value_objects.py # SubscriptionTier, BillingPeriod
│   │   │   ├── repositories.py
│   │   │   └── services.py
│   │   │
│   │   └── user/                # Bounded Context: Пользователи
│   │       ├── entities.py      # User (Aggregate Root), UserAddress
│   │       ├── value_objects.py # Email, Password
│   │       ├── repositories.py
│   │       └── services.py
│   │
│   ├── application/             # Application Layer (use cases)
│   │   ├── catalog/
│   │   │   └── use_cases.py     # ListDesigns, GetDesignDetails, AddReview
│   │   ├── order/
│   │   │   └── use_cases.py     # CreateOrder, GetOrderHistory, CalculateWallCost
│   │   ├── subscription/
│   │   │   └── use_cases.py     # Subscribe, CancelSubscription, CheckOverlayLimit
│   │   └── user/
│   │       └── use_cases.py     # Register, Login, GetProfile, UpdateProfile
│   │
│   ├── infrastructure/          # Infrastructure Layer (реализации)
│   │   ├── api/                 # FastAPI роутеры (HTTP-адаптеры)
│   │   │   ├── auth.py          # POST /register, /login; GET/PATCH /me
│   │   │   ├── catalog.py       # GET /designs, /categories, /reviews; POST /reviews
│   │   │   ├── orders.py        # POST/GET /orders, POST /calculate
│   │   │   ├── subscriptions.py # GET /plans, POST/GET/DELETE /subscriptions
│   │   │   ├── projects.py      # CRUD /projects
│   │   │   └── contacts.py      # POST /contacts, /calculator
│   │   │
│   │   ├── persistence/
│   │   │   ├── database.py      # Async engine, sessionmaker, Base
│   │   │   ├── models.py        # SQLAlchemy ORM-модели (10 таблиц)
│   │   │   └── repositories/
│   │   │       └── memory.py    # In-memory реализации всех репозиториев
│   │   │
│   │   └── security/
│   │       └── jwt.py           # JWT tokens (HS256), bcrypt hashing
│   │
│   └── utils/
│       └── dependencies.py      # FastAPI Depends (get_current_user_id, get_optional_user_id)
│
├── alembic/                     # Миграции (подготовлено, скрипты не созданы)
├── tests/                       # 97 тестов по bounded contexts
│   ├── domain/                  # Unit-тесты доменных сущностей
│   │   ├── test_catalog.py      # 19 тестов
│   │   ├── test_order.py        # 17 тестов
│   │   ├── test_subscription.py # 15 тестов
│   │   └── test_user.py         # 10 тестов
│   ├── application/             # Тесты use cases
│   │   ├── test_catalog_use_cases.py  # 11 тестов
│   │   └── test_order_use_cases.py    # 7 тестов
│   └── api/                     # Интеграционные тесты API
│       └── test_api.py          # 18 тестов (health, auth, catalog, orders, subscriptions, projects, calculator, contacts)
│
├── Dockerfile                   # python:3.12-slim → uvicorn :8080
├── requirements.txt             # Зависимости
├── .env.example                 # Шаблон переменных окружения
├── alembic.ini                  # Конфигурация Alembic
├── CONVENTIONS.md               # Гайд по стилю кода (DDD)
└── README.md                    ← вы здесь
```

### Bounded Contexts (ограниченные контексты)

| Домен | Aggregate Root | Entities | Value Objects |
|-------|---------------|----------|--------------|
| **Catalog** | Design | Category, DesignReview | PanelSize, Color, Price |
| **Order** | Order | OrderItem | Address, OrderStatus, Money |
| **Subscription** | Subscription | SubscriptionPlan | SubscriptionTier, BillingPeriod |
| **User** | User | UserAddress | Email, Password |

### Потоки данных (слои)

```
HTTP Request
    ↓
[Infrastructure: API Router] — валидация (Pydantic), сериализация
    ↓
[Application: Use Case] — координация, бизнес-операции
    ↓
[Domain: Entity + Service] — бизнес-правила, инварианты
    ↓
[Infrastructure: Repository] — персистентность (in-memory / SQL)
    ↓
HTTP Response
```

## API Endpoints

25 эндпоинтов (24 бизнес-маршрута + health check). Все под префиксом `/api`.

### Auth (`/api/auth`)
| Метод | Путь | Описание | Auth |
|-------|------|---------|------|
| POST | `/api/auth/register` | Регистрация → JWT | — |
| POST | `/api/auth/login` | Авторизация → JWT | — |
| GET | `/api/auth/me` | Текущий пользователь | Bearer |
| PATCH | `/api/auth/me` | Обновление профиля | Bearer |

### Catalog (`/api`)
| Метод | Путь | Описание | Auth |
|-------|------|---------|------|
| GET | `/api/designs` | Список дизайнов (фильтры, пагинация, сортировка) | — |
| GET | `/api/designs/{id}` | Детали дизайна | — |
| GET | `/api/categories` | Список категорий | — |
| GET | `/api/designs/{id}/reviews` | Отзывы к дизайну (пагинация) | — |
| POST | `/api/designs/{id}/reviews` | Добавить отзыв | Bearer |

### Orders (`/api/orders`)
| Метод | Путь | Описание | Auth |
|-------|------|---------|------|
| POST | `/api/orders` | Создать заказ | Bearer |
| GET | `/api/orders` | Мои заказы | Bearer |
| GET | `/api/orders/{id}` | Детали заказа | Bearer |
| POST | `/api/orders/calculate` | Расчёт стоимости | — |

### Subscriptions (`/api/subscriptions`)
| Метод | Путь | Описание | Auth |
|-------|------|---------|------|
| GET | `/api/subscriptions/plans` | Доступные планы | — |
| POST | `/api/subscriptions` | Оформить подписку | Bearer |
| GET | `/api/subscriptions/status` | Статус подписки | Bearer |
| DELETE | `/api/subscriptions` | Отменить подписку | Bearer |

### Projects (`/api/projects`)
| Метод | Путь | Описание | Auth |
|-------|------|---------|------|
| POST | `/api/projects` | Сохранить проект | Bearer |
| GET | `/api/projects` | Мои проекты | Bearer |
| GET | `/api/projects/{id}` | Детали проекта | Bearer |
| PUT | `/api/projects/{id}` | Обновить проект | Bearer |
| DELETE | `/api/projects/{id}` | Удалить проект | Bearer |

### Other (`/api`)
| Метод | Путь | Описание | Auth |
|-------|------|---------|------|
| POST | `/api/contacts` | Форма обратной связи | — |
| POST | `/api/calculator` | Расчёт стоимости стены | — |
| GET | `/api/health` | Health check | — |

## Модель данных

### Доменные сущности

**Catalog**
- `Design` — id, name, slug, category_id, style, image, description, price (1 200 ₽), colors[], rating, reviews_count, is_new, is_popular
- `Category` — id, name, slug, image, count
- `DesignReview` — id, design_id, user_id, user_name, rating (1–5), text, created_at

**Order**
- `Order` — id, number, user_id, status, items[], address, total (computed), created_at
- `OrderItem` — id, design_id, design_name, design_image, size_key, color, quantity, unit_price, subtotal (computed)
- Статусы: `placed → confirmed → in_progress → delivered → installed`

**Subscription**
- `Subscription` — id, user_id, plan_id, status, overlays_used_this_month, started_at, expires_at
- `SubscriptionPlan` — Starter (4 900 ₽, 10/мес), Popular (9 900 ₽, 25/мес), Business (19 900 ₽, безлимит)

**User**
- `User` — id, email, password_hash, name, phone, addresses[], created_at
- `UserAddress` — id, label, city, street, building, apartment, postal_code, is_default

### ORM-модели (SQLAlchemy)

10 таблиц описаны в `app/infrastructure/persistence/models.py`:
`users`, `user_addresses`, `categories`, `designs`, `design_reviews`, `orders`, `order_items`, `subscriptions`, `projects`

> ORM-модели готовы, но на данном этапе используются **in-memory репозитории**. Для перехода на PostgreSQL нужно создать Alembic-миграции и реализовать SQL-репозитории.

### Seed-данные (container.py)
- 12 дизайнов с полными свойствами (названия, цвета, рейтинги)
- 6 категорий (Природа, Абстракция, Геометрия, Минимализм, Текстуры, Арт)
- 3 плана подписки (предзаполнены)

## Аутентификация

- **Механизм**: JWT (JSON Web Token), алгоритм HS256
- **Хеширование**: bcrypt (passlib)
- **Время жизни**: 24 часа (JWT_EXPIRE_MINUTES=1440)
- **Заголовок**: `Authorization: Bearer <token>`
- **Защищённые маршруты**: `/api/auth/me`, `/api/orders/*`, `/api/subscriptions/*` (кроме plans), `/api/projects/*`, `POST /api/designs/{id}/reviews`
- **Dependency**: `get_current_user_id` (обязательный), `get_optional_user_id` (опциональный)

## Тестирование

97 тестов в 7 файлах. Фреймворк: **pytest + pytest-asyncio + httpx**.

```bash
cd backend
pytest                    # Запуск всех тестов
pytest tests/domain/      # Только unit-тесты
pytest tests/api/         # Только API-тесты
pytest -v                 # Подробный вывод
```

| Слой | Файлов | Тестов | Покрытие |
|------|--------|--------|---------|
| Domain | 4 | 61 | Все сущности и value objects |
| Application | 2 | 18 | Use cases каталога и заказов |
| API | 1 | 18 | Все эндпоинты (health, auth, catalog, orders, subscriptions, projects, calculator, contacts) |

## Переменные окружения (.env)

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/wow_wall
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production    # ОБЯЗАТЕЛЬНО сменить!
JWT_EXPIRE_MINUTES=1440               # 24 часа
CORS_ORIGINS=http://localhost:3000    # Через запятую для нескольких
```

## Docker

**Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Docker Compose** (`docker-compose.yml` в корне проекта):
- **backend** — FastAPI на порту 8080
- **db** — PostgreSQL 16-alpine на порту 5432 (healthcheck, volume pgdata)
- **redis** — Redis 7-alpine на порту 6379
