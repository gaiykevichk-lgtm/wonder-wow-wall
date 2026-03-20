# Plan: Фото-редактор стен (Visualizer Domain)

> Пофазный план реализации фото-редактора стен.
> Bounded Context: `visualizer`
> Связано: [Product Spec](../../product-specs/PHOTO-WALL-EDITOR.md) | [Architecture](../../design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md)

---

## Фаза 1: Фундамент и загрузка фото (1 неделя)

### 1.1 DDD-структура домена
- [ ] Создать `src/domains/visualizer/model/types.ts` — все интерфейсы: Scene, WallMask, ObjectMask, PlacedPanel, PanelLayout, Calibration, VisualizationProject, PhotoAsset
- [ ] Создать `src/domains/visualizer/model/visualizerStore.ts` — Zustand store (currentScene, panelLayout, selectedDesign, selectedSize, selectedColor, placementMode, undoStack)
- [ ] Создать `src/domains/visualizer/model/adapters.ts` — ACL: placedPanelToCartItem(), toConstructorProject()
- [ ] Создать `src/domains/visualizer/lib/imageProcessing.ts` — EXIF-коррекция, resize до 2048px, форматы

### 1.2 UI — Загрузка фото
- [ ] `PhotoEditorPage.tsx` — страница-контейнер с 3-column layout (дизайны | canvas | настройки)
- [ ] `PhotoUploader.tsx` — drag & drop + file input + camera (мобильный); валидация формата и размера
- [ ] Пустое состояние с инструкцией «Загрузите фото стены»
- [ ] Прогресс-бар загрузки

### 1.3 Маршрут и навигация
- [ ] Добавить маршрут `/visualizer` в `shared/router.tsx` (lazy-loading)
- [ ] Добавить кнопку «Примерить на фото» в CatalogPage, ProductPage, ConstructorPage
- [ ] Добавить пункт «Фото-редактор» в навигацию Header

---

## Фаза 2: Сегментация и маски (1.5 недели)

### 2.1 Backend — Сегментация
- [ ] API endpoint: `POST /api/visualizer/upload` — принимает фото, возвращает scene_id
- [ ] API endpoint: `GET /api/visualizer/scene/{id}` — возвращает маски и метаданные
- [ ] Интеграция SAM 2 / OneFormer для semantic segmentation
- [ ] Классы сегментации: wall, floor, ceiling, door, window, furniture, decor, person, other
- [ ] Хранение масок: S3-compatible (PNG, 1-канал для WallMask, indexed для ObjectMask)
- [ ] Rate limiting: 5 фото/мин на пользователя
- [ ] Валидация: MIME-type + magic bytes, EXIF stripping

### 2.2 Frontend — Отображение масок
- [ ] `WallCanvas.tsx` — Canvas 2D компонент: рендер фото + WallMask (зелёный 30%) + ObjectMask (красный 30%)
- [ ] `MaskOverlay.tsx` — полупрозрачное отображение масок поверх фото
- [ ] `segmentationService.ts` — API-клиент: upload фото → poll результат → получить маски
- [ ] Анимация сканирования при обработке: «Распознаём стену...» → «Ищем объекты...» → «Готово!»
- [ ] Обработка ошибок: «Стена не найдена», «Фото низкого качества»

### 2.3 Ручная коррекция маски
- [ ] `MaskToolbar.tsx` — инструменты: Кисть (добавить стену), Ластик (убрать стену), размер кисти (slider)
- [ ] `maskUtils.ts` — операции: рисование по маске, union, subtract, smooth edges
- [ ] Undo/redo стек (до 20 действий)
- [ ] Переключение видимости маски (глазик)
- [ ] Регулировка прозрачности маски (slider 20%–80%)

---

## Фаза 3: Размещение панелей (1.5 недели)

### 3.1 Layout Engine
- [ ] `layoutEngine.ts` — алгоритм авторазмещения панелей на WallMask
  - Наложение сетки на маску (шаг = размер панели)
  - Проверка заполнения ячейки (≥ 70% в WallMask, ≤ 10% в ObjectMask)
  - Генерация PlacedPanel[] с координатами
- [ ] Web Worker для вычислений (не блокировать UI)
- [ ] Режим «Вручную» — клик по свободной ячейке → размещение панели
- [ ] Удаление панели (крестик)
- [ ] Drag & drop перемещение панелей

### 3.2 UI — Выбор дизайна и настройки
- [ ] `PanelPicker.tsx` — список дизайнов из каталога (thumbnails), поиск, фильтры по категории
- [ ] `PlacementControls.tsx` — переключатель режимов: «Заполнить» / «Вручную» / «Акцентная зона»
- [ ] Выбор размера панели (30×30, 30×60, 60×60 см) — radio buttons
- [ ] Выбор цвета/оттенка — color swatches
- [ ] Применение нового дизайна ко всем панелям / к выбранным

