# Plan: Фото-редактор стен v2 (Visualizer Domain)

> Пофазный план доработки фото-редактора стен.
> Bounded Context: `visualizer`
> Связано: [Product Spec](../../product-specs/PHOTO-WALL-EDITOR.md) | [Architecture](../../design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md)
> **Создан: 07.04.2026** | Заменяет: `PLAN-PHOTO-EDITOR.md` (v1)

---

## Принципы плана

- **Без платных API** — вся ML-обработка в браузере (`@huggingface/transformers`)
- **Без GPU-серверов** — бэкенд только для CRUD (сохранение проектов)
- **Минимум кастомного кода** — `react-konva` вместо raw Canvas, `perspective-transform` вместо WebGL
- **Инкрементально** — каждая фаза даёт рабочий результат, можно остановиться после любой

---

## Что уже реализовано (baseline)

Перед началом работ по этому плану в визуализаторе уже работает:

| Компонент | Статус | Файл |
|---|---|---|
| Загрузка фото (drag & drop, file, camera) | ✅ | `ui/PhotoUploader.tsx` |
| Zustand store (scene, layout, mask, undo) | ✅ | `model/visualizerStore.ts` |
| Типы (WallMask, PlacedPanel, CostBreakdown) | ✅ | `model/types.ts` |
| ACL → корзина (PlacedPanel → CartItem) | ✅ | `model/adapters.ts` |
| Валидация и ресайз изображений | ✅ | `lib/imageProcessing.ts` |
| Маска: кисть, ластик, undo (20 шагов) | ✅ | `lib/maskUtils.ts`, `ui/MaskToolbar.tsx` |
| Layout engine (auto/manual/accent) | ✅ | `lib/layoutEngine.ts` |
| Расчёт стоимости + подписка | ✅ | `lib/costCalculator.ts` |
| Canvas рендеринг (фото + маска + панели) | ✅ | `ui/WallCanvas.tsx` |
| Zoom & Pan (mouse + touch + pinch) | ✅ | `ui/WallCanvas.tsx` |
| Touch painting (кисть/ластик) | ✅ | `ui/WallCanvas.tsx` |
| Акцентная зона (рисование + заполнение) | ✅ | `ui/WallCanvas.tsx` |
| Hover-подсветка ячейки | ✅ | `ui/WallCanvas.tsx` |
| Удаление панели (UI кнопка) | ✅ | `ui/WallCanvas.tsx` |
| Выбор дизайна/размера/цвета | ✅ | `ui/PanelPicker.tsx` |
| Режимы размещения (авто/вручную/зона) | ✅ | `ui/PlacementControls.tsx` |
| Стоимость + «В корзину» | ✅ | `ui/CostSummary.tsx` |
| Before/After слайдер | ✅ | `ui/BeforeAfterSlider.tsx` |
| Экспорт canvas → JPEG | ✅ | `ui/PhotoEditorPage.tsx` |
| Persist в localStorage (ручной) | ✅ | `model/visualizerStore.ts` |
| 90 тестов (unit + integration + component) | ✅ | `__tests__/` |
| Кнопка «Примерить на фото» в CatalogPage | ✅ | `domains/catalog/ui/CatalogPage.tsx` |
| Кнопка «Примерить на фото» в ProductPage | ✅ | `domains/catalog/ui/ProductPage.tsx` |

---

## Фаза 1: ML-сегментация в браузере

> **Цель:** Заменить заглушку (белая маска) на реальное распознавание стены и объектов.
> **Технология:** `@huggingface/transformers` + SegFormer-B0 (ADE20K, 150 классов)
> **Результат:** После загрузки фото пользователь видит реальную маску стены

### 1.1 Frontend — Сервис сегментации

