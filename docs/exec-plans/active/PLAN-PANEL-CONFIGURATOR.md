# PLAN: Конфигуратор панелей (Apple-style)

**Статус:** In Progress (Phase 4 Complete)  
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

## Фаза 1: Модель данных (Backend) ✅ DONE

### 1.1 Новые сущности домена

**Файлы (реализовано):**
- `backend/app/domain/catalog/texture.py` — агрегат Texture
- `backend/app/domain/catalog/texture_color.py` — сущность TextureColor
- `backend/app/domain/catalog/variant_image.py` — сущность VariantImage

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

**Файлы (реализовано):**
- `backend/app/domain/catalog/repositories.py` — абстрактные интерфейсы (TextureRepository, TextureColorRepository, VariantImageRepository)
- `backend/app/infrastructure/persistence/repositories/memory.py` — InMemory-реализации
- `backend/app/container.py` — DI-синглтоны + FastAPI dependencies
- `backend/app/infrastructure/persistence/repositories/sql.py` — маппинг preview_image + texture fields

**Интерфейсы:**
- `TextureRepository`: get_by_id, get_by_slug, list_all(include_inactive), create, update, delete
- `TextureColorRepository`: get_by_id, list_by_texture(include_inactive), create, update, delete
- `VariantImageRepository`: get_by_combination, list_by_design, list_by_texture, create, delete

### 1.3 Миграции БД (Alembic)

**Файл (реализовано):** `backend/alembic/versions/018_create_textures_and_variants.py`

Таблицы:
- `textures` (id, name, slug UNIQUE, swatch_image, sort_order, is_active, created_at)
- `texture_colors` (id, texture_id FK ON DELETE CASCADE, name, hex, swatch_image, sort_order, is_active, created_at)
- `variant_images` (id, design_id FK, texture_id FK, color_id FK, image_path, created_at, UNIQUE(design_id, texture_id, color_id))
- ALTER TABLE `designs` ADD COLUMN `preview_image` VARCHAR(500) DEFAULT ""
- ALTER TABLE `order_items` ADD COLUMNS: `texture_name` VARCHAR(255) DEFAULT "", `texture_id` VARCHAR(36) DEFAULT "", `color_id` VARCHAR(36) DEFAULT ""

**Важно (mitigation R4):**
- Все новые колонки — nullable / server_default="" (не блокируют существующие записи)
- FK `texture_colors.texture_id` → ON DELETE CASCADE (удаление текстуры каскадно удаляет цвета)
- FK `variant_images` → ON DELETE RESTRICT (нельзя удалить текстуру/цвет если есть изображения)
- Добавить downgrade: DROP TABLE variant_images, texture_colors, textures; DROP COLUMN preview_image
- Тестировать миграцию на копии prod-данных перед деплоем

### 1.4 Расширение Design

**Файл:** `backend/app/domain/catalog/entities.py`

Добавить поле:
```python
preview_image: str = ""  # Белый силуэт формы для каталога
```

Поле `colors` в Design остаётся для обратной совместимости (legacy), но в новом флоу цвета берутся из TextureColor.

### 1.5 Тесты (Backend, Фаза 1)

**Файлы (реализовано):**
- `backend/tests/domain/catalog/test_texture.py` — unit-тесты сущностей (12 тестов)
- `backend/tests/domain/catalog/test_texture_repos.py` — тесты in-memory репозиториев (19 тестов)
- `backend/tests/infrastructure/test_alembic.py` — обновлено: head="018", Phase 12 table checks

**Покрытие:**
- [x] Создание Texture с валидными данными
- [x] Создание TextureColor, привязка к Texture, валидация hex
- [x] Создание VariantImage, уникальность комбинации
- [x] Деактивация Texture → скрытие через list_all(include_inactive=False)
- [x] Репозиторий: CRUD-операции для всех новых сущностей (31 тест, все pass)
- [x] Alembic: upgrade head → "018", все таблицы Phase 12 создаются, round-trip clean (6 pass)

### 1.6 Результат ревью (2026-05-04)

**Критические проблемы (исправлены):**
1. `test_alembic.py` ожидал revision "017", а head стал "018" → обновлено
2. `container.py` — SQL deps `["texture"]` вызвали бы KeyError в production → добавлен guard с fallback на in-memory

