# Wonder Wow Wall — Backend

REST API для B2C интернет-магазина модульных стеновых панелей.

> **Статус**: планируется (Фаза 8 по плану разработки). Фронтенд работает на моковых данных.

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

## Планируемая структура

```
backend/
├── app/
│   ├── main.py                  # FastAPI приложение, middleware, CORS
│   ├── config.py                # Настройки (Pydantic BaseSettings)
│   ├── database.py              # Подключение к БД, AsyncSession
│   │
│   ├── models/                  # SQLAlchemy модели
│   │   ├── user.py              # User, Address
│   │   ├── design.py            # Design, Category, Color, DesignReview
│   │   ├── panel.py             # PanelSize, BasePanelPrice
│   │   ├── order.py             # Order, OrderItem
│   │   ├── subscription.py      # Subscription, SubscriptionPlan
│   │   └── project.py           # ConstructorProject (сохранённые проекты)
│   │
│   ├── schemas/                 # Pydantic схемы (request/response)
│   │   ├── user.py
│   │   ├── design.py
│   │   ├── order.py
│   │   ├── subscription.py
│   │   └── project.py
│   │
│   ├── api/                     # Роутеры (endpoints)
│   │   ├── auth.py              # POST /register, /login, /forgot-password
│   │   ├── designs.py           # GET /designs, /designs/:id, /categories
│   │   ├── orders.py            # POST /orders, GET /orders, /orders/:id
│   │   ├── subscriptions.py     # POST /subscribe, DELETE /cancel, GET /status
│   │   ├── projects.py          # CRUD конструктор-проектов
│   │   ├── users.py             # GET/PUT /me, favorites
│   │   └── contacts.py          # POST /contacts (форма обратной связи)
│   │
│   ├── services/                # Бизнес-логика
│   │   ├── auth_service.py
│   │   ├── order_service.py
│   │   ├── subscription_service.py
│   │   └── pricing_service.py   # Расчёт стоимости (панель + накладка ± подписка)
│   │
│   └── utils/
│       ├── security.py          # JWT, хеширование паролей
│       └── dependencies.py      # get_current_user, get_db
│
├── alembic/                     # Миграции
├── tests/                       # Тесты
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_designs.py
│   ├── test_orders.py
│   └── test_subscriptions.py
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── alembic.ini
├── CONVENTIONS.md
└── README.md                    ← вы здесь
```

## API Endpoints (план)

### Auth
| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Авторизация → JWT |
| POST | `/api/auth/forgot-password` | Восстановление пароля |
| GET | `/api/auth/me` | Текущий пользователь |

### Designs (каталог)
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

## Модель данных (ключевые сущности)

### DesignOverlay
- `id`, `name`, `category_id`, `style`, `image_url`, `description`
- `price` = 1 200 ₽ (единая цена для всех дизайнов)
- `colors[]`, `specs{}`, `rating`, `reviews_count`

### PanelSize
- `id`, `width_mm`, `height_mm`, `label`
- 3 размера: 300×300, 300×600, 600×600

### BasePanelPrice
- `panel_size_id`, `price`
- 890 / 1490 / 2490 ₽

### SubscriptionPlan
- `id`, `name`, `price`, `period`, `overlays_per_month`, `features[]`

### Order
- `id`, `user_id`, `status`, `total`, `items[]`, `created_at`
- Статусы: pending → confirmed → in_progress → installed → completed

## Переменные окружения (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/wow_wall
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000
```