- [ ] Установить `@huggingface/transformers` (`npm install @huggingface/transformers`)
- [ ] Создать `src/domains/visualizer/lib/segmentationService.ts`:
  - Функция `initSegmenter()` — lazy-загрузка модели `Xenova/segformer-b0-finetuned-ade-512-512`
  - Функция `segmentScene(imageUrl: string): Promise<SegmentationResult>` — запуск inference
  - Тип `SegmentationResult`: `{ wallMask: WallMask, obstacles: Obstacle[], classes: string[] }`
  - Извлечение класса `wall` → `WallMask` (Uint8Array, 0/255)
  - Извлечение классов `door`, `window`, `furniture`, `table`, `chair`, `sofa`, `bed` → `Obstacle[]`
  - Кэширование модели (модель кэшируется в IndexedDB автоматически библиотекой)
  - Graceful fallback: если браузер не поддерживает WASM/WebGPU — возвращать пустую маску (текущее поведение)

### 1.2 Frontend — Интеграция в store и UI

- [ ] Обновить `visualizerStore.ts`:
  - Заменить mock-маску на вызов `segmentScene()` в action `uploadPhoto()`
  - Добавить `segmentationProgress: number` (0–100) для прогресс-бара
  - Статусы: `idle` → `uploading` → `loading-model` → `segmenting` → `ready` / `error`
- [ ] Обновить `PhotoEditorPage.tsx`:
  - Прогресс-бар загрузки модели (при первом использовании, ~15 MB)
  - Текстовые статусы: «Загружаем модель...» → «Распознаём стену...» → «Готово»
  - При ошибке: fallback на ручную маску с сообщением «Отметьте стену кистью»
- [ ] Обновить `layoutEngine.ts`:
  - `autoFillWall()` и `placeSinglePanel()` уже проверяют `wallCoverageInRect()` — убедиться, что с реальной маской порог 0.7 работает корректно
  - При наличии `obstacles` — добавить проверку пересечения панели с obstacle bounding box

### 1.3 Тесты

- [ ] Unit-тесты `segmentationService.test.ts`:
  - Mock `pipeline()` → проверить преобразование результата в `WallMask` и `Obstacle[]`
  - Тест fallback при ошибке загрузки модели
  - Тест кэширования (повторный вызов не инициализирует модель)
- [ ] Обновить `layoutEngine.test.ts`:
  - Тесты размещения с реальной маской (не полностью белой)
  - Тесты коллизии панель-obstacle

---

## Фаза 2: Миграция Canvas на react-konva

> **Цель:** Заменить 526 строк ручного Canvas API на декларативный react-konva. Получить drag & drop панелей, hover, select из коробки.
> **Технология:** `react-konva` + `konva`
> **Результат:** Панели можно перетаскивать, выделять кликом, удалять. Код рендеринга сокращается в ~3 раза.

### 2.1 Frontend — Установка и базовая миграция

- [ ] Установить `react-konva` и `konva` (`npm install react-konva konva`)
- [ ] Создать `src/domains/visualizer/ui/KonvaCanvas.tsx` — замена `WallCanvas.tsx`:
  - `<Stage>` с `width`, `height`, `scaleX/Y` (zoom), `draggable` (pan)
  - `<Layer>` для фото (Konva `<Image>`)
  - `<Layer>` для маски (Konva `<Image>` с opacity из store)
  - `<Layer>` для панелей — каждый `PlacedPanel` → `<Rect>` или `<Group>`:
    - `fill={panel.color}`, `opacity={0.85}`
    - `draggable={true}` — D&D из коробки
    - `onDragEnd` → snap-to-grid + обновление координат в store
    - `onClick` → select panel
    - `onMouseEnter` / `onMouseLeave` → hover-эффект (stroke highlight)
  - `<Layer>` для UI: hover-ячейка (dashed rect), акцентная зона (dashed rect)

### 2.2 Frontend — Маска на Konva

- [ ] Рендеринг маски:
  - Преобразовать `WallMask` → offscreen `<canvas>` → Konva `<Image>`
  - Цвет маски: `rgba(76, 175, 80, opacity)` (зелёный, как сейчас)
  - Переключение видимости: `visible={maskVisible}` на `<Image>`
