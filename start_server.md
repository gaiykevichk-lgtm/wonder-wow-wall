# Запуск серверов Wonder Wow Wall

## ⚠️ Важно: порядок запуска

Проект состоит из двух серверов: **Backend (FastAPI)** и **Frontend (React/Vite)**. Оба должны быть запущены для полноценной работы приложения.

---

## Backend — запуск через start_dev.py

### Правильный способ ( ОБЯЗАТЕЛЬНО )

```bash
cd /home/user/wonder-wow-wall/backend
USE_MEMORY_REPOS=true python3 start_dev.py
```

**Почему именно так:**
- `start_dev.py` вызывает `asyncio.run(seed_everything())` — заполняет базу данных тестовыми данными
- Без seeding: каталог текстур пуст → конфигуратор на странице товара не работает
- `USE_MEMORY_REPOS=true` — использует in-memory хранилище (не требует PostgreSQL)

### Что происходит при запуске

```
Admin seeded: admin@wow.ru / admin123
Users seeded: 6
Reviews seeded: 94
Orders seeded: 6
Subscriptions seeded: 3
Panels seeded: 3
Shop settings seeded
Banners seeded: 3
Textures seeded: 8, Colors seeded: 40          ← критично!
Variant images seeded: 1480
Recommendations seeded: 37 sources, 37 new
INFO: Uvicorn running on http://0.0.0.0:8001
```

### ❌ Неправильный способ

```bash
cd /home/user/wonder-wow-wall/backend
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

**Почему не работает:**
- `uvicorn` не вызывает `seed_everything()`
- База данных остаётся пустой
- API `/api/textures` возвращает `[]`
- API `/api/designs/{id}/full-config` возвращает `{"textures":[]}`
- Конфигуратор товара показывает упрощённый fallback (без текстур и цветов)

---

## Frontend — запуск dev-сервера

```bash
cd /home/user/wonder-wow-wall/frontend
npm run dev -- --host 0.0.0.0 --port 3000
```

Или с использованием Vite напрямую:

```bash
cd /home/user/wonder-wow-wall/frontend
npx vite --host 0.0.0.0 --port 3000
```

---

## Проверка работоспособности

### Backend API

```bash
# Проверка текстур
curl http://localhost:8001/api/textures
# Должно вернуть: [{"id":"tex-leather","name":"Кожа",...}, ...] (8 текстур)

# Проверка конфигурации товара
curl http://localhost:8001/api/designs/wav-s-10/full-config
# Должно вернуть: {"textures":[...8 items...],"variant_images":[...40 items...]}
```

### Frontend

Откройте в браузере:
- http://localhost:3000 — главная страница
- http://localhost:3000/catalog — каталог форм
- http://localhost:3000/product/wav-s-10 — страница товара "Волна" (должен работать конфигуратор)

---

## Команды для управления серверами

### Проверка занятых портов

```bash
promto-port owner 8001   # backend
promto-port owner 3000   # frontend
```

### Остановка серверов

```bash
promto-port kill 8001   # остановить backend
promto-port kill 3000   # остановить frontend
```

### Перезапуск

```bash
# Остановить
promto-port kill 8001
promto-port kill 3000

# Запустить заново
cd /home/user/wonder-wow-wall/backend && USE_MEMORY_REPOS=true python3 start_dev.py &
cd /home/user/wonder-wow-wall/frontend && npm run dev -- --host 0.0.0.0 --port 3000 &
```

---

## Решение проблем

### Текстуры не загружаются на странице товара

1. Проверьте, что backend запущен через `start_dev.py`
2. Перезапустите backend: `promto-port kill 8001 && cd backend && USE_MEMORY_REPOS=true python3 start_dev.py`
3. Проверьте API: `curl http://localhost:8001/api/textures`

### Ошибка "port already in use"

```bash
promto-port kill <PORT>  # например: promto-port kill 8001
```

### Frontend не подключается к backend

Backend работает на порту 8001. Frontend настроен на проксирование запросов к `/api/*` на `http://localhost:8001`. Если frontend запущен, а backend — нет, страницы с API-данными не загрузятся.

---

## Быстрый старт (всё с нуля)

```bash
# 1. Остановить все серверы
promto-port kill 8001
promto-port kill 3000

# 2. Запустить backend (с seeding)
cd /home/user/wonder-wow-wall/backend
USE_MEMORY_REPOS=true python3 start_dev.py &

# 3. Запустить frontend
cd /home/user/wonder-wow-wall/frontend
npm run dev -- --host 0.0.0.0 --port 3000 &

# 4. Проверить
sleep 3
curl http://localhost:8001/api/textures | head -100
```

---

## Справка по аккаунтам

После seeding доступны тестовые аккаунты:

| Email | Пароль | Роль |
|-------|--------|------|
| admin@wow.ru | admin123 | Администратор |
| ivan@example.com | password123 | Покупатель |
| anna@example.com | password123 | Покупатель |