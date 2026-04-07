# Plan: Фото-редактор стен v2 (Visualizer Domain)

> Пофазный план доработки фото-редактора стен.
> Bounded Context: `visualizer`
> Связано: [Product Spec](../../product-specs/PHOTO-WALL-EDITOR.md) | [Architecture](../../design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md) | [Design System](../../design-docs/DESIGN-SYSTEM.md) | [Content Requirements](../../CONTENT-REQUIREMENTS.md)
> **Создан: 07.04.2026** | Заменяет: `PLAN-PHOTO-EDITOR.md` (v1)
>
> **Примечание:** Архитектурный документ `PHOTO-WALL-EDITOR-ARCHITECTURE.md` описывает подход SAM 2 + WebGL. Данный план v2 использует альтернативные решения (Transformers.js + react-konva + perspective-transform). При реализации — обновить архитектурный документ.

---

## Принципы плана

- **Без платных API** — вся ML-обработка в браузере (`@huggingface/transformers`)
- **Без GPU-серверов** — бэкенд только для CRUD (сохранение проектов)
- **Минимум кастомного кода** — `react-konva` вместо raw Canvas, `perspective-transform` вместо WebGL
- **Инкрементально** — каждая фаза даёт рабочий результат, можно остановиться после любой
- **Визуал по Design System** — цвета, тени, скругления, анимации строго по [DESIGN-SYSTEM.md](../../design-docs/DESIGN-SYSTEM.md)

> **Примечание:** Пресеты интерьеров (10 готовых фонов с масками) относятся к домену **constructor**, а не visualizer — см. [CONTENT-REQUIREMENTS.md, раздел 7](../../CONTENT-REQUIREMENTS.md). Пресеты описаны там как «готовые фоны интерьеров, куда пользователь размещает панели прямо в конструкторе». План пресетов для конструктора — отдельный документ.

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

> **Цель:** Заменить заглушку (белая маска) на реальное распознавание стены и объектов при загрузке пользовательского фото.
> **Технология:** `@huggingface/transformers` + SegFormer-B0 (ADE20K, 150 классов)
> **Результат:** После загрузки фото пользователь видит реальную маску стены с распознанными объектами

### 1.1 Frontend — Сервис сегментации

- [ ] Установить `@huggingface/transformers` (`npm install @huggingface/transformers`)
- [ ] Создать `src/domains/visualizer/lib/segmentationService.ts`:
  - Функция `initSegmenter()` — lazy-загрузка модели `Xenova/segformer-b0-finetuned-ade-512-512`
  - Функция `segmentScene(imageUrl: string): Promise<SegmentationResult>` — запуск inference
  - Тип `SegmentationResult`: `{ wallMask: WallMask, obstacles: Obstacle[], classes: string[] }`
  - Извлечение класса `wall` → `WallMask` (Uint8Array, 0/255)
  - Извлечение классов `door`, `window`, `furniture`, `table`, `chair`, `sofa`, `bed` → `Obstacle[]`
  - Кэширование модели (модель кэшируется в IndexedDB автоматически библиотекой)
  - Graceful fallback: если браузер не поддерживает WASM/WebGPU — возвращать пустую маску с сообщением «Отметьте стену кистью»

### 1.2 Frontend — Интеграция в store и UI

- [ ] Обновить `visualizerStore.ts`:
  - В action `uploadPhoto()`: заменить mock-маску на вызов `segmentScene()`
  - Добавить `segmentationProgress: number` (0–100) для прогресс-бара
  - Статусы: `idle` → `uploading` → `loading-model` → `segmenting` → `ready` / `error`
