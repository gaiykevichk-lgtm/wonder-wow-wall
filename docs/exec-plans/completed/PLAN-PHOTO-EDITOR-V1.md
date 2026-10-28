# Plan: Фото-редактор стен (Visualizer Domain)

> Пофазный план реализации фото-редактора стен.
> Bounded Context: `visualizer`
> Связано: [Product Spec](../../product-specs/PHOTO-WALL-EDITOR.md) | [Architecture](../../design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md)
> **Последний аудит: 07.04.2026**

---

## Фаза 1: Фундамент и загрузка фото ✅

### 1.1 DDD-структура домена
- [x] `src/domains/visualizer/model/types.ts` — все интерфейсы: Scene, WallMask, ObjectMask, PlacedPanel, PanelLayout, ScaleCalibration, VisualizationProject, PhotoAsset
- [x] `src/domains/visualizer/model/visualizerStore.ts` — Zustand store (scene, layout, selectedDesignId/Name/Image, selectedSizeKey, selectedColor/ColorName, maskTool, brushSize, maskOpacity, maskVisible, undoStack)
- [x] `src/domains/visualizer/model/adapters.ts` — ACL: placedPanelsToCartItems() с группировкой и учётом подписки
- [x] `src/domains/visualizer/lib/imageProcessing.ts` — validateImageDimensions (min 800×600), resizeImage (до 2048px), валидация формата (JPEG/PNG/WebP/HEIC)

### 1.2 UI — Загрузка фото
- [x] `PhotoEditorPage.tsx` — страница-контейнер с 3-column layout (240px дизайны | 1fr canvas | 280px настройки)
- [x] `PhotoUploader.tsx` — drag & drop + file input + camera (capture="environment"); валидация формата и размера
- [x] Пустое состояние с инструкцией «Загрузите фото стены»
- [x] Индикация загрузки (loading prop)

### 1.3 Маршрут и навигация
- [x] Маршрут `/visualizer` в `shared/router.tsx` (lazy-loading)
- [ ] Добавить кнопку «Примерить на фото» в CatalogPage, ProductPage, ConstructorPage
- [x] Пункт «Фото-редактор» в навигации Header (NAV_ITEMS в ShopHeader.tsx)

---

## Фаза 2: Сегментация и маски ⚠️ Frontend готов, backend отсутствует

### 2.1 Backend — Сегментация
- [ ] API endpoint: `POST /api/visualizer/upload` — принимает фото, возвращает scene_id
- [ ] API endpoint: `GET /api/visualizer/scene/{id}` — возвращает маски и метаданные
- [ ] Интеграция SAM 2 / OneFormer для semantic segmentation
- [ ] Классы сегментации: wall, floor, ceiling, door, window, furniture, decor, person, other
- [ ] Хранение масок: S3-compatible (PNG, 1-канал для WallMask, indexed для ObjectMask)
- [ ] Rate limiting: 5 фото/мин на пользователя
- [ ] Валидация: MIME-type + magic bytes, EXIF stripping

### 2.2 Frontend — Отображение масок
- [x] `WallCanvas.tsx` — Canvas 2D компонент: рендер фото + WallMask (зелёный overlay) + панели
- [x] Zoom & Pan (scroll = zoom, alt+click / middle-click = pan)
- [ ] `segmentationService.ts` — API-клиент: upload фото → poll результат → получить маски
- [x] Анимация при обработке: «Загружаем фото...» / «Распознаём стену...» (AnimatePresence + Framer Motion)
- [ ] Обработка ошибок: «Стена не найдена», «Фото низкого качества» — ⚠️ базовая обработка через setSegmentationStatus('error'), но специфичных сообщений нет

### 2.3 Ручная коррекция маски
- [x] `MaskToolbar.tsx` — инструменты: Кисть, Ластик, размер кисти (slider 5–80)
- [x] `maskUtils.ts` — операции: drawCircleOnMask, applyStrokeToMask (интерполяция), countWallPixelsInRect, wallCoverageInRect, invertMask
- [x] Undo-стек (до 20 действий, `.slice(-19)`)
- [x] Переключение видимости маски (EyeOutlined / EyeInvisibleOutlined)
- [x] Регулировка прозрачности маски (slider min: 0.1, max: 0.8, step: 0.05)