**Некритические (тех.долг, не блокируют):**
- `VariantImage.image_path` не валидируется на пустоту — контроль будет на уровне API/use-case в Phase 2
- `datetime.utcnow` deprecated в Python 3.12+ — pre-existing конвенция проекта, fix за scope Phase 12
- Нет явного теста `Design(preview_image="...")` — trivial, поле str с default

**Подтверждённая стабильность:**
- 242 domain-тестов pass, 0 regressions
- 216 admin API tests pass (catalog CRUD, orders, panels, banners, etc.)
- 37 Phase 1 tests pass (texture entities, repos, alembic migration)
- 6 fails в `test_api.py` — pre-existing (проверено на коммите до Phase 1)
- DI container: InMemory repos инжектятся корректно

**Повторная проверка (2026-05-04):** Новых проблем не обнаружено. Phase 1 стабильна, готовность к Phase 2 подтверждена.

---

## Фаза 2: API эндпоинты (Backend) ✅ DONE

### 2.1 Публичное API

**Файл:** `backend/app/infrastructure/api/public/catalog.py` (расширение существующего)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/designs` | Список форм (добавить `preview_image`; `default_colors` отложен → Phase 7.3, mitigation R3) |
| GET | `/api/designs/{id}` | Детали формы |
| GET | `/api/designs/{id}/textures` | Текстуры для формы (только с ≥1 активным цветом, mitigation E2) |
| GET | `/api/designs/{id}/full-config` | **NEW (mitigation R6):** Форма + все текстуры + цвета + variant-image paths одним запросом |
| GET | `/api/textures` | Все активные текстуры |
| GET | `/api/textures/{id}/colors` | Цвета текстуры (активные) |
| GET | `/api/designs/{id}/variant-image` | Получить изображение по query: `?texture_id=...&color_id=...` |

**Важно (mitigation R6 — N+1 запросов):**
Endpoint `/api/designs/{id}/full-config` возвращает всё необходимое для рендера конфигуратора одним запросом. Используется при первичной загрузке ProductPage. Отдельные endpoints `/variant-image` — для lazy-load при смене выбора.

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
  "is_popular": false,
  "default_colors": [
    { "hex": "#8C8C8C", "name": "Серый" },
    { "hex": "#F5F5F5", "name": "Белый" }
  ]
}
```

**Поле `default_colors` (mitigation R3):** Denormalized — первые 4 цвета из первой текстуры формы. Нужно для HomePage (PopularProductsSection) и каталога, чтобы не делать дополнительные запросы.

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

**Файлы (реализовано):**
- `backend/tests/application/catalog/test_texture_use_cases.py` — 32 теста use cases
- `backend/tests/api/test_textures_public.py` — 15 тестов публичного API
- `backend/tests/api/admin/test_textures.py` — 24 теста админ API

**Покрытие:**
- [x] GET /api/textures — возвращает только активные (15 тестов)
- [x] GET /api/textures/{id}/colors — цвета текстуры (активные)
- [x] GET /api/designs/{id}/textures — текстуры с цветами для формы, фильтр по наличию variant-images и активных цветов
- [x] GET /api/designs/{id}/variant-image — 200 с путём, 404 если не найдено, 422 при отсутствии params
- [x] GET /api/designs/{id}/full-config — полная конфигурация одним запросом (mitigation R6)
- [x] GET /api/designs — preview_image поле в ответе
- [x] Admin CRUD текстур — создание (201), обновление (200), удаление (204), slug conflict (409), not found (404)
- [x] Admin CRUD цветов — привязка к текстуре, not found текстуры (404), not found цвета (404)
- [x] Admin variant-images — создание (201), уникальность комбинации (409), не найден design (404), удаление (204)
- [x] Проверка авторизации — 401 без токена, 403 с customer-токеном
- [x] Удаление текстуры с variant-images заблокировано (409, mitigation E3)

### 2.5 Результат реализации (2026-05-04)