- [ ] Рисование маски (кисть/ластик):
  - Konva `<Line>` с `globalCompositeOperation` или отдельный offscreen canvas для painting
  - `onMouseDown/Move/Up` + `onTouchStart/Move/End` на Stage → рисование штриха
  - Применение штриха к `WallMask` через существующий `applyStrokeToMask()` из `maskUtils.ts`
  - Undo — без изменений (стек масок уже работает)

### 2.3 Frontend — Zoom, Pan, Touch

- [ ] Zoom: `onWheel` на `<Stage>` → обновить `scaleX/Y` (диапазон 0.25–4x)
- [ ] Pan: `<Stage draggable>` — встроенная функция Konva
- [ ] Pinch-to-zoom: Konva поддерживает touch events, адаптировать текущую логику `touchDist()`
- [ ] Экспорт: `stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.9 })` → download

### 2.4 Frontend — Замена WallCanvas → KonvaCanvas

- [ ] Обновить `PhotoEditorPage.tsx` — заменить `<WallCanvas>` на `<KonvaCanvas>`
- [ ] Удалить `WallCanvas.tsx` после полной миграции
- [ ] Проверить, что все props и callbacks совместимы

### 2.5 Тесты

- [ ] Компонентный тест `KonvaCanvas.test.tsx`:
  - Рендер фото + маска
  - Клик на панель → select
  - D&D панели → обновление координат
  - Zoom scroll
- [ ] Обновить существующие тесты, ссылающиеся на `WallCanvas`

---

## Фаза 3: Перспектива и калибровка

> **Цель:** Панели ложатся в перспективу стены на фото, а не плоскими прямоугольниками.
> **Технология:** `perspective-transform` (3 KB)
> **Результат:** 4 точки по углам стены → панели деформируются под перспективу

### 3.1 Frontend — Калибровка масштаба

- [ ] Создать `src/domains/visualizer/ui/CalibrationOverlay.tsx`:
  - Режим калибровки: пользователь выбирает из пресетов (дверь = 200 см, розетка = 8 см, окно = 120 см) или вводит своё значение
  - 2 клика на фото: отмечает начало и конец известного объекта
  - Расчёт `pixelsPerCm = distanceInPixels / distanceInCm`
  - Обновление `calibration` в store
  - Кнопка «Калибровать» в toolbar (RulerOutlined из `@ant-design/icons`)
- [ ] Обновить `visualizerStore.ts`:
  - Action `setCalibration(pixelsPerCm: number, method: 'manual')`
  - Пересчёт размеров панелей при изменении калибровки
- [ ] Обновить `layoutEngine.ts`:
  - Использовать `calibration.pixelsPerCm` вместо fallback `width / 400`

### 3.2 Frontend — Перспективная трансформация

- [ ] Установить `perspective-transform` (`npm install perspective-transform`)
- [ ] Создать `src/domains/visualizer/lib/perspectiveEngine.ts`:
  - Функция `createPerspective(corners: [Point, Point, Point, Point], wallSize: {w, h}): PerspectiveTransform`
  - Функция `transformPoint(transform, point): Point` — преобразование координат панели
  - Функция `transformRect(transform, rect): [Point, Point, Point, Point]` — 4 угла трансформированного прямоугольника
- [ ] Создать `src/domains/visualizer/ui/PerspectiveCorners.tsx`:
  - 4 перетаскиваемых маркера (Konva `<Circle>`) по углам стены
  - Линии между маркерами (Konva `<Line>`)
  - При drag → пересчёт perspective transform → re-render панелей
  - Кнопка «Перспектива» в toolbar для входа/выхода из режима
- [ ] Обновить `KonvaCanvas.tsx`:
  - Рендер панелей через `<Line points={transformedCorners} closed fill={color}>` вместо `<Rect>` (четырёхугольник с перспективой)
  - D&D адаптировать: drag в экранных координатах → snap-to-grid в координатах стены

### 3.3 Frontend — Улучшение визуализации

- [ ] Подгонка яркости панелей под фото:
  - Простой анализ: средняя яркость области стены (из маски) → `brightness()` CSS-фильтр на слое панелей
  - Konva `<Layer>` поддерживает filters: `Konva.Filters.Brighten`
