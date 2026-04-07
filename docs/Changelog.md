# Changelog — Wonder Wow Wall

История создания и доработки продукта.
Записи ведутся в обратном хронологическом порядке (новое сверху).

> Источник задач: [PLAN-REMEDIATION.md](exec-plans/active/PLAN-REMEDIATION.md)

---

## 07.04.2026 — Фаза 12: Подписочная модель по площади

Подписочная модель приведена в соответствие с ТЗ: лимит теперь считается по площади (м²/мес), а не по количеству накладок.

**Тарифы (по ТЗ):**
- Стартовый: 15 м² — 7 000 ₽/мес
- Популярный: 30 м² — 12 000 ₽/мес
- Бизнес: безлимитная площадь — 18 000 ₽/мес

**Что изменилось:**
- Backend: доменная сущность `SubscriptionPlan.area_limit_m2`, методы `use_area()` / `remaining_area_m2`
- Backend: SQL-модель — колонка `area_used_this_month_m2` (Alembic-миграция 003)
- Backend: API-схемы обновлены (`area_limit_m2`, `remaining_area_m2`)
- Frontend: store, типы, UI-компоненты (PricingPage, SubscriptionModal, AccountSection, ConstructorPage)
- Frontend: Zustand persist migration (v2) для очистки старых localStorage-данных
- Тесты: 133 backend + 182 frontend, TypeScript 0 ошибок

---

## 07.04.2026 — Фаза 11: Мобильная адаптация

Адаптивная вёрстка для планшетов и телефонов, touch-поддержка в визуализаторе.

**Что сделано:**
- Адаптивные breakpoints (1024px / 768px / 480px) на всех ключевых страницах
- Хук `useIsMobile` для JS-определения viewport
- Визуализатор: pinch-to-zoom, touch painting (кисть/ластик), single/two-finger pan
- AccountLayout: sidebar → горизонтальные табы на мобиле
- SupportFab: плавающая кнопка поддержки (чат, email, телефон, Telegram)

---

## 07.04.2026 — Фаза 10: Инфраструктура и деплой

Docker-стек, CI/CD, SEO-оптимизация.

**Что сделано:**
- Frontend Dockerfile: multi-stage build (Node 20 → Nginx 1.27 alpine)
- Docker Compose: 5 сервисов (nginx, frontend, backend, db, redis)
- Nginx reverse proxy: `/` → frontend, `/api` → backend, gzip, кэш статики
- GitHub Actions CI: lint, typecheck, тесты, Docker build
- SEO: `react-helmet-async`, компонент `PageMeta` на 17 страницах
- Open Graph + Twitter Cards мета-теги
- Favicon и apple-touch-icon из логотипа

---

## 07.04.2026 — Фаза 9: Безопасность бэкенда

Hardening перед выходом в продакшн.

**Что сделано:**
- CORS: strict origin (конкретный домен, не `*`), explicit methods/headers
- Rate limiting (slowapi): login 5/min, register 3/min, forgot-password 3/min, глобально 60/min
- JWT_SECRET guard: запрет запуска с дефолтным секретом в `ENV=production`
- Security headers middleware: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- Тесты: brute-force → 429, CORS rejection, security headers validation, JWT guard

---

## 07.04.2026 — Фаза 8: 152-ФЗ (персональные данные)

Юридическое соответствие закону о персональных данных.

**Что сделано:**
- Checkbox «Согласен с политикой обработки ПД» на 4 формах (регистрация, заказ, контакты, подписка)
- Страница `/privacy-policy` с текстом политики по шаблону 152-ФЗ
- Ссылка на политику в футере и во всех формах
- Валидация: формы не отправляются без согласия

---

## 07.04.2026 — Фаза 7: Фото-редактор — UX-доработки

Улучшение юзабилити визуализатора без внешних зависимостей.

**Что сделано:**
- Удаление панели кликом (крестик на размещённой панели)
- Hover-подсветка ячейки при наведении в ручном режиме
- Сохранение проекта в localStorage (Zustand persist)
- Экспорт: кнопка «Скачать» → JPEG-файл
- Режим «Акцентная зона»: рисование прямоугольника → авторазмещение панелей в зоне

---

## 07.04.2026 — Фаза 6: Контентные страницы

Наполнение контент-страниц по ТЗ.

**Что сделано:**
- Главная: блок «Преимущества» (6 карточек), промо-баннер «Скидка 15%»
- Контакты: Яндекс.Карты iframe с маркером офиса (+ fallback на статичное изображение)
- Портфолио: before/after слайдер для 3 проектов
- Раздел «Как это работает»: YouTube-видео (lazy loading, 16:9)
- Блог: 5 статей, страницы `/blog` и `/blog/:slug` с lazy-loading