**Созданные файлы:**
- `backend/app/domain/catalog/texture_exceptions.py` — 6 доменных исключений
- `backend/app/application/catalog/texture_use_cases.py` — 12 use cases (Texture + TextureColor CRUD)
- `backend/app/application/catalog/variant_image_use_cases.py` — 5 use cases (VariantImage CRUD + query)
- `backend/app/infrastructure/api/admin/textures.py` — Admin API router (11 endpoints)
- `backend/app/infrastructure/api/catalog.py` — расширен 6 публичными endpoints + preview_image в Design schema
- `backend/app/infrastructure/api/error_handlers.py` — 6 новых exception handlers
- `backend/app/infrastructure/api/admin/__init__.py` — регистрация textures router
- `backend/app/main.py` — регистрация exception handlers

**Подтверждённая стабильность:**
- 242 domain тестов pass, 0 regressions
- 297 application тестов pass (включая 32 новых texture/variant use case тестов)
- 217 admin API тестов pass (включая 24 новых texture admin тестов)
- 74 non-admin API тестов pass (включая 17 новых texture public тестов)
- 33 visualizer тестов pass
- 28 infrastructure тестов pass
- 6 fails в `test_api.py` — pre-existing, не связаны с Phase 2

### 2.6 Результат ревью (2026-05-04)

**Критические проблемы (исправлены в коммите 1):**
1. `catalog.py:220` — detail endpoint `GET /api/designs/{id}` не включал `preview_image` в ответ (list endpoint включал). Конфигуратор (Phase 5) зависит от этого поля. **Исправлено, тест добавлен.**
2. `catalog.py:451` — endpoint `GET /api/designs/{id}/variant-image` не проверял `design.is_published`, нарушая security-позицию Phase 7A (остальные design-scoped endpoints проверяли). **Исправлено, тест добавлен.**

**Некритические проблемы (все исправлены в коммите 2):**
- N1: `UpdateTextureAdmin` slug check — добавлен `existing.id != texture.id` guard для консистентности с паттерном `panel_use_cases.py`. Тест `test_self_slug_no_conflict` добавлен.
- N2: `UpdateTextureColorAdmin` обходил hex-валидацию `__post_init__` при мутации — добавлен вызов `TextureColor.check_hex(hex)` перед присвоением. Метод `check_hex` вынесен из `__post_init__` как `@staticmethod` для reuse. Тесты `test_invalid_hex_rejected` и `test_clear_hex_allowed` добавлены.
- N3: `TextureColorCreate.hex` и `TextureColorUpdate.hex` Pydantic schemas — добавлен `pattern=r"^(#[0-9A-Fa-f]{6})?$"` для валидации на API boundary. Тесты `test_invalid_hex_422` и `test_invalid_hex_update_422` добавлены.
- N4: `ListVariantImagesAdmin` возвращает `[]` без фильтра — **оставлено by design**: (1) добавление `list_all` требует расширения абстрактного репозитория + обеих реализаций, (2) количество комбинаций может быть 200+ (по плану R7), (3) админ-UI (Phase 6) всегда будет передавать фильтр из dropdown.
- N5: `default_colors` — **перенесён из scope Phase 2 в Phase 7.3** (mitigation R3). Phase 2 spec обновлён ниже.

**Обновлённая стабильность после ревью:**
- 242 domain тестов pass (включая 12 texture domain), 0 regressions
- 300 application тестов pass (включая 35 texture/variant use case тестов, +3 от ревью)
- 219 admin API тестов pass (включая 26 texture admin тестов, +2 от ревью)
- 74 non-admin API тестов pass (включая 17 texture public тестов, +2 от ревью)
- 6 fails в `test_api.py` — pre-existing

---

## Фаза 3: Шрифты и визуальный язык (Frontend) ✅ DONE

### 3.1 Замена шрифтов (реализовано)

- Font stack: `-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', system-ui, sans-serif`
- На macOS/iOS — настоящий SF Pro, на остальных — Inter
- `index.html` — preconnect к Google Fonts

### 3.2 Обновление темы (реализовано)

- `borderRadius`: 16px (cards), 12px (buttons/inputs)
- Сохранён accent `#4CAF50` — фирменный цвет бренда
- Упрощены shadows, увеличено белое пространство
- Letter-spacing: `-0.02em` для заголовков

### 3.3 Тесты (реализовано)

