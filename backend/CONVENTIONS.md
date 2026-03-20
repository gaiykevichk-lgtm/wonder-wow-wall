# Backend — Конвенции кода (DDD)

> Конвенции для реализации бэкенда на FastAPI + SQLAlchemy с архитектурой Domain-Driven Design.

## Архитектура: Domain-Driven Design

### Слои и их ответственность

```
backend/
├── app/
│   ├── main.py              # FastAPI app, middleware, CORS
│   ├── config.py            # Settings (Pydantic BaseSettings, .env)
│   │
│   ├── domain/              # Domain Layer — чистая бизнес-логика
│   │   ├── catalog/         # Bounded Context: Каталог
│   │   ├── order/           # Bounded Context: Заказы
│   │   ├── subscription/    # Bounded Context: Подписки
│   │   └── user/            # Bounded Context: Пользователи
│   │
│   ├── application/         # Application Layer — use cases
│   │   ├── catalog/
│   │   ├── order/
│   │   ├── subscription/
│   │   └── user/
│   │
│   ├── infrastructure/      # Infrastructure Layer — реализации
│   │   ├── persistence/     # БД: SQLAlchemy, репозитории
│   │   ├── api/             # FastAPI роутеры (адаптеры)
│   │   └── security/        # JWT, хеширование
│   │
│   └── utils/               # Утилиты (dependencies)
├── alembic/                 # Миграции
├── tests/                   # Тесты по bounded contexts
│   ├── domain/              # Unit-тесты доменного слоя
│   ├── application/         # Тесты use cases
│   └── api/                 # Интеграционные тесты API
└── requirements.txt
```

### Правило зависимостей (Dependency Rule)

```
domain ← application ← infrastructure
```

- **Domain Layer** не импортирует ничего из application или infrastructure
- **Application Layer** импортирует только из domain
- **Infrastructure Layer** импортирует из domain и application
- Зависимости всегда направлены **внутрь** (к домену)

## Domain Layer (`app/domain/`)

### Структура Bounded Context

```
domain/{context}/
├── entities.py          # Сущности и агрегаты
├── value_objects.py     # Value Objects (неизменяемые объекты-значения)
├── repositories.py      # Абстрактные интерфейсы репозиториев (ABC)
└── services.py          # Доменные сервисы
```

### Entities (сущности)

```python
# domain/order/entities.py
from dataclasses import dataclass, field
from datetime import datetime
from .value_objects import OrderStatus, Money, Address

@dataclass
class OrderItem:
    """Сущность — элемент заказа."""
    design_id: int
    panel_size: str
    quantity: int
    unit_price: Money

    @property
    def total(self) -> Money:
        return self.unit_price * self.quantity

@dataclass
class Order:
    """Aggregate Root — Заказ."""
    id: int | None = None
    user_id: int = 0
    status: OrderStatus = OrderStatus.PENDING
    items: list[OrderItem] = field(default_factory=list)
    address: Address | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def total(self) -> Money:
        return sum((item.total for item in self.items), Money(0))

    def confirm(self) -> None:
        """Бизнес-правило: подтвердить заказ."""
        if self.status != OrderStatus.PENDING:
            raise ValueError("Заказ можно подтвердить только из статуса PENDING")
        self.status = OrderStatus.CONFIRMED

    def add_item(self, item: OrderItem) -> None:
        """Бизнес-правило: добавить товар в заказ."""
        self.items.append(item)
```

**Правила для Entities:**
- Используют `@dataclass` (не Pydantic, не SQLAlchemy)
- Содержат бизнес-логику в методах
- Не зависят от фреймворков и инфраструктуры
- Aggregate Root — единственная точка доступа к агрегату

### Value Objects (объекты-значения)

```python
# domain/order/value_objects.py
from dataclasses import dataclass
from enum import Enum

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    INSTALLED = "installed"
    COMPLETED = "completed"

@dataclass(frozen=True)
class Money:
    """Value Object — денежная сумма в рублях."""
    amount: int

    def __add__(self, other: 'Money') -> 'Money':
        return Money(self.amount + other.amount)

    def __mul__(self, multiplier: int) -> 'Money':
        return Money(self.amount * multiplier)

@dataclass(frozen=True)
class Address:
    """Value Object — адрес доставки."""
    city: str
    street: str
    building: str
    apartment: str | None = None
```

