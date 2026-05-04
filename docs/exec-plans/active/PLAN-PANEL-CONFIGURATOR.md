# PLAN: Конфигуратор панелей (Apple-style)

**Статус:** Draft  
**Дата создания:** 2026-05-04  
**Цель:** Переработать каталог и карточку товара в Apple-style конфигуратор с иерархией Форма → Текстура → Цвет

---

## Обзор

Текущий каталог (`/catalog`) показывает дизайны (overlay-накладки) с фильтрами. Мы полностью заменяем этот флоу на конфигуратор панелей:

1. **Каталог** → список форм панелей (волна, гексагон, треугольник и т.д.) с белыми силуэтами
2. **Карточка товара** → Apple-style конфигуратор: слева — крупное превью комбинации, справа — выбор текстуры и цвета; ниже — описание, отзывы, рекомендации

Визуальный референс: [apple.com/de/shop/buy-mac/macbook-air](https://www.apple.com/de/shop/buy-mac/macbook-air)

---

## Иерархия данных

```
Design (Form/Shape)          — Волна, Гексагон, Треугольник...
  └── Texture (Material)     — Бетон, Дерево, Мрамор...
        └── TextureColor     — Серый бетон, Белый бетон...
              └── VariantImage — Загруженное фото комбинации
```

---

## Фаза 1: Модель данных (Backend)

### 1.1 Новые сущности домена

**Файлы:**
- `backend/app/domain/catalog/texture.py` — агрегат Texture
- `backend/app/domain/catalog/texture_color.py` — сущность TextureColor
- `backend/app/domain/catalog/variant_image.py` — сущность VariantImage
- `backend/app/domain/catalog/value_objects.py` — расширение (если нужны новые VO)

**Texture (материал/текстура):**
```python
@dataclass
class Texture:
    id: str                  # UUID
    name: str                # "Бетон", "Дерево"
    slug: str                # "concrete", "wood" (unique)
    swatch_image: str        # Путь к превью-свотчу текстуры
    sort_order: int          # Порядок отображения
    is_active: bool          # Soft-hide
    created_at: datetime
```

**TextureColor (цвет в рамках текстуры):**
```python
@dataclass
class TextureColor:
    id: str                  # UUID
    texture_id: str          # FK → Texture
    name: str                # "Серый", "Тёплый дуб"
    hex: str                 # #RRGGBB для сводки
    swatch_image: str        # Путь к превью цвета (опционально)
    sort_order: int
    is_active: bool
    created_at: datetime
```

**VariantImage (изображение комбинации форма + текстура + цвет):**
```python
@dataclass
class VariantImage:
    id: str                  # UUID
    design_id: str           # FK → Design (форма)
    texture_id: str          # FK → Texture
    color_id: str            # FK → TextureColor
    image_path: str          # Путь к загруженному файлу
    created_at: datetime
```

**Уникальный constraint:** (design_id, texture_id, color_id) — одно изображение на комбинацию.

### 1.2 Репозитории

**Файлы:**
- `backend/app/domain/catalog/repositories.py` — абстрактные интерфейсы
- `backend/app/infrastructure/repositories/texture_repo.py`
- `backend/app/infrastructure/repositories/texture_color_repo.py`
- `backend/app/infrastructure/repositories/variant_image_repo.py`

**Интерфейсы:**
- `TextureRepository`: get_by_id, get_by_slug, list_active, list_all, save, delete
- `TextureColorRepository`: get_by_id, list_by_texture, list_active_by_texture, save, delete
- `VariantImageRepository`: get_by_combination(design_id, texture_id, color_id), list_by_design, save, delete

### 1.3 Миграции БД (Alembic)

**Файл:** `backend/alembic/versions/xxx_add_textures_and_variants.py`

Таблицы:
- `textures` (id, name, slug UNIQUE, swatch_image, sort_order, is_active, created_at)
- `texture_colors` (id, texture_id FK, name, hex, swatch_image, sort_order, is_active, created_at)
- `variant_images` (id, design_id FK, texture_id FK, color_id FK, image_path, created_at, UNIQUE(design_id, texture_id, color_id))

### 1.4 Расширение Design

**Файл:** `backend/app/domain/catalog/entities.py`

Добавить поле:
```python
preview_image: str = ""  # Белый силуэт формы для каталога
```

Поле `colors` в Design остаётся для обратной совместимости (legacy), но в новом флоу цвета берутся из TextureColor.

### 1.5 Тесты (Backend, Фаза 1)

**Файлы:**
- `backend/tests/domain/test_texture.py` — unit-тесты сущностей
- `backend/tests/domain/test_variant_image.py` — unit-тесты VariantImage
- `backend/tests/infrastructure/test_texture_repo.py` — тесты репозиториев

**Покрытие:**
- [x] Создание Texture с валидными данными
- [x] Создание TextureColor, привязка к Texture
- [x] Создание VariantImage, уникальность комбинации
- [x] Деактивация Texture → скрытие связанных цветов
- [x] Репозиторий: CRUD-операции для всех новых сущностей

---

## Фаза 2: API эндпоинты (Backend)

### 2.1 Публичное API

**Файл:** `backend/app/infrastructure/api/public/catalog.py` (расширение существующего)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/designs` | Список форм (добавить `preview_image`) |
| GET | `/api/designs/{id}` | Детали формы |
| GET | `/api/designs/{id}/textures` | Текстуры для формы (активные) |
| GET | `/api/textures` | Все активные текстуры |
| GET | `/api/textures/{id}/colors` | Цвета текстуры (активные) |
| GET | `/api/designs/{id}/variant-image` | Получить изображение по query: `?texture_id=...&color_id=...` |

**Ответ `/api/designs` (расширенный):**
```json
{
  "id": "uuid",
  "name": "Волна",
  "slug": "wave",
  "preview_image": "/uploads/forms/wave-white.png",
  "description": "...",
  "price": 1200,
  "rating": 4.5,
  "reviews_count": 12,
  "is_new": true,
  "is_popular": false
}
```

**Ответ `/api/designs/{id}/textures`:**
```json
[
  {
    "id": "uuid",
    "name": "Бетон",
    "slug": "concrete",
    "swatch_image": "/uploads/textures/concrete-swatch.jpg",
    "colors": [
      { "id": "uuid", "name": "Серый", "hex": "#8C8C8C", "swatch_image": "..." },
      { "id": "uuid", "name": "Белый", "hex": "#F5F5F5", "swatch_image": "..." }
    ]
  }
]
```

**Ответ `/api/designs/{id}/variant-image`:**
```json
{
  "image_path": "/uploads/variants/wave-concrete-gray.jpg"
}
```

### 2.2 Админ API

**Файл:** `backend/app/infrastructure/api/admin/textures.py` (новый)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/textures` | Список всех текстур (вкл. неактивные) |
| POST | `/api/admin/textures` | Создать текстуру |
| PATCH | `/api/admin/textures/{id}` | Обновить текстуру |
| DELETE | `/api/admin/textures/{id}` | Удалить текстуру (если нет variant_images) |
| GET | `/api/admin/textures/{id}/colors` | Цвета текстуры |
| POST | `/api/admin/textures/{id}/colors` | Создать цвет |
| PATCH | `/api/admin/texture-colors/{id}` | Обновить цвет |
| DELETE | `/api/admin/texture-colors/{id}` | Удалить цвет |
| GET | `/api/admin/variant-images` | Список (фильтр: design_id, texture_id) |
| POST | `/api/admin/variant-images` | Создать/заменить изображение комбинации |
| DELETE | `/api/admin/variant-images/{id}` | Удалить изображение |

**Файл:** `backend/app/infrastructure/api/admin/catalog.py` (расширение)

Добавить в `DesignCreate` / `DesignUpdate`:
```python
preview_image: str = Field(default="", max_length=500)  # Белый силуэт
```

### 2.3 Use Cases (Application Layer)

**Файлы:**
- `backend/app/application/catalog/texture_use_cases.py`
- `backend/app/application/catalog/variant_image_use_cases.py`

Use cases:
- `CreateTexture`, `UpdateTexture`, `DeleteTexture`
- `CreateTextureColor`, `UpdateTextureColor`, `DeleteTextureColor`
- `UploadVariantImage`, `DeleteVariantImage`, `GetVariantImage`

### 2.4 Тесты (Backend, Фаза 2)

**Файлы:**
- `backend/tests/api/test_textures_public.py`
- `backend/tests/api/test_textures_admin.py`
- `backend/tests/api/test_variant_images_admin.py`
- `backend/tests/application/test_texture_use_cases.py`

**Покрытие:**
- [x] GET /api/textures — возвращает только активные
- [x] GET /api/designs/{id}/textures — текстуры с цветами для формы
- [x] GET /api/designs/{id}/variant-image — 200 с путём или 404
- [x] Admin CRUD текстур — создание, обновление, деактивация, удаление
- [x] Admin CRUD цветов — привязка к текстуре, валидация hex
- [x] Admin variant-images — загрузка, уникальность комбинации (409 при дубле)
- [x] Проверка авторизации (admin-only endpoints)

---

## Фаза 3: Шрифты и визуальный язык (Frontend)

### 3.1 Замена шрифтов

**Файлы:**
- `frontend/src/index.css` — замена @import шрифта
- `frontend/src/shared/theme.ts` — обновление fontFamily
- `frontend/index.html` — preconnect/preload (если используем Google Fonts)

**Шрифт:** SF Pro Display / SF Pro Text не доступен через Google Fonts. Варианты:
1. **Рекомендуемый:** Использовать `Inter` (уже подключен, очень близок к SF Pro по метрикам) с system-ui fallback для Apple-устройств:
   ```css
   font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', system-ui, sans-serif;
   ```
   Так на macOS/iOS будет настоящий SF Pro, на остальных — Inter.

2. **Альтернатива:** Подключить `Plus Jakarta Sans` или `Geist` (Vercel's font, ближайший open-source аналог SF Pro).

**Решение принимает заказчик на этапе реализации.** В плане закладываем оба варианта.

### 3.2 Обновление темы под Apple-aesthetic

**Файл:** `frontend/src/shared/theme.ts`

Изменения:
- Увеличить `borderRadius` → 16px (cards), 12px (buttons/inputs)
- Убрать зелёный accent (`#4CAF50`) → заменить на чёрный/тёмно-серый CTA (Apple-style)
- Увеличить белое пространство (padding, gaps)
- Упростить shadows (Apple использует минималистичные тени)
- Letter-spacing: -0.02em для заголовков (как у Apple)

### 3.3 Тесты (Frontend, Фаза 3)

**Файл:** `frontend/src/shared/__tests__/theme.test.ts`

- [x] Snapshot-тест темы (фиксация после изменений)
- [x] Проверка, что fontFamily содержит system-ui fallback

---

## Фаза 4: Каталог форм (Frontend)

### 4.1 Переработка CatalogPage

**Файл:** `frontend/src/domains/catalog/ui/CatalogPage.tsx` — полная переработка

**Новый UI:**
- Заголовок "Выберите форму панели" (крупный, Apple-style typography)
- Сетка карточек форм (responsive grid: 3 колонки desktop, 2 tablet, 1 mobile)
- Каждая карточка:
  - Белый силуэт формы на светло-сером фоне (`preview_image`)
  - Название формы под изображением
  - Минимальная цена "от X ₽"
  - Бейдж "Новинка" / "Популярное" (если есть)
  - Hover: subtle scale + shadow (как Apple product grid)
- Клик → переход на `/product/:id`

**Убираем:**
- Фильтры по цвету, стилю, цене (не релевантны для выбора формы)
- Режимы grid/list (только grid)
- Сортировку (оставить только "Популярные" дефолтом)

**Оставляем:**
- Поиск по названию формы (опционально)

### 4.2 API-адаптер

**Файл:** `frontend/src/domains/catalog/api/adapters.ts`

Обновить `apiDesignToProduct` → добавить маппинг `preview_image`.

**Файл:** `frontend/src/domains/catalog/model/types.ts`

Добавить в `PanelProduct`:
```typescript
previewImage: string;  // Белый силуэт
```

### 4.3 Тесты (Frontend, Фаза 4)

**Файл:** `frontend/src/domains/catalog/__tests__/CatalogPage.test.tsx`

- [x] Рендерит список форм из API
- [x] Показывает preview_image в каждой карточке
- [x] Клик по карточке навигирует на /product/:id
- [x] Показывает loading-состояние
- [x] Показывает empty-состояние при пустом списке
- [x] Responsive: проверка grid layout (media query snapshot)

---

## Фаза 5: Конфигуратор — карточка товара (Frontend)

### 5.1 Переработка ProductPage — Apple-style layout

**Файл:** `frontend/src/domains/catalog/ui/ProductPage.tsx` — значительная переработка

**Новая структура страницы:**

```
┌─────────────────────────────────────────────────────┐
│  HERO SECTION (sticky on scroll)                     │
│  ┌──────────────────────┐  ┌─────────────────────┐  │
│  │                      │  │  Форма: Волна        │  │
│  │   PREVIEW IMAGE      │  │                     │  │
│  │   (большое фото      │  │  Текстура:          │  │
│  │    комбинации)       │  │  [Бетон] [Дерево]   │  │
│  │                      │  │                     │  │
│  │                      │  │  Цвет:              │  │
│  │                      │  │  ● ● ● ● ●          │  │
│  │                      │  │                     │  │
│  │                      │  │  Цена: 1 200 ₽/шт  │  │
│  │                      │  │  [Количество: +-]   │  │
│  │                      │  │                     │  │
│  │                      │  │  [В корзину]        │  │
│  └──────────────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  ДРУГИЕ ФОРМЫ (горизонтальный скролл миниатюр)      │
├─────────────────────────────────────────────────────┤
│  ОПИСАНИЕ ПРОДУКТА                                   │
├─────────────────────────────────────────────────────┤
│  ХАРАКТЕРИСТИКИ (таблица)                            │
├─────────────────────────────────────────────────────┤
│  ОТЗЫВЫ                                              │
├─────────────────────────────────────────────────────┤
│  РЕКОМЕНДАЦИИ                                        │
└─────────────────────────────────────────────────────┘
```

**Поведение конфигуратора:**
1. При загрузке страницы — подгружаем текстуры для данной формы
2. По умолчанию выбрана первая текстура и первый цвет
3. При смене текстуры — обновляем доступные цвета, выбираем первый
4. При смене цвета — загружаем variant-image для комбинации (форма + текстура + цвет)
5. Если variant-image не найден — показываем placeholder (белый силуэт)
6. Preview-изображение плавно меняется (fade transition)

**Секция "Другие формы":**
- Горизонтальный скролл миниатюр других форм
- Клик → навигация на `/product/:другой_id`
- Текущая форма выделена (border/ring)

### 5.2 Компоненты конфигуратора

**Новые файлы:**
- `frontend/src/domains/catalog/ui/components/TextureSelector.tsx`
- `frontend/src/domains/catalog/ui/components/ColorSelector.tsx`
- `frontend/src/domains/catalog/ui/components/ProductPreview.tsx`
- `frontend/src/domains/catalog/ui/components/FormSwitcher.tsx`
- `frontend/src/domains/catalog/ui/components/ConfiguratorPanel.tsx`

**TextureSelector:**
- Список текстур в виде карточек-свотчей (изображение + название)
- Активная текстура — выделена рамкой
- При выборе — анимация перехода

**ColorSelector:**
- Сетка/строка кругов-свотчей (hex-цвет или swatch_image)
- Активный цвет — ring + checkmark
- Tooltip с названием цвета

**ProductPreview:**
- Крупное изображение (aspect-ratio фиксирован)
- Fade-transition при смене
- Loading skeleton при загрузке нового изображения
- Fallback на preview_image формы если variant-image отсутствует

**FormSwitcher:**
- Горизонтальный скролл миниатюр форм
- Snap scrolling
- Текущая выделена

**ConfiguratorPanel:**
- Оркестрирует выбор: текстура → цвет → цена → кнопка "В корзину"
- Sticky на desktop (как у Apple)

### 5.3 API-интеграция конфигуратора

**Файл:** `frontend/src/domains/catalog/api/catalogApi.ts` — расширение

Новые React Query хуки:
```typescript
useDesignTextures(designId: string)      // GET /api/designs/{id}/textures
useVariantImage(designId, textureId, colorId)  // GET /api/designs/{id}/variant-image
```

**Файл:** `frontend/src/domains/catalog/model/types.ts` — новые типы

```typescript
interface Texture {
  id: string;
  name: string;
  slug: string;
  swatchImage: string;
  colors: TextureColor[];
}

interface TextureColor {
  id: string;
  name: string;
  hex: string;
  swatchImage?: string;
}

interface VariantImageResponse {
  image_path: string;
}
```

### 5.4 Обновление корзины

**Файл:** `frontend/src/domains/order/model/cartStore.ts`

Расширить `CartItem`:
```typescript
interface CartItem {
  id: string;           // `${productId}-${textureId}-${colorId}`
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  area: number;
  color: string;        // hex
  colorName: string;
  size: string;
  textureName: string;  // NEW: название текстуры
  textureId: string;    // NEW: id текстуры
  colorId: string;      // NEW: id цвета
}
```

**Файл:** `frontend/src/domains/order/model/types.ts` — обновить интерфейс

**Файл:** `backend/app/domain/order/entities.py` — расширить OrderItem:
```python
texture_name: str = ""   # Название текстуры
texture_id: str = ""     # ID текстуры (для отчётности)
color_id: str = ""       # ID цвета
```

### 5.5 Тесты (Frontend, Фаза 5)

**Файлы:**
- `frontend/src/domains/catalog/__tests__/ProductPage.test.tsx`
- `frontend/src/domains/catalog/__tests__/TextureSelector.test.tsx`
- `frontend/src/domains/catalog/__tests__/ColorSelector.test.tsx`
- `frontend/src/domains/catalog/__tests__/ConfiguratorPanel.test.tsx`

**Покрытие:**
- [x] ProductPage: рендерит конфигуратор с текстурами и цветами
- [x] ProductPage: смена текстуры обновляет доступные цвета
- [x] ProductPage: смена цвета загружает новое превью
- [x] ProductPage: добавление в корзину с правильными атрибутами
- [x] ProductPage: fallback-изображение если variant-image не найден
- [x] TextureSelector: показывает свотчи текстур, выделяет активную
- [x] ColorSelector: показывает цвета текущей текстуры, выделяет активный
- [x] FormSwitcher: показывает другие формы, навигирует при клике
- [x] ConfiguratorPanel: sticky-поведение на desktop

---

## Фаза 6: Админ-панель — управление текстурами (Frontend)

### 6.1 Новая страница AdminTexturesPage

**Файл:** `frontend/src/domains/admin/ui/AdminTexturesPage.tsx`

**Tabs:**
1. **Текстуры** — CRUD текстур (таблица: название, slug, swatch, sort_order, active, actions)
2. **Цвета** — CRUD цветов (фильтр по текстуре; таблица: название, hex, swatch, sort_order, active)
3. **Изображения комбинаций** — загрузка variant-images (фильтр: форма × текстура; сетка загруженных фото)

**UI для вкладки "Изображения комбинаций":**
- Выбрать форму (dropdown)
- Выбрать текстуру (dropdown)
- Матрица: строки = цвета текстуры, колонка = загруженное фото
- Кнопка "Загрузить" для каждой ячейки
- Визуальная индикация: зелёная рамка = фото есть, серая = фото отсутствует

### 6.2 Роутинг админки

**Файл:** `frontend/src/shared/router.tsx`

Добавить:
```typescript
<Route path="textures" element={<AdminTexturesPage />} />
```

**Файл:** `frontend/src/domains/admin/ui/AdminLayout.tsx` — добавить пункт меню "Текстуры"

### 6.3 API-клиент админки

**Файл:** `frontend/src/domains/admin/api/texturesAdminApi.ts`

React Query хуки:
- `useAdminTextures()` — список текстур
- `useCreateTexture()` — мутация создания
- `useUpdateTexture()` — мутация обновления
- `useDeleteTexture()` — мутация удаления
- `useAdminTextureColors(textureId)` — цвета текстуры
- `useCreateTextureColor()` — создание цвета
- `useUpdateTextureColor()` — обновление цвета
- `useDeleteTextureColor()` — удаление цвета
- `useAdminVariantImages(params)` — список variant-images
- `useUploadVariantImage()` — загрузка изображения комбинации
- `useDeleteVariantImage()` — удаление

### 6.4 Расширение AdminCatalogPage

**Файл:** `frontend/src/domains/admin/ui/AdminCatalogPage.tsx`

В форме создания/редактирования Design:
- Добавить поле `preview_image` (загрузка белого силуэта формы)
- Убрать поле `colors` из формы (цвета теперь через текстуры) — но оставить отображение для legacy

### 6.5 Тесты (Frontend, Фаза 6)

**Файлы:**
- `frontend/src/domains/admin/__tests__/AdminTexturesPage.test.tsx`
- `frontend/src/domains/admin/__tests__/texturesAdminApi.test.ts`

**Покрытие:**
- [x] CRUD текстур: создание, редактирование, удаление
- [x] CRUD цветов: привязка к текстуре, валидация hex
- [x] Variant images: загрузка изображения для комбинации
- [x] Variant images: визуальная матрица с индикацией заполненности
- [x] Навигация: пункт "Текстуры" в сайдбаре админки

---

## Фаза 7: Интеграция и обратная совместимость

### 7.1 Миграция данных

**Задачи:**
- Существующие Design.colors → НЕ удаляем, помечаем как legacy
- Публичное API `/api/designs` продолжает возвращать `colors` для обратной совместимости
- Конфигуратор использует только текстуры/цвета из новых эндпоинтов
- Если у формы нет текстур — показываем "Скоро" placeholder

### 7.2 OrderItem — обратная совместимость

**Файл:** `backend/app/domain/order/entities.py`

Поля `texture_name`, `texture_id`, `color_id` — опциональные (default=""). Старые заказы не ломаются.

**Файл:** `backend/app/infrastructure/api/public/orders.py`

Добавить в OrderItemCreate:
```python
texture_name: str = ""
texture_id: str = ""
color_id: str = ""
```

### 7.3 Checkout page

**Файл:** `frontend/src/domains/order/ui/CheckoutPage.tsx`

Отображение в корзине/чекауте:
```
Волна — Бетон, Серый — 2 шт — 2 400 ₽
```

### 7.4 Тесты (Фаза 7)

- [x] E2E: старые заказы (без texture_id) отображаются корректно
- [x] API: OrderItemCreate с пустыми texture_* проходит валидацию
- [x] Checkout: корректное отображение новых атрибутов в позиции

---

## Фаза 8: QA, полировка, регрессия

### 8.1 Регрессионные проверки

- [ ] Старый каталог заменён, но маршрут `/catalog` работает
- [ ] `/product/:id` работает для всех существующих форм
- [ ] Корзина: добавление/удаление/изменение количества
- [ ] Checkout: оформление заказа с новыми атрибутами
- [ ] Админка: существующие дизайны редактируются без ошибок
- [ ] Визуализатор (если использует каталог) — не ломается
- [ ] Конструктор (/constructor) — не ломается
- [ ] Мобильная адаптация конфигуратора
- [ ] Отзывы на карточке товара работают
- [ ] Рекомендации отображаются

### 8.2 UI-полировка

- [ ] Анимации переходов (Framer Motion): fade/slide при смене текстуры/цвета
- [ ] Skeleton loading для превью
- [ ] Responsive: на мобильных конфигуратор под превью (stack), а не справа
- [ ] Sticky CTA-bar на мобильных (как сейчас)
- [ ] Accessibility: ARIA-labels для свотчей, keyboard navigation

### 8.3 Performance

- [ ] Lazy loading variant-images (подгружаем по мере выбора)
- [ ] Image optimization (webp, srcset)
- [ ] Prefetch следующих вероятных комбинаций (при hover на текстуру)

---

## Зависимости между фазами

```
Фаза 1 (Модель данных) ─────┐
                              ├──→ Фаза 2 (API) ──→ Фаза 5 (Конфигуратор) ──┐
Фаза 3 (Шрифты/тема) ───────┤                                                ├──→ Фаза 7 (Интеграция)
                              ├──→ Фаза 4 (Каталог) ─────────────────────────┤         │
                              │                                                │         ▼
                              └──→ Фаза 6 (Админка) ──────────────────────────┘    Фаза 8 (QA)
```

- Фазы 3 и 4 можно делать параллельно с Фазой 1-2
- Фаза 5 зависит от Фазы 2 (API готово)
- Фаза 6 зависит от Фазы 2 (Admin API готово)
- Фаза 7 зависит от всех предыдущих
- Фаза 8 — финальная проверка

---

## Риски и mitigation

| Риск | Вероятность | Mitigation |
|------|-------------|-----------|
| Много комбинаций без изображений при запуске | Высокая | Fallback на preview_image (белый силуэт) + placeholder "Фото готовится" |
| Медленная загрузка variant-images | Средняя | Lazy load + skeleton + prefetch при hover |
| Сломается checkout для старых заказов | Низкая | Опциональные поля texture_* с default="" |
| Большой объём загрузок в админке | Средняя | Batch-upload UI, drag-n-drop, progress indicators |

---

## Чеклист готовности к production

- [ ] Все фазы завершены
- [ ] Backend-тесты проходят (`pytest`)
- [ ] Frontend-тесты проходят (`vitest`)
- [ ] Type-check проходит (`tsc --noEmit`)
- [ ] Нет регрессий в существующем функционале
- [ ] Мобильная адаптация проверена
- [ ] Админка позволяет полный цикл: создать текстуру → цвет → загрузить фото
- [ ] Конфигуратор корректно работает при отсутствии variant-image (fallback)
- [ ] Шрифты применены на всех страницах