- `frontend/src/shared/__tests__/theme.test.ts` — snapshot-тест + fontFamily assertion
- [x] Snapshot-тест темы
- [x] fontFamily содержит system-ui fallback

---

## Фаза 4: Каталог форм (Frontend) ✅ DONE

### 4.1 Переработка CatalogPage (реализовано)

**Файл:** `frontend/src/domains/catalog/ui/CatalogPage.tsx` — полная переработка (283 строки)

**Новый UI:**
- Заголовок "Выберите форму панели" + subtitle
- Responsive grid: 3 колонки desktop, 2 tablet (≤1024px), 1 mobile (≤640px)
- FormCard: previewImage на #F0F0F0 фоне (aspect-ratio 1:1), название, "от X ₽", бейдж
- Hover: translateY(-4px) scale(1.015) + shadow (Apple-style)
- Поиск по названию формы
- Fade-up анимация (framer-motion) с staggered delay

**Убрано по плану:**
- Фильтры (цвет, стиль, цена), категории, view modes (grid/list), сортировка
- Кнопки "В корзину" / "Избранное" / "Визуализатор"
- Зависимости: `useCategories`, `useCartStore`, `useAccountStore`

### 4.2 API-адаптер (реализовано)

- `ApiDesign.preview_image: string` добавлен в `shared/api/types.ts:31`
- `PanelProduct.previewImage: string` добавлен в `catalog/model/types.ts:11`
- `apiDesignToProduct`: маппинг `previewImage: d.preview_image || ''`
- 12 mock products в `data.ts` дополнены `previewImage: ''`

### 4.3 CSS (реализовано)

- `index.css` — `.catalog-forms-grid` с 3 responsive breakpoints
- Dead CSS: `.catalog-filters` осталась orphan (cleanup в Фазе 8)

### 4.4 Тесты (реализовано)

**Файл:** `frontend/src/domains/catalog/__tests__/CatalogPage.test.tsx` — 9 тестов

- [x] Loading skeletons при isLoading
- [x] Рендерит карточки форм из API data
- [x] preview_image в src каждой карточки
- [x] Fallback на image при пустом preview_image
- [x] Клик навигирует на /product/:id
- [x] Бейджи "Новинка" / "Популярное"
- [x] Empty state при пустом поиске
- [x] Фильтрация по поисковому запросу
- [x] Цена с префиксом "от"

**Дополнительно обновлены тесты:**
- `adapters.test.ts` — fixture + тест previewImage маппинга (+8 строк)
- `types.test.ts` — fixtures `role`, `preview_image` для TS compliance

### 4.5 Результат ревью (2026-05-04)

**Критические проблемы:** 0

**Некритические проблемы:**
- N1: Dead CSS `.catalog-filters` — cleanup в Фазе 8
- N2: `fadeUpVariants: any` — pre-existing framer-motion typing issue

**Подтверждённая стабильность:**
- 9 CatalogPage тестов pass
- 10 adapters тестов pass (включая новый previewImage)
- 8 types тестов pass
- 3 ProductPage.recommendations тестов pass
- 0 regressions в HomePage, ProductPage, FavoritesSection

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
│  │                      │  │  Размер:            │  │
│  │                      │  │  [30×30] [30×60]    │  │
│  │                      │  │  [60×60]            │  │
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
2. По умолчанию выбрана первая текстура, первый цвет и первый размер
3. При смене текстуры — обновляем доступные цвета, выбираем первый
4. При смене цвета — загружаем variant-image для комбинации (форма + текстура + цвет)
5. При смене размера — пересчитываем цену (размер влияет на base_price)
6. Если variant-image не найден — показываем placeholder (белый силуэт)
7. Preview-изображение плавно меняется (fade transition)

**Секция "Другие формы":**
- Горизонтальный скролл миниатюр других форм
- Клик → навигация на `/product/:другой_id`
- Текущая форма выделена (border/ring)

### 5.2 Компоненты конфигуратора

**Новые файлы:**
- `frontend/src/domains/catalog/ui/components/TextureSelector.tsx`
- `frontend/src/domains/catalog/ui/components/ColorSelector.tsx`
- `frontend/src/domains/catalog/ui/components/SizeSelector.tsx`
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