**Правила для Value Objects:**
- Используют `@dataclass(frozen=True)` — неизменяемые
- Сравниваются по значению (не по identity)
- Не имеют id
- Чистые данные + валидация

### Abstract Repositories (интерфейсы репозиториев)

```python
# domain/catalog/repositories.py
from abc import ABC, abstractmethod
from .entities import Design, Category

class DesignRepository(ABC):
    """Абстрактный интерфейс репозитория дизайнов."""

    @abstractmethod
    async def get_by_id(self, design_id: int) -> Design | None:
        ...

    @abstractmethod
    async def list(
        self,
        category: str | None = None,
        search: str | None = None,
        sort: str = "popular",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Design], int]:
        ...

    @abstractmethod
    async def save(self, design: Design) -> Design:
        ...
```

**Правила для Repositories:**
- Только абстрактные классы (ABC) в domain layer
- Оперируют доменными сущностями (не ORM-моделями)
- Реализации — в infrastructure layer

### Domain Services (доменные сервисы)

```python
# domain/order/services.py
from .value_objects import Money

class PricingService:
    """Доменный сервис — расчёт стоимости."""

    BASE_PRICES = {
        "300x300": Money(890),
        "300x600": Money(1490),
        "600x600": Money(2490),
    }
    OVERLAY_PRICE = Money(1200)

    def calculate_panel_cost(self, size_key: str, has_subscription: bool) -> Money:
        base = self.BASE_PRICES[size_key]
        overlay = Money(0) if has_subscription else self.OVERLAY_PRICE
        return base + overlay

    def calculate_wall_cost(self, panels: list[dict], has_subscription: bool) -> dict:
        total_base = sum(
            (self.BASE_PRICES[p["size"]].amount for p in panels), 0
        )
        total_overlay = 0 if has_subscription else len(panels) * self.OVERLAY_PRICE.amount
        return {
            "panel_count": len(panels),
            "total_base": total_base,
            "total_overlay": total_overlay,
            "total": total_base + total_overlay,
        }
```

**Правила для Domain Services:**
- Логика, которая не принадлежит одной сущности
- Без зависимостей от инфраструктуры
- Stateless (без состояния)

## Application Layer (`app/application/`)

### Use Cases

```python
# application/order/use_cases.py
from app.domain.order.entities import Order, OrderItem
from app.domain.order.repositories import OrderRepository
from app.domain.order.services import PricingService
from app.domain.subscription.repositories import SubscriptionRepository

class CreateOrder:
    """Use Case — создание заказа."""

    def __init__(
        self,
        order_repo: OrderRepository,
        subscription_repo: SubscriptionRepository,
        pricing_service: PricingService,
    ):
        self.order_repo = order_repo
        self.subscription_repo = subscription_repo
        self.pricing = pricing_service

    async def execute(self, user_id: int, items: list[dict]) -> Order:
        subscription = await self.subscription_repo.get_active(user_id)
        has_subscription = subscription is not None

        order = Order(user_id=user_id)
        for item_data in items:
            cost = self.pricing.calculate_panel_cost(
                item_data["size"], has_subscription
            )
            order.add_item(OrderItem(
                design_id=item_data["design_id"],
                panel_size=item_data["size"],
                quantity=item_data["quantity"],
                unit_price=cost,
            ))

        return await self.order_repo.save(order)
```

**Правила для Use Cases:**
- Один класс = один use case
- Метод `execute()` — точка входа
- Координируют домен (entities, services, repositories)
- Управляют транзакциями
- Не содержат бизнес-логику (делегируют домену)
- Импортируют только из domain layer

## Infrastructure Layer (`app/infrastructure/`)

### Persistence — ORM-модели

