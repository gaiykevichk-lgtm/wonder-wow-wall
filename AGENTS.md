# Wonder Wow Wall

> B2C веб-приложение — интернет-магазин модульных стеновых панелей с конструктором и подпиской.

## Быстрый старт

```bash
# Frontend
cd frontend
npm install
npm run dev -- --host 0.0.0.0    # → http://localhost:3000

# Backend (планируется)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload     # → http://localhost:8080
```

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 8 |
| UI | Ant Design 6 + Framer Motion 12 |
| State | Zustand 5 (cart, subscription) |
| Routing | React Router 7 (11 маршрутов, lazy-loading) |
| Data Fetching | TanStack Query 5 (подготовлено для API) |
| Backend | FastAPI + SQLAlchemy + PostgreSQL (планируется) |
| Deploy | Docker + Nginx |

## Структура проекта

```
wonder-wow-wall/
├── AGENTS.md                    ← вы здесь
├── docs/
│   ├── REQUIREMENTS.md          # Полные требования к продукту
│   ├── design-docs/
│   │   └── DESIGN-SYSTEM.md     # Дизайн-система: цвета, шрифты, компоненты
│   └── exec-plans/
│       ├── active/
│       │   └── PLAN-MVP.md      # 10-фазный план разработки
│       └── completed/           # Завершённые планы
├── frontend/                    # React SPA
│   ├── README.md                # Документация фронтенда
│   ├── CONVENTIONS.md           # Конвенции кода фронтенда
│   └── src/
│       ├── pages/               # 11 страниц (lazy-loaded)
│       ├── shared/
│       │   ├── ui/              # Layout, Header, Footer, Cart, SubscriptionModal
│       │   ├── store/           # Zustand: cartStore, subscriptionStore
│       │   ├── data/            # Моковые данные (products, categories)
│       │   ├── types/           # TypeScript интерфейсы
│       │   ├── router.tsx       # Маршрутизация
│       │   └── theme.ts        # Ant Design тема
│       └── index.css            # Глобальные стили
└── backend/                     # FastAPI (планируется)
    ├── README.md
    └── CONVENTIONS.md
```

## Бизнес-модель

- **Базовые панели** (3 размера: 30×30, 30×60, 60×60 см) — крепятся на стену один раз
- **Накладки с дизайном** — магнитное крепление, единая цена 1 200 ₽ за любой дизайн
- **Подписка** — ежемесячное обновление накладок (3 плана: 4 900 / 9 900 / 19 900 ₽)

## Ключевые фичи (реализовано)

- [x] Каталог дизайнов с фильтрами и поиском
- [x] Страница товара с галереей, характеристиками
- [x] Конструктор стен — snap-to-grid, drag & drop, визуализация
- [x] Корзина (Drawer) + Checkout (3 шага)
- [x] Подписка — выбор плана, оформление, статус в хедере, скидки в конструкторе
- [x] Тарифы — покупка vs подписка, прозрачное ценообразование
- [x] Информационные страницы (О нас, FAQ, Портфолио, Контакты)

## Дальнейшая документация

- Требования: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Дизайн-система: [`docs/design-docs/DESIGN-SYSTEM.md`](docs/design-docs/DESIGN-SYSTEM.md)
- План разработки: [`docs/exec-plans/active/PLAN-MVP.md`](docs/exec-plans/active/PLAN-MVP.md)
- Frontend: [`frontend/README.md`](frontend/README.md)
- Backend: [`backend/README.md`](backend/README.md)