**SizeSelector:**
- Кнопки размеров: 30×30 см, 30×60 см, 60×60 см (из существующих PanelSize VO)
- Активный размер — выделен фоном/рамкой
- При смене размера — пересчёт цены (base_price зависит от размера: 890 / 1490 / 2490 ₽)
- Итоговая цена = base_price(размер) + design.price

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
- Оркестрирует выбор: текстура → цвет → размер → цена → кнопка "В корзину"
- Порядок секций в конфигураторе: Текстура → Цвет → Размер → Количество → Итого + CTA
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
  id: string;           // `${productId}-${textureId}-${colorId}-${sizeKey}`
  productId: string;
  name: string;
  image: string;
  price: number;        // unit_price = base_price(size) + design.price
  quantity: number;
  area: number;
  color: string;        // hex
  colorName: string;
  size: string;         // label: "30×30 см" (СОХРАНЯЕМ — существующее поле)
  sizeKey: string;      // NEW: ключ размера "300x300" для backend
  textureName: string;  // NEW: название текстуры
  textureId: string;    // NEW: id текстуры
  colorId: string;      // NEW: id цвета
}
```

**Важно:** Composite ID теперь включает `sizeKey` — одну форму с одной текстурой/цветом но разными размерами добавляем как разные позиции.

**Миграция localStorage (mitigation R5):**
При инициализации cartStore — валидировать каждый item из localStorage:
```typescript
// Если item не содержит textureId — удалить из корзины (graceful migration)
const migrateCart = (items: CartItem[]) =>
  items.filter(item => 'textureId' in item && item.textureId !== undefined);
