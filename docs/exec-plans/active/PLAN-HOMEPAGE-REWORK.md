# PLAN: Переработка главной страницы — по слайдам заказчика

**Статус:** Pending
**Дата создания:** 2026-05-11
**Источник:** Слайды заказчика (файл "Правки для сайта.docx", pasted-1778496112784.txt)

---

## Оригинал: 7 слайдов

```
Слайд 1: Hero — "Ремонт окончен. Начинается свобода." + CTA [выбрать свой WOW!]
Слайд 2: 4 шага — Выбираете / Примеряете / Обновляете / Меняете
Слайд 3: "Впервые в индустрии — Стены как сервис"
Слайд 4: Технологии Вашей свободы (3 пункта)
Слайд 5: 4 панели, ЧИСТЫЙ визуал (БЕЗ цен/рейтингов) + CTA [выбрать свой WOW!]
Слайд 6: Калькулятор (высота+длина) + Сценарии жизни + Виртуальная примерка [WOW!]
Слайд 7: "Начните обновление" + CTA [начать обновление]
```

---

## Критерии качества плана

1. **Атомарность** — каждая фаза независима: реализуема и проверяема отдельно
2. **Зависимости** — между фазами нет пропущенных связей
3. **Разделение** — каждый этап чётко разделён на backend и frontend задачи
4. **Тесты** — покрытие есть в каждой фазе, не вынесено в конец
5. **Архитектура** — соответствует CONVENTIONS.md фронтенда и бекенда

---

## Дизайн-система

### Фирменные цвета (ОБЯЗАТЕЛЬНО использовать)

| Константа | Hex | Использование |
|---|---|---|
| `ACCENT` | `#4CAF50` | CTA, акценты, кнопки |
| `ACCENT_DARK` | `#2E7D32` | Hover, градиенты |
| `DARK` | `#2D2D2D` | Основной текст |
| `GRAY_TEXT` | `#6B7280` | Вторичный текст |
| `LIGHT_BG` | `#F5F5F5` | Фоновые секции |

**Новые цвета не добавлять.** Все значения — из этой таблицы.

### UI/UX Pro Max

Перед каждой фазой для визуального оформления:

```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<запрос>" --domain <домен>
```

**Домены для поиска:**

| Домен | Когда | Пример |
|---|---|---|
| `style` | Чистый визуал, bento grid, minimal | `clean minimal visual bento` |
| `color` | Фирменная палитра | `green accent e-commerce` |
| `typography` | Заголовки, шрифты | `inter heading display` |
| `ux` | Spacing, animation, accessibility | `spacing responsive animation` |
| `react` | React-паттерны | `layout responsive card` |

### Sandbox-ограничения (ТЕСТЫ)

**⚠️ Слабый sandbox** — запускать по 1 тесту, не более 3 в батче.

```bash
# Frontend — по 1 тесту
NODE_OPTIONS='--max-old-space-size=512' npx vitest run src/domains/content/ui/__tests__/HomePage.test.tsx --reporter=verbose

# Backend — по 1 тесту, остановка на первом failure
cd backend && python -m pytest tests/ -x -v --timeout=30
```

Тяжёлые тесты (snapshot, full render всех секций) — отдельно, с `sleep 10` между запусками.

---

## Финальная структура секций HomePage

```
1. HeroSection                — Слайд 1
2. HowItWorksSection          — Слайд 2
3. ServiceBannerSection       — Слайд 3 (NEW)
4. TechSection                — Слайд 4 (NEW)
5. PanelGridSection           — Слайд 5
6. ProjectDetailsSection      — Слайд 6 (NEW)
7. CTABannerSection           — Слайд 7
```

**Удаляемые секции** (не содержатся в слайдах):
`PromoBannerSection`, `CategoriesSection`, `PopularProductsSection`, `CalculatorCTASection`, `AdvantagesSection`, `ReviewsSection`

---

## Фаза 1: Hero — Brand messaging (Слайд 1)

**Зависимости:** нет. Фаза полностью независима.

### 1.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → `HeroSection`

**Задачи:**

- [ ] Заменить заголовок: `"Ремонт окончен. Начинается свобода."`
- [ ] Подзаголовок: `"Новый интерьер – в один клик."` + `"WONDER WOW WALL – первая платформа трансформации пространства."`
- [ ] CTA: `"выбрать свой WOW!"` → `/catalog` (primary button, зелёный gradient)
- [ ] Убрать: все secondary CTA, trust badges, Unsplash-изображения
- [ ] Фон: лаконичный, НЕ перегруженный декором
- [ ] Font: `Inter, -apple-system, system-ui` (уже используется)

