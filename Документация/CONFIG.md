# Wonder Wow Wall — Переменные окружения

## Безопасность

> ⚠️ **ВАЖНО**: Никогда не выводите реальные значения секретных переменных в логах или публичных местах.

Для диагностики показывайте: **наличие переменной**, **имя**, **безопасную метрику** (например, "значение установлено, 32 символа").

## Frontend (.env)

### Файл: `frontend/.env`

| Переменная | Значение по умолчанию | Обязательная | Описание |
|------------|----------------------|--------------|----------|
| `VITE_API_URL` | `/api` | Нет | Базовый URL API. По умолчанию используется Vite proxy → `http://localhost:8080/api` |

**Пример:**
```env
VITE_API_URL=/api                    # Development (Vite proxy)
# VITE_API_URL=https://api.wonderwowwall.com   # Production
```

## Backend (.env)

### Файл: `backend/.env`

| Переменная | Значение по умолчанию | Обязательная | Описание |
|------------|----------------------|--------------|----------|
| `DATABASE_URL` | — | Да | PostgreSQL connection string |
| `REDIS_URL` | — | Нет | Redis connection string (для кеширования) |
| `JWT_SECRET` | — | Да | Секрет для подписи JWT токенов |
| `JWT_EXPIRE_MINUTES` | 1440 | Нет | Время жизни токена (1440 = 24 часа) |
| `CORS_ORIGINS` | — | Да | Разрешённые origins для CORS (через запятую) |
| `ENV` | development | Нет | Окружение: development/production |
| `MEDIA_STORAGE_ROOT` | /var/uploads | Нет | Директория для загруженных файлов |
| `MEDIA_URL_PREFIX` | /uploads | Нет | Префикс URL для медиафайлов |

**Пример:**
```env
# Development
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/wow_wall
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000
ENV=development

# Production
# DATABASE_URL=postgresql+asyncpg://user:password@host:5432/wow_wall
# REDIS_URL=redis://host:6379
# JWT_SECRET=<strong-random-secret>
# CORS_ORIGINS=https://wonderwowwall.com
# ENV=production
```

## Docker Compose (.env)

### Файл: корневой `.env` (или системный environment)

| Переменная | Значение по умолчанию | Обязательная | Описание |
|------------|----------------------|--------------|----------|
| `DATABASE_URL` | — | Да | PostgreSQL connection string для контейнера backend |
| `REDIS_URL` | — | Да | Redis connection string для контейнера backend |
| `JWT_SECRET` | — | Да | Секрет JWT |
| `CORS_ORIGINS` | http://localhost | Да | Origins для CORS |
| `POSTGRES_PASSWORD` | postgres | Да | Пароль PostgreSQL |
| `ENV` | development | Нет | Окружение |

**Пример:**
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/wow_wall
REDIS_URL=redis://redis:6379
JWT_SECRET=change-me-in-production
CORS_ORIGINS=http://localhost
POSTGRES_PASSWORD=postgres
ENV=development
```

## Managed Services (Production)

### PostgreSQL

| Параметр | Значение |
|----------|----------|
| Host | 195.133.73.104 |
| Port | 5432 |
| Database | default_db |
| User | gen_user |
| Env Var | `DATABASE_URL` |

### Redis

| Параметр | Значение |
|----------|----------|
| Host | 186.246.13.9 |
| Port | 6379 |
| Database | 0 |
| Env Var | `REDIS_URL` |

## Структура DATABASE_URL

```
postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
```

**Примеры:**
```env
# Local development
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/wow_wall

# Docker (container-to-container)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/wow_wall

# Production managed
DATABASE_URL=postgresql+asyncpg://gen_user:<password>@195.133.73.104:5432/default_db
```

## Структура REDIS_URL

```
redis://[<user>:<password>@]<host>:<port>/<db>
```

**Примеры:**
```env
# Local development
REDIS_URL=redis://localhost:6379

# Docker
REDIS_URL=redis://redis:6379

# Production managed
REDIS_URL=redis://:n%40!fOXG%7CP*lQ9@186.246.13.9:6379/0
```

## JWT_TOKEN структура

### Payload (claims)

```json
{
  "sub": "<user_id>",
  "email": "<user_email>",
  "exp": "<expiration_timestamp>",
  "iat": "<issued_at_timestamp>"
}
```

### Заголовок запроса

```
Authorization: Bearer <jwt_token>
```

## Конфигурация приложения

### Frontend API Client (`frontend/src/shared/api/client.ts`)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

- Development: `/api` → Vite proxy → `http://localhost:8080/api`
- Production: может быть переопределён на реальный API URL

### Backend Config (`backend/app/config.py`)

```python
class Settings(BaseSettings):
    database_url: str
    redis_url: str | None = None
    jwt_secret: str
    jwt_expire_minutes: int = 1440
    cors_origins: list[str]
    env: str = "development"
    media_storage_root: str = "/var/uploads"
    media_url_prefix: str = "/uploads"
```

## Безопасная диагностика

### Проверка наличия переменных

```bash
# Frontend
grep -E "^VITE_" frontend/.env

# Backend
grep -E "^(DATABASE_URL|REDIS_URL|JWT_SECRET)" backend/.env
```

### Проверка формата (без значений)

```bash
# PostgreSQL
echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/g'

# Redis  
echo $REDIS_URL | sed 's/:[^:@]*@/:***@/g'

# JWT
echo $JWT_SECRET | wc -c  # Только длина
```

## Переменные без секретных значений

Эти переменные **безопасны** для публичного отображения:

| Переменная | Безопасные значения |
|------------|---------------------|
| `VITE_API_URL` | `/api` |
| `JWT_EXPIRE_MINUTES` | `1440` |
| `ENV` | `development`, `production` |
| `MEDIA_URL_PREFIX` | `/uploads` |
| `CORS_ORIGINS` | `http://localhost` (dev) |