---

## Фаза 3: Размещение панелей ⚠️ Основное готово, нет DnD и hover

### 3.1 Layout Engine
- [x] `layoutEngine.ts` — алгоритм авторазмещения панелей на WallMask
  - Наложение сетки через snapToGrid()
  - Проверка покрытия ячейки (WALL_COVERAGE_THRESHOLD = 0.7)
  - Генерация PlacedPanel[] с координатами (autoFillWall)
- [ ] Web Worker для вычислений (не блокировать UI)
- [x] Режим «Вручную» — клик по свободной ячейке → placeSinglePanel()
- [x] Удаление панели — функция removePanel() в store (⚠️ вызывается из store, но нет UI-кнопки удаления при клике на панель в Canvas)
- [ ] Drag & drop перемещение панелей

### 3.2 UI — Выбор дизайна и настройки
- [x] `PanelPicker.tsx` — grid дизайнов из каталога (thumbnails), поиск (Search input), выделение выбранного
- [x] `PlacementControls.tsx` — переключатель режимов: «Авто» / «Вручную» / «Зона»
- [x] Выбор размера панели (30×30, 30×60, 60×60 см) — radio buttons в PanelPicker
- [x] Выбор цвета/оттенка — color swatches (круглые кнопки с border выделения)
- [x] updateAllDesigns — применение нового дизайна ко всем размещённым панелям

### 3.3 Рендеринг панелей
- [x] WallCanvas рендер панелей поверх фото в Canvas 2D
  - Цветные прямоугольники с globalAlpha=0.85 + лейблы (design name)
  - 1px border (strokeRect, lineWidth: 1) между панелями
- [ ] Hover-эффект: подсветка ячейки при наведении (режим «вручную»)
- [ ] Анимация появления панели (fade-in 200ms)

---

## Фаза 4: Расчёт и интеграция ✅

### 4.1 Расчёт стоимости
- [x] `costCalculator.ts` — подсчёт: количество панелей по размерам × BASE_PANEL_PRICES + накладки × 1 200₽ (DESIGN_OVERLAY_PRICE)
- [x] `CostSummary.tsx` — компонент: количество по размерам, площадь (м²), стоимость панелей, стоимость накладок, итого
- [x] Интеграция с `subscriptionStore` — `hasSubscription()` → скидка на накладки
- [x] Бейдж подписки (CrownOutlined + Tag color="#0071e3") в CostSummary

### 4.2 Добавление в корзину
- [x] Кнопка «Добавить в корзину» — маппинг PlacedPanel[] → CartItem[] через adapters.ts
- [x] Группировка: одинаковые панели (designId + sizeKey + color) суммируются в один CartItem
- [x] Открытие CartDrawer после добавления (setCartOpen(true))

### 4.3 Сохранение и экспорт
- [ ] Сохранение проекта — ⚠️ handleSave() показывает «Сохранение проектов будет доступно после авторизации». Zustand persist НЕ настроен для visualizerStore
- [ ] Экспорт: рендер canvas → JPEG/PNG, скачивание файла
- [x] `BeforeAfterSlider.tsx` — сравнение до/после (drag slider, 174 строки)
- [x] Zoom & Pan по фото (scroll = zoom, alt+click = pan)

---

## Фаза 5: Перспектива и реалистичность ❌ Не начата

### 5.1 Перспектива
- [ ] `perspectiveTransform.ts` — определение перспективы стены (4 точки → матрица)
- [ ] Ручная коррекция: пользователь двигает 4 точки по углам стены
- [ ] Автоматическое определение (OpenCV на бэкенде: vanishing points, Hough lines)
- [ ] Трансформация координат панелей по перспективе

### 5.2 Калибровка масштаба
- [ ] `CalibrationTool.tsx` — 2 клика на фото + ввод реального расстояния (см)
- [ ] `scaleCalibrator.ts` — расчёт pixels-per-cm, адаптация сетки
  - ⚠️ Тип ScaleCalibration описан в types.ts (method: 'manual'/'auto', pixelsPerCm), базовый расчёт pixelsPerCm = width/400 есть в PhotoEditorPage, но UI калибровки отсутствует
