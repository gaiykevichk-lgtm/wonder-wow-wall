# Wonder Wow Wall — Документация

## Навигация

| Документ | Описание |
|----------|----------|
| [BRIEF.md](./BRIEF.md) | Краткий обзор проекта, цель, бизнес-модель |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура, стек, структура проекта |
| [RUN.md](./RUN.md) | Команды запуска, сборки, тестов |
| [CONFIG.md](./CONFIG.md) | Переменные окружения (без секретных значений) |
| [STATUS.md](./STATUS.md) | Текущий статус, что реализовано, следующие шаги |

## Быстрый старт

```bash
# Frontend (dev)
cd frontend
npm install
npm run dev -- --host 0.0.0.0

# Backend (dev)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

# Docker (production-ready)
cd /home/user/wonder-wow-wall
docker compose up -d
```

## Ссылки

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api
- **Swagger**: http://localhost:8080/docs
- **Production**: ssh://root@72.56.37.191

## Основные ресурсы

| Ресурс | Путь |
|--------|------|
| Требования | `docs/REQUIREMENTS.md` |
| Дизайн-система | `docs/design-docs/DESIGN-SYSTEM.md` |
| Архитектура визуализатора | `docs/design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md` |
| План разработки | `docs/exec-plans/active/PLAN-MVP.md` |
| Frontend README | `frontend/README.md` |
| Backend README | `backend/README.md` |
| Конвенции кода | `frontend/CONVENTIONS.md`, `backend/CONVENTIONS.md` |