**Conventions (frontend):**
- Inline styles (React.CSSProperties)
- Framer Motion: `fadeUpVariants`, `containerVariants` (существующие, НЕ менять)
- Цвета: `ACCENT`, `ACCENT_DARK`, `DARK`, `GRAY_TEXT` — из констант файла
- Ant Design Button для CTA

### 1.2 Тесты (внутри фазы, НЕ в конце)

- [ ] Unit: `HeroSection` рендерится без ошибок
- [ ] Unit: Заголовок содержит `"Ремонт окончен"`
- [ ] Unit: Подзаголовок содержит `"первая платформа трансформации пространства"`
- [ ] Unit: CTA `"выбрать свой WOW!"` → `navigate('/catalog')`
- [ ] Unit: Нет secondary CTA кнопок
- [ ] Visual: screenshot desktop (1200px) + mobile (375px)

**Файл тестов:** `frontend/src/domains/content/ui/__tests__/HomePage.test.tsx` (добавить тесты HeroSection)

### Критерии приёмки

- Hero содержит только заголовок, подзаголовок и один CTA
- Никаких цен, рейтингов, дополнительных кнопок
- Визуально чистый, brand-first

---

## Фаза 2: How It Works — 4 шага (Слайд 2)

**Зависимости:** нет. Полностью независима от Фазы 1.

### 2.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → `HowItWorksSection`

**Новые шаги:**

| # | Заголовок | Описание |
|---|---|---|
| 1 | Выбираете | Найдите текстуру, которая отражает Вас сегодня |
| 2 | Примеряете | Загрузите фото и приложение мгновенно впишет новый интерьер в Ваше пространство |
| 3 | Обновляете | Мы превратили обновление интерьера в вопрос нескольких часов |
| 4 | Меняете | Одна бесплатная замена уже включена в подписку |

**Задачи:**

- [ ] Обновить 4 шага и их описания (таблица выше)
- [ ] Иконки: использовать Ant Design icons (НЕ emoji)
  - Шаг 1: `SearchOutlined`
  - Шаг 2: `CameraOutlined` или `PictureOutlined`
  - Шаг 3: `ClockCircleOutlined`
  - Шаг 4: `CustomerServiceOutlined` или `SwapOutlined`
- [ ] Сохранить анимацию: `fadeUpVariants`, `containerVariants` (НЕ менять)
- [ ] Сохранить layout: grid из 4 карточек (НЕ менять структуру)
- [ ] Сохранить `StepIcon` component (НЕ переписывать)

**Conventions (frontend):** как в Фазе 1.

### 2.2 Тесты

- [ ] Unit: 4 карточки с правильными заголовками (Выбираете, Примеряете, Обновляете, Меняете)
- [ ] Unit: Описания соответствуют таблице выше
- [ ] Unit: Каждая карточка содержит иконку (не emoji)
- [ ] Visual: screenshot

### Критерии приёмки

- 4 шага точно соответствуют слайду 2
- Визуально чистые иконки из Ant Design (не emoji)
- Существующая анимация сохранена

---

## Фаза 3: "Стены как сервис" (Слайд 3)

**Зависимости:** нет. Полностью независима.

### 3.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → новая `ServiceBannerSection`

**Содержание:**

| Элемент | Текст |
|---|---|
| Заголовок | Впервые в индустрии |
| Подзаголовок | Стены как сервис |
| Текст | Мы создали будущее, в котором интерьер меняется без традиционного ремонта |
| Brand badge | WONDER WOW WALL – новый стандарт трансформации пространства |

**Задачи:**

- [ ] Создать `ServiceBannerSection`
- [ ] Layout: центрированный, лаконичный
- [ ] Фирменный зелёный gradient как акцент (ACCENT цвет)
- [ ] Использовать `fadeUpVariants` для анимации
- [ ] Минимум элементов: заголовок, подзаголовок, текст, badge

### 3.2 Тесты

- [ ] Unit: секция рендерится с заголовком "Впервые в индустрии"
- [ ] Unit: текст "Стены как сервис" присутствует
- [ ] Unit: текст про будущее присутствует
- [ ] Unit: Brand badge "WONDER WOW WALL" присутствует
- [ ] Visual: screenshot

### Критерии приёмки

