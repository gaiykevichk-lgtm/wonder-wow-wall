# Backend — Конвенции кода

> Конвенции для будущей реализации бэкенда на FastAPI + SQLAlchemy.

## Структура проекта

```
backend/
├── app/
│   ├── main.py              # FastAPI app, middleware, роутеры
│   ├── config.py            # Settings (Pydantic BaseSettings, .env)
│   ├── database.py          # async engine, sessionmaker, Base
│   ├── models/              # SQLAlchemy ORM-модели
│   ├── schemas/             # Pydantic v2 схемы (request/response)
│   ├── api/                 # Роутеры (APIRouter)
│   ├── services/            # Бизнес-логика
│   └── utils/               # Утилиты (security, dependencies)
├── alembic/                 # Миграции
├── tests/                   # Тесты (pytest)
└── requirements.txt
```

## Именование

| Что | Конвенция | Пример |
|-----|----------|--------|
| Файлы | snake_case.py | `subscription_service.py` |
| Классы | PascalCase | `DesignOverlay`, `OrderCreate` |
| Функции | snake_case | `get_current_user`, `calculate_price` |
| Переменные | snake_case | `panel_size`, `overlay_price` |
| Константы | UPPER_SNAKE | `DESIGN_OVERLAY_PRICE`, `JWT_EXPIRE` |
| Таблицы БД | snake_case, мн. число | `designs`, `order_items`, `subscription_plans` |
| Enum | PascalCase | `OrderStatus`, `SubscriptionTier` |
| Роутеры | `/api/{resource}` | `/api/designs`, `/api/orders` |

## FastAPI

### Роутеры
```python
# api/designs.py
from fastapi import APIRouter, Depends, Query
from app.schemas.design import DesignResponse, DesignListResponse
from app.services.design_service import DesignService

router = APIRouter(prefix="/api/designs", tags=["designs"])

@router.get("", response_model=DesignListResponse)
async def list_designs(
    category: str | None = None,
    search: str | None = None,
    sort: str = "popular",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    service: DesignService = Depends(),
):
    return await service.list(category=category, search=search, sort=sort, page=page, limit=limit)
```

### Подключение роутеров
```python
# main.py
app = FastAPI(title="Wonder Wow Wall API", version="1.0.0")
app.include_router(auth_router)
app.include_router(designs_router)
app.include_router(orders_router)
app.include_router(subscriptions_router)
app.include_router(projects_router)
```

### CORS
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
```

## SQLAlchemy

### Модели
```python
# models/design.py
from sqlalchemy import String, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Design(Base):
    __tablename__ = "designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    price: Mapped[int] = mapped_column(Integer, default=1200)  # единая цена
    image_url: Mapped[str] = mapped_column(String(500))
    specs: Mapped[dict] = mapped_column(JSON, default={})
    rating: Mapped[float] = mapped_column(Float, default=0.0)

    category: Mapped["Category"] = relationship(back_populates="designs")
    colors: Mapped[list["DesignColor"]] = relationship(back_populates="design")
```

### Async сессии
```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(settings.DATABASE_URL)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

## Pydantic Schemas

```python
# schemas/design.py
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

class DesignListResponse(BaseModel):
    items: list[DesignResponse]
    total: int
    page: int
    pages: int
```

### Правила для схем
- `*Create` — для POST-запросов (без id)
- `*Update` — для PUT/PATCH (все поля Optional)
- `*Response` — для ответов (с id, computed fields)
- `*ListResponse` — для пагинированных списков

## Аутентификация

```python
# utils/security.py
from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"])

def create_access_token(user_id: int) -> str:
    ...

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# utils/dependencies.py
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    ...
```

### Защищённые endpoints
```python
@router.get("/me")
async def get_profile(user: User = Depends(get_current_user)):
    return user
```

## Бизнес-логика (Services)

```python
# services/pricing_service.py
class PricingService:
    BASE_PRICES = {
        "300x300": 890,
        "300x600": 1490,
        "600x600": 2490,
    }
    OVERLAY_PRICE = 1200

    def calculate_panel_cost(self, size_key: str, has_subscription: bool) -> int:
        base = self.BASE_PRICES[size_key]
        overlay = 0 if has_subscription else self.OVERLAY_PRICE
        return base + overlay

    def calculate_wall_cost(self, panels: list[dict], has_subscription: bool) -> dict:
        total_base = sum(self.BASE_PRICES[p["size"]] for p in panels)
        total_overlay = 0 if has_subscription else len(panels) * self.OVERLAY_PRICE
        return {
            "panel_count": len(panels),
            "total_base": total_base,
            "total_overlay": total_overlay,
            "total": total_base + total_overlay,
        }
```

## Тестирование

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

# tests/test_designs.py
@pytest.mark.anyio
async def test_list_designs(client: AsyncClient):
    response = await client.get("/api/designs")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
```

### Правила тестирования
- Тесты — рядом с тестируемым кодом в `tests/`
- `pytest` + `pytest-anyio` для async
- Тестовая БД: SQLite in-memory или отдельная PostgreSQL
- Fixtures для авторизованного клиента, тестовых данных
- Покрытие: минимум 80% для services, 100% для API endpoints

## Обработка ошибок

```python
from fastapi import HTTPException

# В сервисах — raise HTTPException
raise HTTPException(status_code=404, detail="Design not found")
raise HTTPException(status_code=400, detail="Insufficient overlays in subscription")
raise HTTPException(status_code=401, detail="Invalid credentials")
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

# В сервисах
logger.info(f"Order #{order.id} created for user #{user.id}")
logger.warning(f"Subscription overlay limit reached for user #{user.id}")
```

- Уровни: `DEBUG` (dev), `INFO` (prod)
- Без print() — только через `logging`