- [ ] Обновить `PhotoEditorPage.tsx`:
  - **Прогресс-бар** загрузки модели: Ant Design `Progress` компонент, цвет `#4CAF50` (акцент для статусов — по Design System)
  - Текстовые статусы — Inter 15px/400, цвет `#6B7280`:
    - «Загружаем модель распознавания...» (при первом использовании, ~15 MB)
    - «Распознаём стену...»
    - «Готово» — бейдж Inter 13px/500, фон `#4CAF50`, текст `#FFFFFF`, border-radius `6px`
  - При ошибке: fallback на ручную маску — сообщение «Отметьте стену кистью» (Inter 15px/400, цвет `#6B7280`)
- [ ] Обновить `layoutEngine.ts`:
  - `autoFillWall()` и `placeSinglePanel()` — убедиться, что с реальной маской порог 0.7 работает корректно
  - При наличии `obstacles` — добавить проверку пересечения панели с obstacle bounding box
- [ ] **⚠️ Нормализация размера маски**: `autoFillWall()` индексирует `mask.data[y * width + x]`, предполагая что `width/height` маски === размеру фото. ML-модель выдаёт маску 512×512 (SegFormer input size). Необходимо:
  - В `segmentationService.ts`: ресайзить выходную маску до размера исходного фото (bilinear interpolation на offscreen canvas)
  - Валидация: `assert(mask.width === photo.width && mask.height === photo.height)` перед передачей в store
  - Если размеры не совпадают — автоматический ресайз с warning в console

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
    - `onMouseEnter` / `onMouseLeave` → hover-эффект:
      - Hover: `stroke: '#4CAF50'`, `strokeWidth: 2`, cursor `pointer`
      - Selected: `stroke: '#4CAF50'`, `strokeWidth: 3`, кнопка удаления (`CloseCircleFilled`, цвет `#EF4444`)
      - Default: `stroke: '#E5E7EB'`, `strokeWidth: 1`
  - `<Layer>` для UI:
    - Hover-ячейка: `fill: 'rgba(76, 175, 80, 0.18)'`, `stroke: 'rgba(76, 175, 80, 0.5)'`, `dash: [6, 4]`, `strokeWidth: 2`
    - Акцентная зона: `stroke: '#4CAF50'`, `dash: [8, 4]`, `strokeWidth: 2`, `fill: 'rgba(76, 175, 80, 0.08)'`

### 2.2 Frontend — Маска на Konva

- [ ] Рендеринг маски:
  - Преобразовать `WallMask` → offscreen `<canvas>` → Konva `<Image>`
  - Цвет маски overlay: `rgba(76, 175, 80, opacity)` — `#4CAF50` (акцент из Design System, допустим для статусов/активных зон)
  - Переключение видимости: `visible={maskVisible}` на `<Image>`
- [ ] Рисование маски (кисть/ластик):
  - Konva `<Line>` с `globalCompositeOperation` или отдельный offscreen canvas для painting
  - `onMouseDown/Move/Up` + `onTouchStart/Move/End` на Stage → рисование штриха
  - Курсор кисти: круг `stroke: '#4CAF50'` (кисть) / `stroke: '#EF4444'` (ластик), `opacity: 0.5`
  - Применение штриха к `WallMask` через существующий `applyStrokeToMask()` из `maskUtils.ts`
  - Undo — без изменений (стек масок уже работает)

### 2.3 Frontend — Toolbar и панели (Design System)

- [ ] Обновить `MaskToolbar.tsx` — стилизация по Design System:
  - Фон toolbar: `#2D2D2D` (тёмный, уже есть)
  - Кнопки инструментов: `Segmented` Ant Design, border-radius `8px`
  - Slider: Ant Design `Slider`, track color `#4CAF50`
  - Иконка Undo: `UndoOutlined`, disabled цвет `#9CA3AF`
  - Иконка глаза: `EyeOutlined` / `EyeInvisibleOutlined`, active цвет `#4CAF50`
- [ ] Обновить `PlacementControls.tsx` — стилизация по Design System:
  - Segmented переключатель «Авто / Вручную / Зона»: border-radius `8px`
  - Кнопка «Заполнить стену»: Accent стиль — фон `#4CAF50`, текст белый, hover `#43A047`, border-radius `8px`, высота `36px`
  - Кнопка «Очистить всё»: Ghost стиль — текст `#EF4444`, hover underline
  - Tooltips: Inter 13px/400, цвет `#6B7280`