---

## 07.04.2026 — Фаза 5: Личный кабинет и авторизация

Расширение функционала ЛК и доработка авторизации.

**Что сделано:**
- Поиск в хедере: иконка → разворачивающийся инпут → навигация на `/catalog?search=...`
- Избранное в хедере: иконка с badge → `/account/favorites`
- Забытый пароль: ForgotPasswordPage + бэкенд-эндпоинты (`forgot-password`, `reset-password`, Redis TTL 15 мин)
- Кнопки соцсетей (Google, VK) — placeholder, disabled, tooltip «Скоро»
- Раздел «Уведомления» в ЛК (email-toggles, persist в localStorage)
- Кнопка «Повторить заказ» → копирование товаров в корзину

---

## 07.04.2026 — Фаза 4: Checkout и заказы

Недостающие функции для оформления заказа.

**Что сделано:**
- Выбор даты/времени монтажа: DatePicker + TimePicker (будущие даты, рабочие часы 9:00–20:00, шаг 30 мин)
- СБП (Система Быстрых Платежей) — 4-й способ оплаты
- Кнопки «Примерить на фото» и «Примерить в конструкторе» на ProductPage и CatalogPage
- Предвыбор дизайна через `?designId=` в конструкторе и визуализаторе
- Backend: поле `installation_date` в заказе + Alembic-миграция 002 + валидация

---

## 07.04.2026 — Фаза 3: Дизайн по ТЗ

Приведение визуальной части в соответствие с утверждённым брендбуком (DESIGN-SYSTEM.md).

**Что сделано:**
- Акцентный цвет: `#0071e3` → `#4CAF50` (зелёный) — 56 вхождений в 26 файлах
- CTA кнопки: тёмный фон `#2D2D2D` + белый текст
- Текст: основной `#2D2D2D`, вторичный `#6B7280`
- Border-radius: кнопки 8px, карточки 16px, инпуты 8px, теги 6px
- Переименование `BLUE` → `ACCENT` в 17 файлах

---

## 07.04.2026 — Фаза 2: Отзывы и фильтры каталога

Подключение фронтенда к готовым бэкенд-эндпоинтам отзывов; недостающие фильтры.

**Что сделано:**
- Секция «Отзывы» на ProductPage: список, пагинация (5 шт.), форма для авторизованных
- Фильтры каталога: по цвету (цветные кружки), по стилю (select), toggle «Новинки»
- Backend: query-параметры `color`, `style`, `is_new` в `GET /api/designs`
- 11 новых тестов (7 unit + 4 API), валидация входных данных (`rating 1–5`, `text 1–500`)

---

## 07.04.2026 — Фаза 1: PostgreSQL и миграции

Переход с in-memory хранилища на полноценную СУБД.

**Что сделано:**
- Alembic для async SQLAlchemy: миграция `001_initial_schema.py` (9 таблиц, FK, CASCADE)
- 7 SQL-репозиториев: designs, categories, reviews, orders, subscriptions, users, projects
- DI-контейнер: `Depends(get_db_session)` c per-request кешированием
- Seed-скрипт `seed_db.py` (12 дизайнов, 6 категорий)
- In-memory fallback (`USE_MEMORY_REPOS=true`) для тестов
- Критические фиксы: единая сессия per-request, race-safe `order_number_seq`, JSON-адреса

---

## До 07.04.2026 — Базовая реализация (MVP)

Создание продукта с нуля до состояния функционирующего MVP.

**Основные вехи:**
- Проектная документация: requirements, MVP-план, дизайн-система
- MVP v1: полный B2C интернет-магазин стеновых панелей
- Фаза 2 (конструктор): grid-система, привязка к сетке, ценообразование панель + накладка
- Подписочная модель: store, модальное окно, интеграция с ценами
- Рефакторинг: миграция на DDD-архитектуру (домены, use cases, репозитории)
- ЛК с конструктором, избранное, авторизация (JWT)
- Визуализатор: фоторедактор стен с ML-сегментацией
- Backend API: FastAPI + DDD, 97 тестов
- Интеграция frontend ↔ backend: API-хуки, 26 тестов
- Замена placeholder-изображений на реальные фото

---

## Легенда

| Обозначение | Описание |
|-------------|----------|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis |
| Frontend | React, TypeScript, Zustand, Ant Design, Vite |
| Тесты | pytest (backend), Vitest (frontend) |
| Деплой | Docker Compose (nginx + frontend + backend + db + redis) |