- [ ] Тень под панелями:
  - Konva `shadowColor`, `shadowBlur`, `shadowOffset` на каждой панели
  - Лёгкая тень: `shadowColor: 'rgba(0,0,0,0.15)', shadowBlur: 4, shadowOffsetY: 2`

### 3.4 Тесты

- [ ] Unit-тесты `perspectiveEngine.test.ts`:
  - Идентичная трансформация (прямоугольник → прямоугольник)
  - Трапецоидная перспектива
  - Обратная трансформация (экран → стена)
- [ ] Unit-тест `CalibrationOverlay`: выбор пресета → расчёт pixelsPerCm

---

## Фаза 4: Бэкенд — Сохранение проектов визуализации

> **Цель:** Пользователь может сохранять и загружать проекты визуализации (с фото, маской, панелями).
> **Результат:** CRUD API для проектов визуализации в PostgreSQL

### 4.1 Backend — Domain Layer

- [ ] Создать `app/domain/visualizer/__init__.py`
- [ ] Создать `app/domain/visualizer/entities.py`:
  - `@dataclass VisualizationProject`: id, user_id, name, photo_url, wall_mask_data (bytes), calibration (pixelsPerCm), panels (list[PlacedPanelData]), created_at, updated_at
  - `@dataclass PlacedPanelData`: design_id, size_key, color_hex, color_name, x, y, width_px, height_px
- [ ] Создать `app/domain/visualizer/value_objects.py`:
  - `@dataclass(frozen=True) PanelPosition`: x, y
  - `@dataclass(frozen=True) PanelDimensions`: width_cm, height_cm
- [ ] Создать `app/domain/visualizer/repositories.py`:
  - `class VisualizationProjectRepository(ABC)`:
    - `async get_by_id(project_id: str) -> VisualizationProject | None`
    - `async get_by_user(user_id: str) -> list[VisualizationProject]`
    - `async save(project: VisualizationProject) -> VisualizationProject`
    - `async delete(project_id: str) -> None`

### 4.2 Backend — Application Layer

- [ ] Создать `app/application/visualizer/__init__.py`
- [ ] Создать `app/application/visualizer/use_cases.py`:
  - `class SaveVisualizationProject`: принимает `VisualizationProjectRepository`, метод `execute(user_id, data) -> VisualizationProject`
  - `class GetVisualizationProjects`: метод `execute(user_id) -> list[VisualizationProject]`
  - `class GetVisualizationProject`: метод `execute(project_id, user_id) -> VisualizationProject`
  - `class DeleteVisualizationProject`: метод `execute(project_id, user_id) -> None`

### 4.3 Backend — Infrastructure Layer

- [ ] Создать ORM-модель в `app/infrastructure/persistence/models.py`:
  - `class VisualizationProjectModel(Base)`: таблица `visualization_projects`
  - Колонки: id (UUID), user_id (FK → users), name (String), photo_data (LargeBinary/Text — base64), wall_mask_data (LargeBinary — сжатый), panels_json (JSON — массив PlacedPanelData), calibration_pixels_per_cm (Float), perspective_corners (JSON — nullable), created_at, updated_at
- [ ] Создать `app/infrastructure/persistence/repositories/visualization_repo.py`:
  - `class SqlAlchemyVisualizationProjectRepository(VisualizationProjectRepository)`
  - Методы `_to_entity()` и `_to_model()` для маппинга
- [ ] Создать in-memory реализацию в `app/infrastructure/persistence/repositories/memory.py`:
  - `class InMemoryVisualizationProjectRepository` — для тестов (`USE_MEMORY_REPOS=true`)
- [ ] Alembic-миграция: `alembic revision --autogenerate -m "add visualization_projects table"`
- [ ] Зарегистрировать репозиторий в `app/infrastructure/container.py`

### 4.4 Backend — API Layer