- [ ] Обновить `PanelPicker.tsx` — стилизация по Design System:
  - Карточки дизайнов: border-radius `12px`, border `1px solid #E5E7EB`
  - Hover карточки: `translateY(-4px)`, тень `0 12px 40px rgba(0,0,0,0.1)`, transition `0.3s`
  - Выбранная карточка: border `2px solid #4CAF50`, бейдж «Выбран» — фон `#4CAF50`, текст белый, border-radius `6px`, Inter 12px/500
  - Поиск: Ant Design `Input` с `SearchOutlined`, border-radius `8px`, border `#E5E7EB`
  - Radio размеров: border-radius `8px`
  - Color swatches: border-radius `50%`, selected → border `2px solid #2D2D2D`
- [ ] Обновить `CostSummary.tsx` — стилизация по Design System:
  - Контейнер: border `1px solid #E5E7EB`, border-radius `16px`, padding `20px`
  - Заголовок «Стоимость»: Inter 24px/700, цвет `#2D2D2D`
  - Строки разбивки: Inter 14px/400, цвет `#6B7280`; значения — Inter 14px/500, цвет `#2D2D2D`
  - Итого: Inter 24px/800, цвет `#2D2D2D`
  - Бейдж подписки (`CrownOutlined`): фон `#4CAF50`, текст белый, border-radius `6px`
  - Кнопка «В корзину»: Primary CTA — фон `#2D2D2D`, текст белый, hover `#1A1A1A`, border-radius `8px`, высота `44px`
  - Кнопки «Сохранить» / «Скачать»: Secondary — transparent bg, border `#E5E7EB`, текст `#2D2D2D`, border-radius `8px`, высота `36px`

### 2.4 Frontend — Zoom, Pan, Touch

- [ ] Zoom: `onWheel` на `<Stage>` → обновить `scaleX/Y` (диапазон 0.25–4x)
- [ ] Pan: `<Stage draggable>` — встроенная функция Konva
- [ ] Pinch-to-zoom: Konva поддерживает touch events, адаптировать текущую логику `touchDist()`
- [ ] Экспорт: `stageRef.current.toDataURL({ mimeType: 'image/jpeg', quality: 0.9 })` → download

### 2.5 Frontend — Замена WallCanvas → KonvaCanvas

> **⚠️ Риск регрессии:** `WallCanvas.tsx` (526 строк, 7 callbacks, 13 props) НЕ покрыт unit-тестами. Прямая замена опасна. Стратегия:
> 1. Сначала — `KonvaCanvas` работает параллельно с `WallCanvas` (dev-переключатель `?canvas=konva` в URL)
> 2. Тестирование обоих вариантов на одних и тех же сценариях
> 3. Только после проверки всех callbacks — удаление `WallCanvas`
>
> **⚠️ Координатная система:** Canvas API использует `ctx.getImageData()` / pixel-level координаты. Konva использует `node.getAbsolutePosition()` / Stage-relative координаты. `onMouseMove` в WallCanvas вычисляет `(offsetX - panX) / zoom` — в Konva аналог: `stage.getPointerPosition()` + `node.getRelativePointerPosition()`. При миграции проверить каждый из 7 callbacks на корректность координат.

- [ ] Обновить `PhotoEditorPage.tsx`:
  - Заменить `<WallCanvas>` на `<KonvaCanvas>`
  - Layout: 3-column grid — `240px` (PanelPicker) | `1fr` (KonvaCanvas) | `280px` (Controls + Cost)
  - Фон страницы: `#FFFFFF`, разделители между колонками: `1px solid #F0F0F0`
  - Header секции: Inter 32px/800, цвет `#2D2D2D`; subtitle: Inter 15px/400, цвет `#6B7280`
  - Анимация входа: Framer Motion `AnimatePresence` + `motion.div` fadeUp