- [ ] Авто-калибровка по размеру дверей/розеток (backend, если объект распознан)

### 5.3 Улучшение рендеринга
- [ ] Миграция на WebGL (Three.js или raw WebGL)
- [ ] Шейдер перспективной трансформации
- [ ] Анализ освещения фото → адаптация яркости/контраста панелей
- [ ] Тени: реалистичные drop shadow под панелями

---

## Фаза 6: Мобильная версия и полировка ⚠️ Частично

### 6.1 Мобильная адаптация
- [x] Responsive layout: 3-column → 1-column при ≤1024px (⚠️ но не bottom sheet, просто stacked)
- [ ] Pinch-to-zoom на canvas
- [ ] Touch-события для рисования маски (кисть/ластик) — только mouse events
- [x] Кнопка камеры для фото с устройства (input capture="environment" в PhotoUploader)
- [ ] Оптимизация: lazy-load ML модели, сжатие фото перед отправкой

### 6.2 UX-полировка
- [ ] Онбординг: подсказки при первом использовании (3 шага) — ⚠️ есть Tooltips на кнопках, но нет пошагового онбординга
- [ ] Режим «Акцентная зона» — рисование прямоугольника — ⚠️ тип AccentZone есть в types.ts, режим «Зона» в PlacementControls есть, поддержка в autoFillWall() есть, но UI рисования прямоугольника на Canvas отсутствует
- [x] Комбинирование нескольких дизайнов на одной стене (разные PlacedPanel с разными designId)
- [ ] Fullscreen preview
- [ ] Skeleton loading для каталога дизайнов
- [x] Анимации переходов (Framer Motion: AnimatePresence, motion.div в PhotoEditorPage и PhotoUploader)

### 6.3 Тесты
- [x] Unit-тесты: layoutEngine (18), maskUtils (20), costCalculator (4), adapters (7), imageProcessing (11) — 60 тестов
- [x] Integration-тесты: visualizerStore (18 тестов)
- [x] Компонентные тесты: CostSummary (4), PhotoUploader (5), PlacementControls (3) — 12 тестов
- [ ] E2E: загрузка фото → размещение панелей → корзина

**Итого: 90 тестов в 9 файлах (100% pass)**

---

## Прогресс

| Фаза | Описание | Задач | Выполнено | Статус |
|------|---------|:-----:|:---------:|--------|
| 1 | Фундамент и загрузка фото | 10 | 9 | ✅ 90% (нет «Примерить на фото» в каталоге/товаре) |
| 2 | Сегментация и маски | 14 | 7 | ⚠️ 50% (бэкенд 0/7, фронт 7/7) |
| 3 | Размещение панелей | 12 | 9 | ⚠️ 75% (нет DnD, hover, fade-in) |
| 4 | Расчёт и интеграция | 10 | 8 | ⚠️ 80% (нет сохранения, экспорта) |
| 5 | Перспектива и реалистичность | 10 | 0 | ❌ 0% |
| 6 | Мобильная версия и полировка | 14 | 6 | ⚠️ 43% (тесты готовы, мобилка частично) |
| **ИТОГО** | | **70** | **39** | **56%** |

### Что заблокировано

| Блокер | Влияет на |
|--------|----------|
| Нет бэкенд-домена `visualizer` | Фаза 2.1 целиком, сегментация, хранение масок |
| Нет S3/файлового хранилища | Хранение загруженных фото и масок |
| Нет ML-модели (SAM 2 / OneFormer) | Автоматическая сегментация стен |
| PostgreSQL не подключён | Сохранение проектов визуализации |

### Приоритеты на следующий спринт

1. **Кнопка «Примерить на фото»** в CatalogPage и ProductPage (быстрый win)
2. **UI удаления панели** — по клику на панель в Canvas (removePanel уже в store)
3. **Сохранение проекта** в localStorage (Zustand persist) как временное решение до бэкенда
4. **Hover-эффект** при наведении на ячейку в ручном режиме
5. **Экспорт изображения** (canvas.toBlob → download)