- Точное соответствие слайду 3
- Чистый layout, центрированный текст

---

## Фаза 4: "Технологии Вашей свободы" (Слайд 4)

**Зависимости:** нет. Полностью независима.

### 4.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → новая `TechSection`

**Содержание:**

| Элемент | Текст |
|---|---|
| Заголовок | Технологии Вашей свободы |
| Пункт 1 | Универсальная платформа монтажа — для любых поверхностей |
| Пункт 2 | Запатентованная система креплений — быстрая замена |
| Пункт 3 | Безграничность фактур — формируйте пространство под любой стиль |
| Финал | Вы сами решаете, о чём сегодня говорят Ваши стены |

**Задачи:**

- [ ] Создать `TechSection`
- [ ] Layout: 3 колонки с иконками на desktop, stack на mobile
- [ ] Иконки: Ant Design (`SettingOutlined`, `LockOutlined`, `AppstoreOutlined`)
- [ ] Использовать `ACCENT` для иконок-бэджей
- [ ] Финальная строка — отдельным блоком, курсив или accent color

**Conventions (frontend):** inline styles, Framer Motion.

### 4.2 Тесты

- [ ] Unit: заголовок "Технологии Вашей свободы" присутствует
- [ ] Unit: все 3 пункта присутствуют с описаниями
- [ ] Unit: финальная строка присутствует
- [ ] Unit: 3 иконки (не emoji)
- [ ] Visual: screenshot desktop + mobile

### Критерии приёмки

- Соответствие слайду 4
- 3 колонки → stack на 768px

---

## Фаза 5: Каталог панелей — чистый визуал (Слайд 5)

**Зависимости:**
- Frontend: использовать существующие данные из `domains/catalog/model/data.ts` (products, categories)
- Backend: проверить существующий `GET /api/designs` (уже есть)

### 5.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → обновить/заменить секцию на `PanelGridSection`

**Текущая проблема:** существующая `CategoriesSection` фильтрует по размеру и показывает цены/рейтинги. Нужно заменить на чистый визуал.

**Задачи:**

- [ ] Создать `PanelGridSection` (или обновить существующую секцию)
- [ ] Показать 4 панели: изображение + название, **БЕЗ** badge, **БЕЗ** цены, **БЕЗ** рейтинга
- [ ] CTA: `"выбрать свой WOW!"` → `/catalog`
- [ ] Layout: 2×2 grid на desktop, 2×2 на tablet, 1 колонка на mobile
- [ ] Данные: использовать первые 4 продукта из `products` (без изменений в data)

**Конкретно убрать:**
- Цены (`{price.toLocaleString()} ₽`)
- Рейтинги (`<Rate disabled>`)
- Бейджи (`{product.badge}`)
- Текст про отзывы (`{product.reviews} отзывов`)
- Цветовые точки

**Оставить:**
- Изображение панели (`product.image`)
- Название (`product.name`)
- CTA кнопка

### 5.2 Тесты

- [ ] Unit: 4 панели рендерятся
- [ ] Unit: на панелях **нет** цен (отсутствует элемент с ценой)
- [ ] Unit: на панелях **нет** рейтингов (отсутствует `<Rate`)
- [ ] Unit: на панелях **нет** бейджей (отсутствует `<Tag`)
- [ ] Unit: CTA `"выбрать свой WOW!"` → `navigate('/catalog')`
- [ ] Visual: screenshot

### Критерии приёмки

- На панелях нет цен и рейтингов
- Чистый визуал как на слайде 5
- CTA ведёт на `/catalog`

---

## Фаза 6: "Ваш проект. В деталях" (Слайд 6)

**Зависимости:**
- Backend: проверить `POST /api/calculator` (существует в `contacts.py`), понять его интерфейс

### 6.1 Backend

**Файлы:**
- `backend/app/infrastructure/api/contacts.py` — найти существующий `/api/calculator`

**Задачи:**

- [ ] Найти существующий endpoint расчёта (в contacts или catalog)
- [ ] Понять его интерфейс: какие параметры принимает, что возвращает
- [ ] Если endpoint отсутствует — создать `POST /api/quick-calculate`
  - Request: `{ height_m: float, length_m: float }`
  - Response: `{ wall_area: float, panels_estimate: int, price_from: int }`
- [ ] Логика расчёта:
  - `wall_area = height_m × length_m`
  - `panels_estimate = ceil(wall_area / 0.09)` (0.09 м² на панель 30×30 см)
  - `price_from = panels_estimate × BASE_PANEL_PRICES['300x300']`