- [ ] **Параллельный режим Canvas (dev)**: добавить `useSearchParams` проверку `?canvas=konva` → рендерить `KonvaCanvas` или `WallCanvas`. Удалить переключатель после полной миграции.
- [ ] Удалить `WallCanvas.tsx` после полной миграции и подтверждения всех 7 callbacks
- [ ] Проверить, что все props и callbacks совместимы — чеклист:
  - `onPanelClick` (select)
  - `onPanelDrag` (координаты)
  - `onMaskPaint` (кисть/ластик)
  - `onHoverCell` (grid snap)
  - `onZoom` (scale)
  - `onPan` (offset)
  - `onDeletePanel` (удаление)

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
  - Режим калибровки:
    - Выбор из пресетов объектов: дверь = 200 см, розетка = 8 см, окно = 120 см — Ant Design `Select`, border-radius `8px`
    - Или ввод своего значения: Ant Design `InputNumber`, суффикс «см»
    - 2 клика на фото: отмечает начало и конец известного объекта
    - Точки калибровки: Konva `<Circle>` — `fill: '#4CAF50'`, `radius: 8`, `stroke: '#FFFFFF'`, `strokeWidth: 2`, `draggable`
    - Линия между точками: Konva `<Line>` — `stroke: '#4CAF50'`, `dash: [4, 4]`, `strokeWidth: 2`
    - Расчёт `pixelsPerCm = distanceInPixels / distanceInCm`
    - Обновление `calibration` в store
  - Кнопка «Калибровать» в toolbar: `RulerOutlined` из `@ant-design/icons`, Secondary стиль
  - Подсказка: «Укажите два конца объекта известного размера» — Inter 13px/400, цвет `#6B7280`
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
  - 4 перетаскиваемых маркера (Konva `<Circle>`):
    - `fill: '#FFFFFF'`, `stroke: '#4CAF50'`, `strokeWidth: 2`, `radius: 10`
    - Hover: `radius: 12`, `stroke: '#43A047'`, cursor `move`
    - Тень: `shadowColor: 'rgba(0,0,0,0.3)'`, `shadowBlur: 4`, `shadowOffsetY: 2`
  - Линии между маркерами: Konva `<Line>` — `stroke: '#4CAF50'`, `strokeWidth: 2`, `opacity: 0.8`
  - При drag → пересчёт perspective transform → re-render панелей
  - Кнопка «Перспектива» в toolbar: `BorderOuterOutlined`, Secondary стиль, border-radius `8px`
  - Active state кнопки: border `2px solid #4CAF50`
- [ ] Обновить `KonvaCanvas.tsx`:
  - Рендер панелей через `<Line points={transformedCorners} closed fill={color}>` вместо `<Rect>` (четырёхугольник с перспективой)
  - D&D адаптировать: drag в экранных координатах → snap-to-grid в координатах стены

### 3.3 Frontend — Улучшение визуализации

- [ ] Подгонка яркости панелей под фото:
  - Простой анализ: средняя яркость области стены (из маски) → `brightness()` CSS-фильтр на слое панелей
  - Konva `<Layer>` поддерживает filters: `Konva.Filters.Brighten`
  - Диапазон: если стена тёмная (яркость < 100) → уменьшить яркость панелей; если светлая (> 200) → увеличить
- [ ] Тень под панелями (Design System shadows):
  - Default: `shadowColor: 'rgba(0,0,0,0.04)'`, `shadowBlur: 3`, `shadowOffsetY: 1`
  - При hover/select: `shadowColor: 'rgba(0,0,0,0.1)'`, `shadowBlur: 12`, `shadowOffsetY: 4`
  - Transition: Konva `Tween`, duration `0.2s`

### 3.4 Тесты