```

**Файл:** `frontend/src/domains/order/model/types.ts` — обновить интерфейс

**Файл:** `backend/app/domain/order/entities.py` — расширить OrderItem:
```python
texture_name: str = ""   # Название текстуры
texture_id: str = ""     # ID текстуры (для отчётности)
color_id: str = ""       # ID цвета
```

### 5.5 Адаптация Constructor и Visualizer (mitigation R2)

**Файлы:**
- `frontend/src/domains/constructor/ui/ConstructorPage.tsx`
- `frontend/src/domains/visualizer/ui/PhotoEditorPage.tsx` (если использует Design.colors)

**Проблема:** Constructor напрямую использует `Design.colors[idx]`. После миграции `Design.colors` будет пустой/legacy.

**Решение:**
- Заменить прямой доступ к `Design.colors` на fetch текстур через `useDesignTextures(designId)`
- Цвета брать из первой текстуры (или показать выбор текстуры в Constructor тоже)
- Fallback: если текстур нет — использовать legacy `Design.colors` (обратная совместимость)

**Тест:** Constructor рендерит цвета из текстур и не падает с TypeError.

### 5.6 Тесты (Frontend, Фаза 5)

**Файлы:**
- `frontend/src/domains/catalog/__tests__/ProductPage.test.tsx`
- `frontend/src/domains/catalog/__tests__/TextureSelector.test.tsx`
- `frontend/src/domains/catalog/__tests__/ColorSelector.test.tsx`
- `frontend/src/domains/catalog/__tests__/ConfiguratorPanel.test.tsx`

**Покрытие:**
- [ ] ProductPage: рендерит конфигуратор с текстурами и цветами
- [ ] ProductPage: смена текстуры обновляет доступные цвета
- [ ] ProductPage: смена цвета загружает новое превью
- [ ] ProductPage: добавление в корзину с правильными атрибутами
- [ ] ProductPage: fallback-изображение если variant-image не найден
- [ ] TextureSelector: показывает свотчи текстур, выделяет активную
- [ ] ColorSelector: показывает цвета текущей текстуры, выделяет активный
- [ ] SizeSelector: показывает доступные размеры, пересчитывает цену при смене
- [ ] SizeSelector: разные размеры одной конфигурации — разные позиции в корзине
- [ ] FormSwitcher: показывает другие формы, навигирует при клике
- [ ] ConfiguratorPanel: sticky-поведение на desktop
- [ ] Constructor: рендерит цвета из текстур без TypeError (mitigation R2)
- [ ] Constructor: fallback на legacy Design.colors если текстур нет
- [ ] Cart: graceful migration старых items из localStorage (mitigation R5)

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
- [ ] CRUD текстур: создание, редактирование, удаление
- [ ] CRUD цветов: привязка к текстуре, валидация hex
- [ ] Variant images: загрузка изображения для комбинации
- [ ] Variant images: визуальная матрица с индикацией заполненности
- [ ] Навигация: пункт "Текстуры" в сайдбаре админки

---

## Фаза 7: Интеграция и обратная совместимость

### 7.1 Миграция данных

**Задачи:**
- Существующие Design.colors → НЕ удаляем, помечаем как legacy
- Публичное API `/api/designs` продолжает возвращать `colors` для обратной совместимости
- Конфигуратор использует только текстуры/цвета из новых эндпоинтов
- Если у формы нет текстур — показываем "Скоро" placeholder (E1)
- Вычисляем `default_colors` из первой текстуры для каждого Design (mitigation R3)

### 7.2 OrderItem — обратная совместимость (mitigation R1)

**Файл:** `backend/app/domain/order/entities.py`

Поля `texture_name`, `texture_id`, `color_id` — опциональные (default=""). Старые заказы не ломаются.

**Логика рендера заказа:**
```python
# Если texture_id пуст — это legacy-заказ, отображаем по-старому:
# "Design Name — Color Name"
# Если texture_id заполнен — новый формат:
# "Form Name — Texture Name, Color Name"
```

**Файл:** `backend/app/infrastructure/api/public/orders.py`

Добавить в OrderItemCreate:
```python
texture_name: str = ""
texture_id: str = ""
color_id: str = ""
```

**Файл:** `frontend/src/domains/order/ui/CheckoutPage.tsx`
- Если `item.textureId` есть → "Волна — Бетон, Серый"
- Если нет → legacy формат "Design Name — Color"

### 7.3 HomePage адаптация (mitigation R3)

**Файл:** `frontend/src/domains/content/ui/HomePage.tsx`

`PopularProductsSection` использует `product.colors.slice(0, 4)`. Решение:
- API `/api/designs` возвращает `default_colors` (denormalized из первой текстуры)
- Адаптер `apiDesignToProduct` маппит `default_colors` → `colors` для обратной совместимости с UI-компонентами
- Если `default_colors` пуст — не показываем цветовые точки (graceful degradation)

### 7.4 SEO обновление (mitigation R9)

**Файл:** `frontend/src/domains/catalog/ui/ProductPage.tsx` (PageMeta)

Обновить мета-теги:
- `og:title` → "Панель {form_name} | Wonder Wow Wall"
- `og:description` → Design.description (без упоминания overlay)
- Structured data → Product schema с конфигурируемыми вариантами

### 7.5 Тесты (Фаза 7)

- [ ] E2E: старые заказы (без texture_id) отображаются в legacy-формате
- [ ] E2E: новые заказы (с texture_id) отображаются в новом формате
- [ ] API: OrderItemCreate с пустыми texture_* проходит валидацию
- [ ] API: `/api/designs` возвращает default_colors
- [ ] Checkout: корректное отображение обоих форматов (legacy + new)
- [ ] HomePage: PopularProductsSection рендерит default_colors
- [ ] Cart migration: старые items из localStorage удаляются gracefully

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

## Ограничения среды разработки (sandbox)

**RAM ограничен.** Sandbox имеет слабые ресурсы — запуск всех тестов разом вызывает OOM и крашит среду.

**Правила запуска тестов:**
- **Backend (pytest):** запускать по одному файлу или маленькими батчами:
  ```bash
  pytest tests/domain/test_texture.py -v
  pytest tests/api/test_textures_public.py -v
  ```
  Никогда не запускать `pytest` без указания конкретного файла/папки.

- **Frontend (vitest):** запускать по одному тест-файлу:
  ```bash
  NODE_OPTIONS='--max-old-space-size=512' npx vitest run src/domains/catalog/__tests__/ProductPage.test.tsx
  ```
  Никогда не запускать `npx vitest run` без фильтра — sandbox крашится.

- **Type-check (tsc):** запускать с ограничением памяти:
  ```bash
  NODE_OPTIONS='--max-old-space-size=512' npx tsc --noEmit
  ```

- **Build:** аналогично:
  ```bash
  NODE_OPTIONS='--max-old-space-size=512' npm run build
  ```

**При реализации каждой фазы** — запускать тесты инкрементально: только новые/изменённые файлы. Полный прогон — только в Фазе 8 (QA), и то по батчам.

---

## Зависимости между фазами

```
Фаза 1 (Модель данных) ─────┐
                              ├──→ Фаза 2 (API) ──┬──→ Фаза 5 (Конфигуратор + Constructor) ──┐
