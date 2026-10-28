# Wonder Wow Wall — Команды запуска

## Быстрый старт

### Frontend (разработка)

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
# → http://localhost:3000
```

### Backend (разработка)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
# → http://localhost:8080
# Swagger: http://localhost:8080/docs
```

### Docker (production-ready)

```bash
cd /home/user/wonder-wow-wall
docker compose up -d
# → http://localhost (nginx reverse proxy)
```

## Полный набор команд

### Frontend

| Команда | Описание |
|---------|----------|
| `npm install` | Установить зависимости |
| `npm run dev` | Dev-сервер на :3000 |
| `npm run build` | Production-сборка в `dist/` |
| `npm run preview` | Превью сборки |
| `npm run lint` | ESLint проверка |
| `npm run test` | Запуск тестов (однократно) |
| `npm run test:watch` | Тесты в watch-режиме |
| `npx tsc --noEmit` | Проверка типов TypeScript |

### Backend

| Команда | Описание |
|---------|----------|
| `pip install -r requirements.txt` | Установить зависимости |
| `cp .env.example .env` | Создать .env из шаблона |
| `uvicorn app.main:app --reload` | Dev-сервер на :8080 |
| `pytest` | Все тесты |
| `pytest tests/domain/` | Только unit-тесты домена |
| `pytest tests/api/` | Только API-тесты |
| `pytest -v` | Подробный вывод |

### Docker

| Команда | Описание |
|---------|----------|
| `docker compose up -d` | Запустить все сервисы |
| `docker compose down` | Остановить все сервисы |
| `docker compose logs -f` | Просмотр логов |
| `docker compose restart <service>` | Перезапустить сервис |
| `docker compose exec backend pytest` | Тесты внутри контейнера |

## Сервисы

| Сервис | Порт | URL |
|--------|------|-----|
| Nginx | 80 | http://localhost |
| Frontend | 80 (internal) | — |
| Backend API | 8080 | http://localhost:8080 |
| Swagger | — | http://localhost:8080/docs |
| PostgreSQL | 5432 | postgresql://postgres:postgres@localhost:5432 |
| Redis | 6379 | redis://localhost:6379 |

## Переменные окружения

### Frontend (.env)

```env
VITE_API_URL=/api                    # По умолчанию: через Vite proxy
# или для production:
VITE_API_URL=http://localhost:8080/api
```

### Backend (.env)

```env
# Development (in-memory repos)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/wow_wall
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key-here
JWT_EXPIRE_MINUTES=1440              # 24 hours

# CORS
CORS_ORIGINS=http://localhost:3000

# Environment
ENV=development
```

### Docker Compose (.env)

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/wow_wall
REDIS_URL=redis://redis:6379
JWT_SECRET=change-me-in-production
CORS_ORIGINS=http://localhost
POSTGRES_PASSWORD=postgres
```

## Development Workflow

### 1. Начало работы

```bash
# Clone или уже есть
cd /home/user/wonder-wow-wall

# Frontend
cd frontend && npm install

# Backend
cd backend && pip install -r requirements.txt
```

### 2. Запуск dev-серверов

```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# Terminal 2: Frontend
cd frontend
npm run dev -- --host 0.0.0.0
```

### 3. Проверка

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- Swagger: http://localhost:8080/docs

### 4. Тестирование

```bash
# Frontend
cd frontend
npm run test

# Backend
cd backend
pytest -v
```

## Production Deployment

### Production Server

```
ssh://root@72.56.37.191
```

### Managed Services

| Service | ID | Connection |
|---------|-----|------------|
| PostgreSQL | 4176047 | postgresql://gen_user:***@195.133.73.104:5432/default_db |
| Redis | 4176051 | redis://:***@186.246.13.9:6379/0 |

### Deployment Flow

```bash
# Connect to server
ssh root@72.56.37.191

# Pull latest changes
cd /app/wonder-wow-wall
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

## Troubleshooting

### Port already in use

```bash
# Find process using port
lsof -i :3000  # frontend
lsof -i :8080  # backend

# Kill process
kill <PID>
```

### Clean start (fresh database)

```bash
cd backend
rm -rf .venv
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Clear caches

```bash
# Frontend
rm -rf node_modules/.vite
npm run build

# Backend
redis-cli FLUSHDB
```

## Environment Variables Summary

### Frontend

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `VITE_API_URL` | `/api` | No | API base URL (Vite proxy) |

### Backend

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | — | Yes | PostgreSQL connection string |
| `REDIS_URL` | — | No | Redis connection string |
| `JWT_SECRET` | — | Yes | JWT signing secret |
| `JWT_EXPIRE_MINUTES` | 1440 | No | Token expiration (24h) |
| `CORS_ORIGINS` | — | Yes | Allowed origins |
| `ENV` | development | No | Environment |
| `MEDIA_STORAGE_ROOT` | /var/uploads | No | Media upload path |
| `MEDIA_URL_PREFIX` | /uploads | No | Media URL prefix |

### Docker Compose

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | change-me-in-production | JWT secret |
| `CORS_ORIGINS` | http://localhost | Allowed CORS origins |
| `POSTGRES_PASSWORD` | postgres | PostgreSQL password |