- [ ] Unit-тесты `perspectiveEngine.test.ts`:
  - Идентичная трансформация (прямоугольник → прямоугольник)
  - Трапецоидная перспектива
  - Обратная трансформация (экран → стена)
- [ ] Unit-тест `CalibrationOverlay`: выбор объекта + 2 клика → расчёт pixelsPerCm

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
  - **⚠️ wallMask (Uint8Array) не сериализуется JSON.stringify автоматически!** Решение:
    - `storage.setItem`: конвертировать `wallMask.data` (Uint8Array) → base64 строку перед сохранением
    - `storage.getItem`: декодировать base64 → `new Uint8Array(...)` при восстановлении
    - Использовать `createJSONStorage()` с кастомным `replacer/reviver` или отдельно обрабатывать в `onRehydrateStorage`
  - **⚠️ wallMask сейчас НЕ персистится**: при restore из localStorage создаётся пустая маска через `createEmptyMask(width, height, 255)`. Необходимо:
    - Включить wallMask в `partialize`
    - В `migrate()`: если старый формат без wallMask — создать пустую маску fallback
    - При восстановлении проекта: если wallMask битый/отсутствует — пересегментировать фото через `segmentScene()`
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
  - 4 шага (Ant Design `Tour` компонент):
    1. «Загрузите фото своей стены» → подсветка PhotoUploader
    2. «Подправьте маску стены при необходимости» → подсветка MaskToolbar
    3. «Выберите дизайн и размер панелей» → подсветка PanelPicker
    4. «Нажмите "Авто" для заполнения стены» → подсветка PlacementControls
  - **Стиль Tour** (по Design System):
    - Фон tooltip: `#2D2D2D`, текст: `#FFFFFF`, border-radius: `12px`
    - Заголовок шага: Inter 16px/700
    - Описание: Inter 14px/400
    - Кнопка «Далее»: Accent — фон `#4CAF50`, текст белый, border-radius `8px`
    - Кнопка «Пропустить»: Ghost — текст `#9CA3AF`, hover underline
    - Индикатор шагов: точки, active = `#4CAF50`, inactive = `#E5E7EB`
  - Показывать при первом посещении (флаг в localStorage: `wow-wall-visualizer-onboarding`)

### 5.2 Frontend — Before/After интеграция

- [ ] Подключить `BeforeAfterSlider.tsx` в `PhotoEditorPage.tsx`:
  - Кнопка «До / После» в toolbar: `SwapOutlined`, Secondary стиль, border-radius `8px`
  - Before: оригинальное фото (без панелей)
  - After: canvas с панелями → `stage.toDataURL()`
  - Ant Design `Modal` — `width: 900px`, border-radius `16px`
  - Divider слайдера: `width: 4px`, `background: #FFFFFF`, `border-radius: 2px`, тень `0 2px 8px rgba(0,0,0,0.3)`
  - Handle: circle `40px`, `background: #FFFFFF`, `border: 2px solid #E5E7EB`, иконка `ColumnWidthOutlined`

### 5.3 Frontend — Визуальная полировка

- [ ] Skeleton loading в PanelPicker: Ant Design `Skeleton.Image`, border-radius `12px`
- [ ] Анимация появления панели: Konva `Tween` — opacity `0 → 0.85`, `scaleX/Y: 0.95 → 1`, duration `200ms`, easing `EaseOut`
- [ ] Fullscreen mode: кнопка `FullscreenOutlined` → `document.requestFullscreen()` на контейнере canvas
- [ ] Кнопка «Примерить на фото» в ConstructorPage: `CameraOutlined`, Secondary стиль, навигация на `/visualizer`
- [ ] Empty state (нет панелей на стене): иконка `PictureOutlined` 48px цвет `#E5E7EB`, текст «Выберите дизайн и разместите панели» — Inter 15px/400, цвет `#9CA3AF`

### 5.4 Тесты