- [ ] Создать `app/infrastructure/api/visualizer.py`:
  - `POST /api/visualizer/projects` — сохранить проект (требует авторизации)
  - `GET /api/visualizer/projects` — список проектов пользователя
  - `GET /api/visualizer/projects/{id}` — получить проект
  - `PUT /api/visualizer/projects/{id}` — обновить проект
  - `DELETE /api/visualizer/projects/{id}` — удалить проект
  - Pydantic-схемы: `VisualizationProjectCreate`, `VisualizationProjectUpdate`, `VisualizationProjectResponse`
  - Валидация: name (1–100 символов), panels_json (max 500 панелей), photo_data (max 5 MB base64)
- [ ] Зарегистрировать router в `app/main.py`

### 4.5 Frontend — Интеграция с API

- [ ] Перевести `visualizerStore.ts` на Zustand `persist` middleware:
  - Ключ: `wow-wall-visualizer`
  - `partialize`: сохранять scene, layout, selectedDesignId, selectedSizeKey, selectedColor (не сохранять undoStack, segmentationProgress)
- [ ] Создать `src/shared/api/visualizerApi.ts`:
  - Функции: `saveProject()`, `loadProjects()`, `loadProject(id)`, `deleteProject(id)`
  - TanStack Query хуки: `useVisualizerProjects()`, `useVisualizerProject(id)`, `useSaveProjectMutation()`
- [ ] Обновить `CostSummary.tsx`:
  - Кнопка «Сохранить» → вызов API (если авторизован) или persist в localStorage (если нет)
  - Кнопка «Мои проекты» → модальное окно со списком сохранённых проектов

### 4.6 Тесты

- [ ] Backend domain: `tests/domain/test_visualization_project.py` — создание, валидация entity
- [ ] Backend application: `tests/application/test_visualizer_use_cases.py` — CRUD через mock repo
- [ ] Backend API: `tests/api/test_visualizer.py` — интеграционные тесты всех 5 эндпоинтов
- [ ] Frontend: обновить `adapters.test.ts` для API-интеграции

---

## Фаза 5: UX-полировка

> **Цель:** Довести UX до продакшн-качества.
> **Результат:** Онбординг, скелетоны, анимации, BeforeAfter интеграция

### 5.1 Frontend — Онбординг

- [ ] Создать `src/domains/visualizer/ui/OnboardingTooltips.tsx`:
  - 3 шага (Ant Design `Tour` компонент):
    1. «Загрузите фото стены» → подсветка зоны upload
    2. «Выберите дизайн и размер панелей» → подсветка PanelPicker
    3. «Нажмите "Авто" для заполнения стены» → подсветка PlacementControls
  - Показывать при первом посещении (флаг в localStorage: `wow-wall-visualizer-onboarding`)
  - Кнопка «Пропустить» / «Далее» / «Готово»

### 5.2 Frontend — Before/After интеграция

- [ ] Подключить `BeforeAfterSlider.tsx` в `PhotoEditorPage.tsx`:
  - Кнопка «До / После» в toolbar
  - Before: оригинальное фото (без панелей)
  - After: canvas с панелями → `stage.toDataURL()`
  - Модальное окно или inline-переключение

### 5.3 Frontend — Визуальная полировка

- [ ] Skeleton loading в PanelPicker (при загрузке дизайнов из API)
- [ ] Анимация появления панели: Konva `<Rect>` с анимацией opacity 0 → 0.85 (200ms)
- [ ] Fullscreen mode: кнопка FullscreenOutlined → `document.fullscreenElement` API
- [ ] Кнопка «Примерить на фото» в ConstructorPage (единственная недостающая)

### 5.4 Тесты

- [ ] E2E тест (Playwright):
  - Загрузка фото → ожидание сегментации → авто-заполнение → добавление в корзину
  - Visual regression: скриншот canvas после размещения панелей

---

## Прогресс

| Фаза | Описание | Задач | Статус |
|---|---|---|---|
| 1 | ML-сегментация в браузере | 9 | ⬜ Не начата |
| 2 | Миграция Canvas на react-konva | 13 | ⬜ Не начата |
| 3 | Перспектива и калибровка | 12 | ⬜ Не начата |
| 4 | Бэкенд — сохранение проектов | 17 | ⬜ Не начата |
| 5 | UX-полировка | 10 | ⬜ Не начата |
| **ИТОГО** | | **61** | **0%** |