**Conventions (backend):**
- Use case → `application/shop/use_cases.py`
- DTO → `application/shop/dtos.py`
- Router → `infrastructure/api/shop.py` или `contacts.py`

### 6.2 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → новая `ProjectDetailsSection`

**Три блока:**

1. **Точный расчёт**
   - InputNumber: высота (м)
   - InputNumber: длина (м)
   - Авторасчёт площади: `height × length`
   - Результат: "X панелей, от Y ₽"
   - Подключение к `POST /api/quick-calculate` или использовать существующий endpoint

2. **Сценарии жизни**
   - 6 thumbnail'ов: гостиная, спальня, зона ТВ, детская, кухня, WC
   - Горизонтальный scroll на mobile
   - Клик → `/catalog` или `/constructor`

3. **Виртуальная примерка**
   - Заголовок: "Готовы увидеть это на своей стене?"
   - Описание: "Загрузите фото и посмотрите как изменится Ваш интерьер"
   - CTA: `"[ WOW! ]"` → `/visualizer`

**Задачи:**

- [ ] Создать `ProjectDetailsSection`
- [ ] Layout: 3 колонки на desktop, stack на mobile
- [ ] Калькулятор: 2 InputNumber → площадь → запрос к API → результат
- [ ] Сценарии: 6 карточек с иконками (Ant Design), горизонтальный scroll
- [ ] Виртуальная примерка: текст + CTA → `/visualizer`

### 6.3 Тесты

**Backend:**
- [ ] Pytest: `POST /api/quick-calculate` (или существующий endpoint) с height=3, length=4 → wall_area=12, panels≈134
- [ ] Pytest: валидация — отрицательные значения → 400
- [ ] Pytest: валидация — нечисловые значения → 400

**Frontend:**
- [ ] Unit: 3 блока рендерятся (calculator, scenarios, virtual fitting)
- [ ] Unit: калькулятор считает площадь (height × length)
- [ ] Unit: при вводе высоты и длины появляется результат (панели, цена)
- [ ] Unit: 6 сценариев отображаются (гостиная, спальня, зона ТВ, детская, кухня, WC)
- [ ] Unit: CTA `"[ WOW! ]"` → `navigate('/visualizer')`
- [ ] Visual: screenshot

### Критерии приёмки

- Все 3 блока соответствуют слайду 6
- Калькулятор минималистичный (2 поля ввода)
- Сценарии — 6 карточек с подписями

---

## Фаза 7: Финальный CTA (Слайд 7)

**Зависимости:** нет. Полностью независима.

### 7.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx` → обновить `CTABannerSection`

**Содержание:**

| Элемент | Текст |
|---|---|
| Заголовок | Начните обновление |
| Подзаголовок | Присоединяйтесь к новой культуре взаимодействия с пространством |
| Текст | Ремонт перестал быть событием. Вам нужно только выбрать настроение. |
| CTA | Начать обновление → `/catalog` |

**Задачи:**

- [ ] Обновить тексты в `CTABannerSection`
- [ ] Убрать все лишние кнопки — только один CTA
- [ ] Сохранить визуальный стиль (белый фон, центрирование, декоративная линия сверху — существующий элемент оставить)
- [ ] CTA: зелёный gradient, крупный

### 7.2 Тесты

- [ ] Unit: заголовок "Начните обновление" присутствует
- [ ] Unit: текст "Ремонт перестал быть событием" присутствует
- [ ] Unit: только 1 CTA кнопка
- [ ] Unit: CTA "Начать обновление" → `navigate('/catalog')`
- [ ] Visual: screenshot

### Критерии приёмки

- Соответствие слайду 7
- Только один CTA

---

## Фаза 8: Глобальные фирменные элементы

**Зависимости:** требует завершённых Фаз 1-7 для проверки.

### 8.1 Frontend

**Файлы:**
- `frontend/src/shared/ui/ShopLayout.tsx` — проверить header
- `frontend/src/shared/theme.ts` — проверить шрифты
- `frontend/src/index.css` — проверить глобальные стили

**Задачи:**

- [ ] Логотип: зелёный, использовать `wonderWall__logotype.png`
- [ ] Шрифт: убедиться что Inter используется глобально (fallback: -apple-system, system-ui)
- [ ] Убрать все сторонние шрифты (Google Fonts и т.д.)
- [ ] Проверить консистентность: все заголовки используют тот же font-family