- [ ] E2E тест (Playwright):
  - Загрузка фото → ожидание сегментации → авто-заполнение → добавление в корзину
  - Visual regression: скриншот canvas после размещения панелей

---

## Прогресс

| Фаза | Описание | Задач | Статус |
|---|---|---|---|
| 1 | ML-сегментация в браузере | 10 | ⬜ Не начата |
| 2 | Миграция Canvas на react-konva + Design System | 20 | ⬜ Не начата |
| 3 | Перспектива и калибровка | 12 | ⬜ Не начата |
| 4 | Бэкенд — сохранение проектов | 17 | ⬜ Не начата |
| 5 | UX-полировка | 12 | ⬜ Не начата |
| **ИТОГО** | | **71** | **0%** |

---

## Зависимости между фазами

```
Фаза 1 (ML-сегментация) ──┐
                          ├──→ Фаза 3 (перспектива) ──→ Фаза 5 (полировка)
Фаза 2 (react-konva)  ──┘
                              Фаза 4 (бэкенд) ────────→ Фаза 5 (полировка)
```

- **Фазы 1 и 2** — независимы, можно делать параллельно
- **Фаза 1** — ML-сегментация, fallback на ручную маску при ошибках
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

### 🔴 Высокий приоритет

| Риск | Фаза | Вероятность | Mitigation |
|---|---|---|---|
| **ML-маска другого размера**: SegFormer выдаёт маску 512×512, а `autoFillWall()` индексирует `mask.data[y * width + x]` по размеру фото. Несовпадение → панели размещаются вне стены | 1 | **Высокая** | Задача 1.2: ресайз маски до размера фото в `segmentationService.ts` + валидация `mask.width === photo.width` |
| **Canvas→Konva координатная регрессия**: WallCanvas (526 строк, 7 callbacks) НЕ покрыт unit-тестами. Canvas API и Konva используют разные координатные системы (`offsetX/Y` vs `getPointerPosition()`). Ошибка в одном callback → сломается painting/D&D/hover | 2 | **Высокая** | Задача 2.5: параллельный режим `?canvas=konva`, чеклист 7 callbacks, удаление WallCanvas только после полной проверки |

### 🟠 Средний приоритет

| Риск | Фаза | Вероятность | Mitigation |
|---|---|---|---|
| **wallMask не персистится**: текущий store при restore создаёт пустую маску `createEmptyMask(w, h, 255)`. Пользователь теряет нарисованную маску при перезагрузке страницы | 4 | **Средняя** | Задача 4.5: включить wallMask в `partialize`, fallback — пересегментация фото |
| **Uint8Array не сериализуется в JSON**: `JSON.stringify(Uint8Array)` → `{}`. Zustand `persist` middleware молча сохранит пустой объект вместо маски | 4 | **Средняя** | Задача 4.5: кастомный storage с base64-кодированием Uint8Array |
| SegFormer-B0 неточно определяет стену на российских интерьерах | 1 | Средняя | Ручная коррекция маски уже работает; можно попробовать модель B2 (точнее, но 80 MB) |
| react-konva миграция ломает существующие тесты | 2 | Средняя | Поэтапная миграция: сначала KonvaCanvas рядом с WallCanvas, потом замена |

### 🟢 Низкий приоритет

| Риск | Фаза | Вероятность | Mitigation |
|---|---|---|---|
| Первая загрузка модели 15 MB — плохой UX | 1 | Низкая | Progress bar + кэширование в IndexedDB (при повторных визитах — мгновенно) |
| perspective-transform неточен для сильной перспективы | 3 | Низкая | 4-точечная коррекция пользователем компенсирует ошибки |
| Размер фото в PostgreSQL (base64) замедляет API | 4 | Низкая | Ограничение 5 MB; при масштабировании — миграция на S3/файловое хранилище |
| Визуальные расхождения с Design System | 2–5 | Низкая | Все цвета, тени, скругления, шрифты задокументированы в плане; code review по чеклисту |