Фаза 3 (Шрифты/тема) ───────┤                    │                                            │
                              ├──→ Фаза 4 (Каталог, зависит от default_colors в API) ─────────┤
                              │                    │                                            ├──→ Фаза 7 (Интеграция)
                              └────────────────────┴──→ Фаза 6 (Админка) ─────────────────────┤         │
                                                                                               │         ▼
                                                                                               └───  Фаза 8 (QA)
```

**Критические зависимости:**
- Фаза 3 (шрифты) — независима, можно делать в любой момент
- Фаза 4 (каталог) зависит от Фазы 2: endpoint `/api/designs` должен возвращать `preview_image` и `default_colors`
- Фаза 5 (конфигуратор) зависит от Фазы 2: endpoints текстур и variant-images
- Фаза 5 включает адаптацию Constructor (R2) — зависит от тех же API текстур
- Фаза 6 (админка) зависит от Фазы 2: Admin API текстур
- Фаза 7 зависит от Фаз 4, 5, 6 — интегрирует всё вместе
- Фаза 8 — финальная проверка после всех интеграций

**Безопасный порядок реализации:**
1. Фаза 1 → 2 (backend foundation, ничего не ломает)
2. Фаза 3 (шрифты, параллельно с 1-2)
3. Фаза 6 (админка — чтобы можно было наполнить текстуры данными)
4. Фаза 4 (каталог — после наполнения данными)
5. Фаза 5 (конфигуратор + constructor — основной риск, после наличия данных и API)
6. Фаза 7 (интеграция)
7. Фаза 8 (QA)

---

## Риски и mitigation

### КРИТИЧЕСКИЕ РИСКИ

| # | Фаза | Риск | Описание | Mitigation |
|---|------|------|----------|-----------|
| R1 | 1, 5 | **Регрессия заказов** | Существующие `OrderItem` хранят `design_id` + `color` (hex из Design.colors). После миграции Design означает "форму", а цвета переехали в TextureColor. Старые заказы отрендерят неправильные данные. | Поля `texture_id`, `color_id` добавить как nullable (default=""). Старые заказы продолжают отображаться по старой логике. В OrderItem добавить флаг `is_legacy: bool = False` — если True, рендерим по-старому. |
| R2 | 4, 5 | **Constructor/Visualizer ломается** | `ConstructorPage.tsx` напрямую обращается к `Design.colors[idx]`. После перехода на формы — `colors` будет пустой массив, `selectedDesign.colors[selectedColorIdx]` → TypeError. | В Фазе 5 обязательно обновить Constructor: заменить `Design.colors` на fetch текстур через API. Добавить задачу "Адаптировать Constructor к новой модели" как подзадачу Фазы 5. |
| R3 | 4 | **Homepage ломается** | `HomePage.tsx` → `PopularProductsSection` рендерит `product.colors.slice(0, 4)` как цветные точки. После миграции colors=[] → секция пустая. | В CatalogPage адаптере: если `Design.colors` пуст, подставить первые цвета из первой текстуры (дополнительный API-запрос или denormalized поле `default_colors` в Design response). |
| R4 | 1 | **Миграция БД на проде** | Создание 3 новых таблиц + ALTER TABLE designs ADD COLUMN preview_image. При больших таблицах ALTER может залочить БД. | Использовать `server_default=""` для preview_image. Для texture_colors FK → ON DELETE CASCADE. Миграцию тестировать на копии prod-данных. |

### СРЕДНИЕ РИСКИ

| # | Фаза | Риск | Описание | Mitigation |
|---|------|------|----------|-----------|
| R5 | 5 | **Compound cart ID ломает localStorage** | Текущий cart ID: `${productId}-${colorIdx}-${sizeIdx}`. Новый: `${productId}-${textureId}-${colorId}`. У пользователей с существующими корзинами в localStorage сломается десериализация. | При загрузке cartStore: валидировать структуру items. Если item не содержит `textureId` — удалить из корзины (graceful migration). |
| R6 | 2 | **N+1 запросов в конфигураторе** | План предлагает: загрузить форму → загрузить текстуры → по смене цвета загрузить variant-image. Это 3+ последовательных запроса при каждом открытии продукта. | Добавить endpoint `GET /api/designs/{id}/full-config` возвращающий форму + текстуры + цвета + все variant-image paths одним запросом. Отдельные endpoints оставить для конфигуратора (lazy load при смене). |
| R7 | 6 | **Количество комбинаций при загрузке в админке** | 10 форм × 5 текстур × 4 цвета = 200 изображений. Загрузка вручную — очень трудоёмко. | Batch-upload по конвенции именования файлов: `{form-slug}_{texture-slug}_{color-slug}.jpg`. Админка парсит имена и автоматически привязывает. |
| R8 | 5 | **Favorites используют mock data** | `FavoritesSection.tsx` фильтрует `products.filter(p => favoriteIds.includes(p.id))` из статичных данных. Если перейдём на API — favorites станут пустыми. | Перевести Favorites на API (useDesigns с filter по ids), либо оставить mock до отдельного рефакторинга. |
| R9 | 7 | **SEO-мета на ProductPage** | Если PageMeta рендерит `design.style` или `design.category_id` в og:description — после миграции текст может стать бессмысленным. | Обновить PageMeta на ProductPage: title = "Панель {form_name} — {texture} {color}", description из Design.description. |

### НИЗКИЕ РИСКИ

| # | Фаза | Риск | Описание | Mitigation |
|---|------|------|----------|-----------|
| R10 | — | Много комбинаций без изображений при запуске | Высокая вероятность, что не все комбинации будут заполнены фото в первый день. | Fallback на `preview_image` (белый силуэт) + placeholder "Фото готовится". В админке — индикатор процента заполненности. |
| R11 | 5 | Медленная загрузка variant-images | Каждое фото ~1 МБ, при быстрой смене цветов — задержки. | Lazy load + skeleton + prefetch при hover на свотч. WebP format. Thumbs (300px) для быстрой загрузки + full-size по клику. |
| R12 | 6 | Большой объём загрузок в админке | 200+ фото нужно загрузить вручную. | Batch-upload через drag-n-drop зоны, progress indicators, конвенция именования. |

---

## Edge Cases (не покрыты в основных фазах)

| # | Ситуация | Ожидаемое поведение | Где обработать |
|---|----------|--------------------|----|
| E1 | Форма без текстур | Конфигуратор показывает "Текстуры скоро появятся", preview = белый силуэт, кнопка "В корзину" неактивна | Фаза 5: ConfiguratorPanel |
| E2 | Текстура без цветов | Текстура не отображается в конфигураторе (фильтруем на API-уровне: только текстуры с ≥1 активным цветом) | Фаза 2: endpoint filter |
| E3 | Удаление текстуры, у которой есть variant-images | API возвращает 409 Conflict. Админ должен сначала удалить изображения. | Фаза 2: DeleteTexture use case |
| E4 | Удаление цвета, привязанного к существующим заказам | Не удалять физически, только деактивировать (`is_active=false`). Старые заказы продолжают отображать название цвета (сохранено в OrderItem.colorName). | Фаза 2: API validation |
| E5 | Пользователь открывает старую ссылку `/product/:id` с overlay-дизайном | ID остаётся тем же — Design entity та же, просто поменялась семантика. Если у этого Design нет текстур — показать E1 fallback. | Фаза 5: ProductPage |
| E6 | Добавление в корзину при отсутствии variant-image | Разрешить: в корзину добавляется товар с preview_image (силуэт), текстура/цвет сохраняются. | Фаза 5: handleAddToCart |
| E7 | Параллельное редактирование текстур в админке (два админа) | Optimistic locking через `updated_at` timestamp. PATCH с устаревшим timestamp → 409 Conflict. | Фаза 2: admin API |
| E8 | Design с `is_published=false` но есть variant-images | Variant-images не отображаются публично (фильтр по `Design.is_published`). В админке — видны. | Фаза 2: public API filter |

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