```python
# infrastructure/persistence/models.py
from sqlalchemy import String, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class DesignModel(Base):
    """ORM-модель (маппинг на доменную сущность Design)."""
    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    price: Mapped[int] = mapped_column(Integer, default=1200)
    image_url: Mapped[str] = mapped_column(String(500))
    specs: Mapped[dict] = mapped_column(JSON, default={})
    rating: Mapped[float] = mapped_column(Float, default=0.0)

    category: Mapped["CategoryModel"] = relationship(back_populates="designs")
```

**Правила:**
- ORM-модели — это **не** доменные сущности
- Суффикс `Model` для ORM: `DesignModel`, `OrderModel`
- Маппинг ORM ↔ Domain в репозиториях

### Persistence — реализации репозиториев

```python
# infrastructure/persistence/repositories/catalog_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from app.domain.catalog.entities import Design
from app.domain.catalog.repositories import DesignRepository
from ..models import DesignModel

class SqlAlchemyDesignRepository(DesignRepository):
    """Реализация репозитория дизайнов на SQLAlchemy."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, design_id: int) -> Design | None:
        model = await self.session.get(DesignModel, design_id)
        return self._to_entity(model) if model else None

    def _to_entity(self, model: DesignModel) -> Design:
        """Маппинг ORM → Domain Entity."""
        return Design(
            id=model.id,
            name=model.name,
            slug=model.slug,
            # ...
        )

    def _to_model(self, entity: Design) -> DesignModel:
        """Маппинг Domain Entity → ORM."""
        return DesignModel(
            id=entity.id,
            name=entity.name,
            # ...
        )
```

### API — FastAPI роутеры (адаптеры)

```python
# infrastructure/api/catalog.py
from fastapi import APIRouter, Depends, Query
from app.application.catalog.use_cases import ListDesigns, GetDesignDetails
from app.utils.dependencies import get_list_designs_use_case

router = APIRouter(prefix="/api/designs", tags=["catalog"])

@router.get("")
async def list_designs(
    category: str | None = None,
    search: str | None = None,
    sort: str = "popular",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    use_case: ListDesigns = Depends(get_list_designs_use_case),
):
    return await use_case.execute(
        category=category, search=search, sort=sort, page=page, limit=limit
    )
```

**Правила для API роутеров:**
- Роутеры — это адаптеры, не содержат бизнес-логику
- Делегируют работу use cases
- Валидация входных данных через Pydantic
- Сериализация ответов через Pydantic

### Async сессии

```python
# infrastructure/persistence/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(settings.DATABASE_URL)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

### Dependency Injection

```python
# utils/dependencies.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.catalog_repo import SqlAlchemyDesignRepository
from app.application.catalog.use_cases import ListDesigns

async def get_list_designs_use_case(
    db: AsyncSession = Depends(get_db),
) -> ListDesigns:
    repo = SqlAlchemyDesignRepository(db)
    return ListDesigns(design_repo=repo)
```

## Именование

| Что | Конвенция | Пример |
|-----|----------|--------|
| Файлы | snake_case.py | `value_objects.py`, `use_cases.py` |
| Доменные сущности | PascalCase | `Design`, `Order`, `Subscription` |
| Value Objects | PascalCase | `Money`, `Address`, `OrderStatus` |
| ORM-модели | PascalCase + Model | `DesignModel`, `OrderModel` |
| Use Cases | PascalCase (глагол + существительное) | `CreateOrder`, `ListDesigns` |
| Репозитории (ABC) | PascalCase + Repository | `DesignRepository`, `OrderRepository` |
| Репозитории (impl) | SqlAlchemy + PascalCase + Repository | `SqlAlchemyDesignRepository` |
| Функции | snake_case | `calculate_price`, `get_current_user` |
| Константы | UPPER_SNAKE | `DESIGN_OVERLAY_PRICE`, `JWT_EXPIRE` |
| Таблицы БД | snake_case, мн. число | `designs`, `order_items` |
| Enum | PascalCase | `OrderStatus`, `SubscriptionTier` |
| Роутеры | `/api/{resource}` | `/api/designs`, `/api/orders` |

## Pydantic Schemas (DTO)

```python
# Используются в infrastructure/api/ для валидации и сериализации
from pydantic import BaseModel

class DesignResponse(BaseModel):
    id: int
    name: str
    category: str
    price: int
    image_url: str
    colors: list[ColorSchema]
    rating: float
    reviews_count: int

    model_config = {"from_attributes": True}