### 8.2 Тесты

- [ ] Visual: логотип зелёный, шрифт единый (screenshot header)
- [ ] Visual: Hero и CTABanner используют тот же шрифт (screenshot)

### Критерии приёмки

- Логотип зелёный
- Шрифт Inter/system-ui единый на всей странице

---

## Фаза 9: Финальная интеграция

**Зависимости:** требует завершённых Фаз 1-8.

### 9.1 Frontend

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx`

**Задачи:**

- [ ] Установить финальный порядок секций:
  ```
  1. HeroSection
  2. HowItWorksSection
  3. ServiceBannerSection
  4. TechSection
  5. PanelGridSection
  6. ProjectDetailsSection
  7. CTABannerSection
  ```
- [ ] Удалить импорты и компоненты удаляемых секций
- [ ] Обновить imports для новых секций
- [ ] Убедиться что все секции используют фирменные цвета (ACCENT, DARK, GRAY_TEXT)
- [ ] Проверить `<style>` блок — добавить responsive для новых секций (768px breakpoint)

### 9.2 Тесты

- [ ] Smoke: HomePage рендерится полностью (все 7 секций)
- [ ] Unit: каждая секция присутствует (7 assertions)
- [ ] Visual: все 7 секций на desktop (1200px)
- [ ] Visual: все 7 секций на mobile (375px) — stack layout
- [ ] Проверка: нет цен, рейтингов, бейджей на панелях (Фаза 5)
- [ ] Проверка: финальный CTA только один (Фаза 7)

### Критерии приёмки

- Все 7 секций в правильном порядке
- Нет удалённых секций в коде
- Responsive работает на 768px
- Нет console errors

---

## Удаляемые секции (не в слайдах)

| Секция | Причина удаления |
|---|---|
| `PromoBannerSection` | Про скидку 15% — нет в слайдах |
| `CategoriesSection` | Фильтрация по размеру — заменена на `PanelGridSection` |
| `PopularProductsSection` | Товары с ценами/рейтингами — заменена на `PanelGridSection` |
| `CalculatorCTASection` | Статичные примеры цен — заменена на интерактивный калькулятор в `ProjectDetailsSection` |
| `AdvantagesSection` | 6 карточек — заменена на `TechSection` |
| `ReviewsSection` | Отзывы — нет в слайдах |

---

## Что НЕ нужно делать (не содержится в слайдах)

- ❌ Шоу-румы и дилеры
- ❌ ИИ-дизайнер
- ❌ Коллекции и текстуры как отдельные режимы каталога
- ❌ Подписка как primary messaging (только в шаге 4)
- ❌ Отзывы клиентов
- ❌ Скидка 15% / промокод
- ❌ Конфигуратор как отдельная страница

---

## Что ДОЛЖНО быть (точно по слайдам)

- ✅ Brand-first hero
- ✅ 4 шага (Выбираете / Примеряете / Обновляете / Меняете)
- ✅ "Стены как сервис" messaging
- ✅ Технологии (универсальная платформа, запатентованная система, безграничность фактур)
- ✅ 4 панели БЕЗ цен/рейтингов
- ✅ Калькулятор (высота + длина)
- ✅ 6 сценариев жизни
- ✅ Виртуальная примерка → `/visualizer`
- ✅ Финальный CTA "Начать обновление" → `/catalog`

---

## Декомпозиция (рекомендация)

Текущий `HomePage.tsx` — 1665 строк. После добавления новых секций вырастет до ~2200+.

**До начала работ (Фаза 0 или в начале Фазы 1):**

```
frontend/src/domains/content/ui/home/
├── HomePage.tsx              # Композиция секций (упрощённый)
├── HeroSection.tsx
├── HowItWorksSection.tsx
├── ServiceBannerSection.tsx
├── TechSection.tsx
├── PanelGridSection.tsx
├── ProjectDetailsSection.tsx
└── CTABannerSection.tsx
```

Это **не блокер** — можно работать в одном файле, но к Фазе 9 файл должен быть чистым.

---

## Notes

- Responsive breakpoint: только 768px (как в текущем коде)
- Все секции: inline styles, Framer Motion, Ant Design, фирменные цвета
- Тесты: по 1 за раз (sandbox ограничения)
- Новые API endpoints: создавать только если существующие не подходят
- Данные панелей: использовать `domains/catalog/model/data.ts` (products) — не создавать новых