### 3.3 Рендеринг панелей
- [ ] `canvasRenderer.ts` — рендер панелей поверх фото в Canvas 2D
  - Отрисовка текстуры панели в координатах WallMask
  - Тени швов между панелями (1px серый)
  - Полупрозрачность панелей для «стеклянного» preview
- [ ] Hover-эффект: подсветка ячейки при наведении (режим «вручную»)
- [ ] Анимация появления панели (fade-in 200ms)

---

## Фаза 4: Расчёт и интеграция (1 неделя)

### 4.1 Расчёт стоимости
- [ ] `costCalculator.ts` — подсчёт: количество панелей по размерам × цена + накладки × 1200₽
- [ ] `CostSummary.tsx` — компонент: количество, площадь (м²), стоимость панелей, стоимость накладок, итого
- [ ] Интеграция с `subscriptionStore` — накладки бесплатно для подписчиков
- [ ] Баннер подписки: «Подпишитесь и сэкономьте X ₽ на накладках»

### 4.2 Добавление в корзину
- [ ] Кнопка «Добавить в корзину» — маппинг PlacedPanel[] → CartItem[] через ACL
- [ ] Группировка: одинаковые панели (дизайн + размер + цвет) суммируются в один CartItem
- [ ] Переход к Checkout после добавления

### 4.3 Сохранение и экспорт
- [ ] Сохранение проекта в localStorage (Zustand persist) для неавторизованных
- [ ] Экспорт: рендер canvas → JPEG/PNG, скачивание файла
- [ ] `BeforeAfterSlider.tsx` — сравнение до/после (slider-компонент)
- [ ] Zoom & Pan по фото (scroll = zoom, drag = pan)

---

## Фаза 5: Перспектива и реалистичность (1.5 недели)

### 5.1 Перспектива
- [ ] `perspectiveTransform.ts` — определение перспективы стены (4 точки → матрица)
- [ ] Ручная коррекция: пользователь двигает 4 точки по углам стены
- [ ] Автоматическое определение (OpenCV на бэкенде: vanishing points, Hough lines)
- [ ] Трансформация координат панелей по перспективе

### 5.2 Калибровка масштаба
- [ ] `CalibrationTool.tsx` — 2 клика на фото + ввод реального расстояния (см)
- [ ] `scaleCalibrator.ts` — расчёт pixels-per-cm, адаптация сетки
- [ ] Авто-калибровка по размеру дверей/розеток (backend, если объект распознан)

### 5.3 Улучшение рендеринга
- [ ] Миграция на WebGL (Three.js или raw WebGL)
- [ ] Шейдер перспективной трансформации
- [ ] Анализ освещения фото → адаптация яркости/контраста панелей
- [ ] Тени: реалистичные drop shadow под панелями

---

## Фаза 6: Мобильная версия и полировка (1 неделя)

### 6.1 Мобильная адаптация
- [ ] Responsive layout: sidebar → bottom sheet (375px–768px)
- [ ] Pinch-to-zoom на canvas
- [ ] Touch-события для рисования маски (кисть/ластик)
- [ ] Кнопка камеры для фото с устройства (input capture="environment")
- [ ] Оптимизация: lazy-load ML модели, сжатие фото перед отправкой

### 6.2 UX-полировка
- [ ] Онбординг: подсказки при первом использовании (3 шага)
- [ ] Режим «Акцентная зона» — рисование прямоугольника
- [ ] Комбинирование нескольких дизайнов на одной стене
- [ ] Fullscreen preview
- [ ] Skeleton loading для каталога дизайнов
- [ ] Анимации переходов (Framer Motion)

### 6.3 Тесты
- [ ] Unit-тесты: layoutEngine, maskUtils, costCalculator, scaleCalibrator, adapters
- [ ] Integration-тесты: visualizerStore, segmentationService
- [ ] E2E: загрузка фото → размещение панелей → корзина

---

## Прогресс

| Фаза | Описание | Статус | Приоритет |
|------|---------|--------|-----------|
| 1 | Фундамент и загрузка фото | ⬜ Не начата | Высокий |
| 2 | Сегментация и маски | ⬜ Не начата | Высокий |
| 3 | Размещение панелей | ⬜ Не начата | Высокий |
| 4 | Расчёт и интеграция | ⬜ Не начата | Высокий |
| 5 | Перспектива и реалистичность | ⬜ Не начата | Средний |
| 6 | Мобильная версия и полировка | ⬜ Не начата | Средний |

**Завершено: 0 из 6 фаз (0%)**