---

## Зависимости между фазами

```
Фаза 1 (сегментация) ──┐
                        ├──→ Фаза 3 (перспектива) ──→ Фаза 5 (полировка)
Фаза 2 (react-konva) ──┘
                            Фаза 4 (бэкенд) ────────→ Фаза 5 (полировка)
```

- **Фазы 1 и 2** — независимы, можно делать параллельно
- **Фаза 3** — зависит от Фазы 2 (нужен Konva для рендеринга перспективных панелей)
- **Фаза 4** — полностью независима, можно делать параллельно с любой другой
- **Фаза 5** — финальная, зависит от всех предыдущих

---

## Новые зависимости (npm/pip)

### Frontend

| Пакет | Версия | Размер (gzip) | Назначение |
|---|---|---|---|
| `@huggingface/transformers` | ^3 | ~200 KB + 15 MB модель (lazy) | ML-сегментация в браузере |
| `react-konva` | ^18 | ~15 KB | React-обёртка для Konva |
| `konva` | ^9 | ~55 KB | Canvas-библиотека |
| `perspective-transform` | ^1 | ~3 KB | Матрица перспективы |

### Backend

| Пакет | Версия | Назначение |
|---|---|---|
| — | — | Новые зависимости не требуются (SQLAlchemy, Pydantic, FastAPI уже есть) |

---

## Соответствие конвенциям

### Frontend

| Конвенция | Соблюдение |
|---|---|
| DDD-структура `model/` + `ui/` + `lib/` | ✅ Новые файлы в `lib/` и `ui/` |
| Компоненты `PascalCase.tsx` | ✅ `KonvaCanvas.tsx`, `CalibrationOverlay.tsx`, `PerspectiveCorners.tsx`, `OnboardingTooltips.tsx` |
| Inline styles (не CSS modules) | ✅ |
| Ant Design для UI-элементов | ✅ Tour, Button, Slider, Modal |
| Иконки из `@ant-design/icons` | ✅ RulerOutlined, FullscreenOutlined |
| Zustand persist middleware | ✅ Миграция с ручного localStorage на `persist` (Фаза 4.5) |
| Импорт типов из других доменов, не UI | ✅ |
| Lazy loading страницы | ✅ Уже есть |

### Backend

| Конвенция | Соблюдение |
|---|---|
| DDD: domain → application → infrastructure | ✅ |
| Entities как `@dataclass` | ✅ `VisualizationProject`, `PlacedPanelData` |
| Value objects как `@dataclass(frozen=True)` | ✅ `PanelPosition`, `PanelDimensions` |
| Repository ABC в domain, SQL-impl в infrastructure | ✅ |
| ORM-модели с суффиксом `Model` | ✅ `VisualizationProjectModel` |
| Use Case = класс с `execute()` | ✅ `SaveVisualizationProject.execute()` |
| Pydantic DTO: `*Create`, `*Update`, `*Response` | ✅ |
| In-memory fallback для тестов | ✅ `InMemoryVisualizationProjectRepository` |
| Alembic-миграция | ✅ |
| Тесты: domain (unit) + application (mock) + api (integration) | ✅ |

---

## Риски и mitigation

| Риск | Вероятность | Mitigation |
|---|---|---|
| SegFormer-B0 неточно определяет стену на российских интерьерах | Средняя | Ручная коррекция маски уже работает; можно попробовать модель B2 (точнее, но 80 MB) |
| Первая загрузка модели 15 MB — плохой UX | Низкая | Progress bar + кэширование в IndexedDB (при повторных визитах — мгновенно) |
| react-konva миграция ломает существующие тесты | Средняя | Поэтапная миграция: сначала KonvaCanvas рядом с WallCanvas, потом замена |
| perspective-transform неточен для сильной перспективы | Низкая | 4-точечная коррекция пользователем компенсирует ошибки |
| Размер фото в PostgreSQL (base64) замедляет API | Низкая | Ограничение 5 MB; при масштабировании — миграция на S3/файловое хранилище |