```

### Правила для схем (DTO)
- `*Create` — для POST-запросов (без id)
- `*Update` — для PUT/PATCH (все поля Optional)
- `*Response` — для ответов (с id, computed fields)
- `*ListResponse` — для пагинированных списков
- Это **не** доменные объекты — это DTO для API

## Аутентификация

```python
# infrastructure/security/jwt.py
from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"])

def create_access_token(user_id: int) -> str:
    ...

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### Защищённые endpoints
```python
@router.get("/me")
async def get_profile(user: User = Depends(get_current_user)):
    return user
```

## Тестирование

### Структура тестов по DDD-слоям

```
tests/
├── domain/              # Unit-тесты доменного слоя (без БД, без HTTP)
│   ├── test_order.py    # Тесты Order entity, PricingService
│   ├── test_catalog.py
│   └── test_subscription.py
├── application/         # Тесты use cases (с моками репозиториев)
│   ├── test_create_order.py
│   └── test_list_designs.py
└── api/                 # Интеграционные тесты (FastAPI TestClient)
    ├── test_catalog_api.py
    ├── test_orders_api.py
    └── test_auth_api.py
```

### Пример unit-теста домена
```python
# tests/domain/test_order.py
from app.domain.order.entities import Order, OrderItem
from app.domain.order.value_objects import OrderStatus, Money

def test_order_total():
    order = Order(user_id=1)
    order.add_item(OrderItem(design_id=1, panel_size="300x300", quantity=2, unit_price=Money(890)))
    assert order.total == Money(1780)

def test_order_confirm():
    order = Order(user_id=1, status=OrderStatus.PENDING)
    order.confirm()
    assert order.status == OrderStatus.CONFIRMED
```

### Правила тестирования
- **Domain-тесты**: чистые unit-тесты, без моков БД — тестируют бизнес-логику
- **Application-тесты**: моки репозиториев, тестируют координацию
- **API-тесты**: интеграционные, `pytest` + `pytest-anyio` + `httpx`
- Тестовая БД: SQLite in-memory или отдельная PostgreSQL
- Покрытие: 100% для domain, 80%+ для application, 100% для API endpoints

## Обработка ошибок

### Доменные исключения
```python
# domain/catalog/exceptions.py
class DesignNotFound(Exception):
    """Дизайн не найден."""
    pass

class InsufficientOverlays(Exception):
    """Лимит накладок в подписке исчерпан."""
    pass
```

### Маппинг доменных ошибок в HTTP
```python
# infrastructure/api/error_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse
from app.domain.catalog.exceptions import DesignNotFound

async def design_not_found_handler(request: Request, exc: DesignNotFound):
    return JSONResponse(status_code=404, content={"detail": str(exc)})
```

### HTTP-коды
| Код | Когда |
|-----|-------|
| 200 | Успешный GET/PUT |
| 201 | Успешный POST (создание) |
| 204 | Успешный DELETE |
| 400 | Невалидные данные |
| 401 | Не авторизован |
| 403 | Нет прав |
| 404 | Не найдено |
| 422 | Ошибка валидации Pydantic |

## Docker

```dockerfile
# Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## Миграции (Alembic)

```bash
alembic revision --autogenerate -m "add subscriptions table"
alembic upgrade head
alembic downgrade -1
```

### Правила миграций
- Каждое изменение схемы — отдельная миграция
- Описательные имена: `add_subscriptions_table`, `add_rating_to_designs`
- Всегда проверять `downgrade()` перед commit

## Переменные окружения

Все настройки через Pydantic `BaseSettings` + `.env`:

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:3000"
    OVERLAY_PRICE: int = 1200

    model_config = {"env_file": ".env"}

settings = Settings()
```

## Логирование

```python
import logging
logger = logging.getLogger(__name__)

# В use cases
logger.info(f"Order #{order.id} created for user #{user.id}")
logger.warning(f"Subscription overlay limit reached for user #{user.id}")
```

- Уровни: `DEBUG` (dev), `INFO` (prod)
- Без print() — только через `logging`
