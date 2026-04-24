# Plan: Фото-редактор стен — авто-перспектива и габариты (Visualizer Domain)

> Пофазный план добавления **автоматического определения перспективы стены, её габаритов и корректного "разворота" панелей** под углом съёмки.
> Bounded Context: `visualizer`
> Связано: [Product Spec](../../product-specs/PHOTO-WALL-EDITOR.md) | [Architecture](../../design-docs/PHOTO-WALL-EDITOR-ARCHITECTURE.md) | [Design System](../../design-docs/DESIGN-SYSTEM.md) | [Plan v2 (предыдущий)](../completed/PLAN-PHOTO-EDITOR-V2.md)
> **Создан: 24.04.2026**

---

## Контекст и проблема

В текущей версии редактора (после `PLAN-PHOTO-EDITOR-V2.md`) **уже есть базовая инфраструктура** для перспективы и калибровки масштаба:

| Что есть | Файл | Режим |
|---|---|---|
| Гомография 8-параметров (`createPerspective`, `transformRect`, `transformPoint`) | `lib/perspectiveEngine.ts` | автоматический матаппарат |
| UI расстановки 4 углов стены | `ui/PerspectiveCorners.tsx` | **ручной** |
| UI калибровки масштаба по эталону (дверь / окно / розетка / своё) | `ui/CalibrationOverlay.tsx` | **ручной** |
| Типы `EditorMode`, `CalibrationPoints`, `PerspectiveCorners`, `ScaleCalibration` | `model/types.ts` | — |

**Что НЕ работает / не интегрировано (по факту чтения кода на 24.04.2026):**

1. **В `KonvaCanvas.tsx` ветка перспективы уже есть** (строки 555–578), но рендерит панель как `<Line closed>` сплошного цвета `panel.color` — **без текстуры дизайна**. Ручная перспектива визуально работает «наполовину сломанно»: юзер видит цветной четырёхугольник вместо дизайна. См. [R1](#riski-i-mitigacii).
2. **`panelSizeInPixels()` уже учитывает `calibration.pixelsPerCm`** (`layoutEngine.ts:48`) с fallback `?? 5`. Фаза 2 — это не «добавить связь», а **завершить и провалидировать** уже частично существующую. См. [R2].
3. **В режиме перспективы drag отключён** (`KonvaCanvas.tsx:600,630` — `draggable={... && !perspectiveCorners}`). Панели нельзя двигать. См. [R3].
4. **`autoFillWall()` использует прямоугольную сетку** (`layoutEngine.ts:183–184`): шаг `+= heightPx` строго по осям X/Y фото. В перспективе панели будут стоять «не по стене». См. [R4].
5. **`canPlacePanel()` через `wallCoverageInRect()`** считает покрытие по прямоугольному bbox в координатах фото. В перспективе панель — quad; bbox сильно завышен → панели массово отвергаются. См. [R5].
6. **Глобальный счётчик `panelIdCounter`** в `layoutEngine.ts:24` — при загрузке проекта с бэкенда ID легко столкнутся со свежими. См. [R6].
7. **Перспектива и калибровка — полностью ручные.** Большинство пользователей этим не пользуются → проблемы 1–5 проявляются только у меньшинства.
8. **Габариты стены (`wallWidthCm`, `wallHeightCm`) опциональны и не используются** в layout engine.
9. **Backend** не сохраняет `calibration` и углы перспективы при `SaveProject` — при перезагрузке проекта перспектива теряется.
10. **Дебаг `console.log('[autoFill]', ...)`** в `layoutEngine.ts:161` остался в проде — почистить попутно.

---

## Цель плана

Превратить «декоративную, ручную» перспективу в **рабочую и преимущественно автоматическую**:

- Панели реально «ложатся» на стену под её углом (warp в quad).
- Углы стены и эталон масштаба определяются автоматически (с возможностью ручной корректировки).
- Габариты стены в см доступны движку раскладки → панели рендерятся в правильном физическом размере.
- Перспектива + калибровка персистятся в проекте на бэкенде.

---

## Принципы плана

- **Инкрементально** — каждая фаза даёт ощутимую визуальную/UX выгоду; можно остановиться после любой.
- **Auto + manual fallback** — авто-режим всегда предлагает результат, юзер может править руками. Ручной режим не удаляется.
- **Без блокировок UI** — тяжёлая ML/CV-обработка идёт в Web Worker или на бэкенде с прогрессом.
- **Без обязательных платных API** — фазы 1A/1B/2/3/4/5 укладываются в браузер + существующий бэкенд. GPU-инференс (фаза 6) — опционально.
- **Атомарность фаз** — каждая под-фаза (1A, 1B, 5A, 5B, 5C) — самостоятельный релиз с собственным Definition of Done. Можно останавливаться/менять очередность в пределах зависимостей.
- **Конвенции** — frontend по [`frontend/CONVENTIONS.md`](../../../frontend/CONVENTIONS.md) (DDD, inline styles, селекторы Zustand, PascalCase/camelCase). Backend по [`backend/CONVENTIONS.md`](../../../backend/CONVENTIONS.md) (Dependency Rule, `@dataclass` entities, `@dataclass(frozen=True)` value objects, `execute()` use cases, ABC репозитории, Pydantic DTO с суффиксами `*Update/*Response`, тесты по `tests/domain|application|api/`).
- **Визуал по Design System** — цвета, тени, скругления, статусы строго по [DESIGN-SYSTEM.md](../../design-docs/DESIGN-SYSTEM.md).
- **DDD-границы** — вся CV/ML-логика в `visualizer/lib/`, store в `visualizer/model/`, UI в `visualizer/ui/`. Backend — `domain/visualizer/` + `application/visualizer/` + `infrastructure/`.

---

## Фаза 0: Аудит и подготовка ✅ ЗАВЕРШЕНА (24.04.2026)

> **Цель:** Зафиксировать текущее состояние warp-рендеринга и интеграции `perspectiveEngine` в живой редактор. Не править — только описать.
> **Результат:** ✅ Отчёт [`docs/design-docs/PERSPECTIVE-AUDIT.md`](../../design-docs/PERSPECTIVE-AUDIT.md).

- [x] Подтвердить версию ветки `transformRect → <Line closed>` в `KonvaCanvas.tsx:554–578` — **R1 подтверждён** (см. п. 1 отчёта).
- [x] Какие из тестов в `__tests__/perspectiveEngine.test.ts` покрывают эту ветку — **0 из 14** (не 17). Все тесты — math, рендер не покрыт (см. п. 5).
- [x] Сохраняется ли `Scene.calibration` и углы перспективы в backend — **уже сохраняются** в entity/ORM/DTO (см. п. 3). **Пункт 9 в блоке выше устарел.**
- [x] Действующая инфра миграций — **Alembic используется** (3 миграции). **Критично:** таблица `visualization_projects` отсутствует в Alembic — новый риск **C1** (см. п. 4 отчёта).
- [x] EXIF orientation — **не учитывается** в `imageProcessing.createImageFromFile` (п. 7). T8 — реальный.
- [x] Canvas-контексты на странице — **один в каждый момент** (toggle `useKonva ? KonvaCanvas : WallCanvas`). T6 переоценён (п. 6).

### Корректировки в основной план (по итогам аудита)

| Что изменено | Где | Причина |
|---|---|---|
| Пункт 9 в блоке «Что НЕ работает» | выше | Устарел — backend уже персистит |
| Фаза 5: миграция | ниже | Создать `visualization_projects` с нуля + отдельно `add_wall_dimensions_cm` (C1) |
| Фаза 1A: добавить тест | ниже | Snapshot/render-тест `KonvaCanvas.perspective.test.tsx` для R1 |
| Фаза 1B: EXIF orientation | ниже | Перейти на `createImageBitmap({ imageOrientation: 'from-image' })` |
| T6 в Risks | ниже | Понизить приоритет (один canvas) |

### Открытые вопросы из отчёта (закрыть до Фазы 1A)
- **OQ-A1** Существует ли таблица `visualization_projects` в проде? (определяет: `CREATE TABLE` vs `IF NOT EXISTS` + бэкфил)
- **OQ-A2** Используется ли legacy `/api/projects` (`wall_cols/rows`) фронтом? (кандидат на удаление, отдельный план)
- **OQ-A3** Реальные размеры iPhone/Android фото у юзеров (для перепроверки `MAX_DIMENSION = 2048`)

---

## Фаза 1A: Hot-fix визуальной регрессии перспективы

> **Цель:** Закрыть критический баг R1 — в существующей ручной перспективе панели рендерятся как сплошной цветной quad без дизайна. Это **минимальный self-contained релиз**, не требующий новых зависимостей.
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Атомарность:** делается и проверяется независимо от Фазы 1B и далее.

### 1A.1 Frontend — patch рендеринга

- [ ] В `KonvaCanvas.tsx:555–578` заменить `<Line closed fill={panel.color}>` на временное решение: пока quad — заливка `panel.color` + поверх растровый дизайн через простую CSS-перспективу (`<KonvaImage>` поверх с `clip` по quad). Это не финальный warp, но дизайн становится виден.
- [ ] Удалить дебаг `console.log('[autoFill]', ...)` в `layoutEngine.ts:161` (одна строка, попутно).

### 1A.2 Frontend — тесты

- [ ] Добавить в `__tests__/KonvaCanvas.test.tsx` сценарий: `perspectiveCorners != null` + `panel.designImage != null` → в DOM/snapshot должен быть `<KonvaImage>`, не только `<Line>`.
- [ ] Регресс-тест: `perspectiveCorners == null` → старый рендер не сломан.

### 1A.3 Дизайн / QA

- [ ] Скриншот «до/после» с реальным фото в design-doc `docs/design-docs/PERSPECTIVE-AUDIT.md`.

> **Definition of Done:** при включении ручной перспективы видно текстуру дизайна, а не цветную трапецию. Релиз-кандидат сразу после фазы 1A.

---

## Фаза 1B: Честный perspective-warp + wall-space для панелей

> **Цель:** Полноценный 4-точечный warp текстуры панели через offscreen canvas или WebGL. Введение `wallSpace` координат в `PlacedPanel`. Drag в режиме перспективы.
> **Технология:** offscreen canvas + bilinear warp **либо** WebGL-шейдер через `pixi.js` / `regl`. Решение выбираем в 1B.1.
> **Зависимости:** Фаза 1A (без неё нельзя визуально оценить улучшение). Фаза 0 (audit).
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.

### 1B.1 Frontend — выбор технологии warp

- [ ] Создать design-doc `docs/design-docs/PANEL-WARP-RENDERER.md`:
  - Сравнение трёх вариантов: (a) Konva native + skew, (b) offscreen canvas + bilinear, (c) WebGL/Pixi.
  - Бенчмарк рендера 50 панелей @ 60fps на ноуте средней мощности.
  - Решение и обоснование (ожидаем: WebGL через `pixi.js` для FPS, либо offscreen canvas для простоты, без новых зависимостей).

### 1B.2 Frontend — реализация warp-рендерера

- [ ] **(Сначала — финальное закрытие R1)** Заменить временный фикс из 1A.1 на полноценный warp текстуры через выбранную в 1B.1 технологию.
- [ ] Создать `src/domains/visualizer/lib/panelWarpRenderer.ts`:
  - `renderPanelToQuad(designImage: HTMLImageElement, quad: Quad, opacity: number): HTMLCanvasElement`
  - Внутри: bilinear warp в offscreen canvas **или** Pixi sprite с `projection` matrix.
  - **Отдельный** кэш `panelWarpCache` (не смешивать с `konvaDesignImageCache`!) по ключу `designId + quad-hash + opacity + colorTint`. См. [R8].
  - Инвалидация кэша при изменении `scene.perspective` (через nonce/version в ключе).
- [ ] Расширить `PlacedPanel`:
  - Хранить не только `x, y, renderWidth, renderHeight`, но и **источник**: `wallSpace: { x, y, w, h }` (координаты в плоской системе стены).
  - `renderQuad` вычисляется на лету через `transformRect(perspective, wallSpace)`.
  - **Миграция существующих панелей** при первом включении перспективы: `wallSpace = inverseTransformRect(currentXY)`. См. [E6].
- [ ] Обновить `KonvaCanvas.tsx`:
  - Если `editorMode === 'perspective'` или `scene.perspective != null` → рендерить каждую панель через `<KonvaImage image={warpedCanvas} />`, где `warpedCanvas` = результат `renderPanelToQuad()`.
  - Иначе — старый рендер (как сейчас).
  - Drag & drop в режиме перспективы работает в **wall-space** (через `inverseTransformPoint` от мыши). Снять блокировку `&& !perspectiveCorners` в `draggable` (см. [R3]).
  - **Clamp wall-space координат внутри bounds стены** перед записью в store — чтобы избежать «уезда в бесконечность» возле horizon line. См. [T2].
  - **Учёт яркости стены** должен идти через canvas filter в `panelWarpRenderer`, не только через `opacity` (см. [T7]).

### 1B.3 Frontend — интеграция в store

- [ ] В `visualizerStore.ts`:
  - Добавить `scene.perspective: PerspectiveTransform | null`.
  - Action `setPerspectiveCorners(corners: PerspectiveCorners)` → создаёт `PerspectiveTransform` через `createPerspective()`.
  - Action `clearPerspective()` → сброс.
  - **Селекторный доступ** ко всем новым полям (`useVisualizerStore((s) => s.scene.perspective)` в компонентах) — по конвенции frontend, без деструктуризации стора.
- [ ] `PerspectiveCorners.tsx` (UI уже есть): подключить `Apply` к `setPerspectiveCorners`.

### 1B.4 Дизайн

- [ ] Добавить визуальную индикацию режима перспективы в шапке canvas: бейдж `Inter 13px/500`, фон `#4CAF50`, текст `#FFFFFF`, `border-radius 6px`.
- [ ] Hover/выделение панели в перспективе — подсветка по контуру quad, толщина 2px, цвет `#4CAF50`.
- [ ] Цветовые константы (`GREEN`, `DARK`, `GRAY_TEXT`) — в начале каждого нового файла компонента (по `frontend/CONVENTIONS.md`).
- [ ] Все стили — inline objects (по конвенции). Без CSS-модулей и styled-components.

### 1B.5 Backend

- [ ] Без изменений. Все данные перспективы остаются в `localStorage` до Фазы 5C.

### 1B.6 Тесты

- [ ] Unit `panelWarpRenderer.test.ts`:
  - Warp единичного квадрата в трапецию — проверить, что углы выходного canvas соответствуют quad.
  - Кэш: повторный вызов с тем же quad возвращает тот же canvas; смена nonce → cache miss.
  - Edge: quad с двумя совпадающими точками → throw понятную ошибку.
- [ ] Component `KonvaCanvas.test.tsx`:
  - Сценарий: установить perspective → проверить, что render call идёт через `KonvaImage` с warped canvas, а не `Rect`.
  - Drag в перспективе: симулировать `dragmove` → ожидать вызов `onPanelMove` с **wall-space** координатами (не screen-space).
- [ ] Unit для миграции wall-space (E6): существующие panels без `wallSpace` + включение перспективы → `wallSpace` рассчитан корректно через `inverseTransformRect`.
- [ ] Интеграционный e2e (manual checklist в issue): загрузить фото, поставить 4 угла, разместить 5 панелей, убедиться визуально что они «лежат» на стене.

> **Definition of Done:** см. раздел «Definition of Done» в конце плана.

---

## Фаза 2: Связка калибровки масштаба с раскладкой

> **Цель:** Использовать `pixelsPerCm` из `ScaleCalibration` для расчёта реальных размеров панели. Сейчас панель 60×60 см рендерится «на глаз», после фазы — её пиксельный размер однозначно зависит от калибровки.
> **Зависимости:** Фаза 1B (нужен `wallSpace` в `PlacedPanel` и warp). Можно начинать **параллельно** с 1B.4–1B.6, если разработчик другой.
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Результат:** Панель 30×30 см на фото действительно занимает 30 см стены.

### 2.1 Frontend — domain logic

> **Внимание:** `panelSizeInPixels()` уже использует `calibration?.pixelsPerCm ?? 5` (`layoutEngine.ts:48`). Часть этой фазы — **аудит и достраивание**, не «с нуля». См. [R2].

- [ ] В `lib/layoutEngine.ts`:
  - **Не менять сигнатуру `placeSinglePanel`** — она уже принимает `calibration` (строка 215). Проверить, что все вызовы передают её корректно (могут быть `null` сейчас).
  - В режиме перспективы `wallSpace = { w: panelSize.widthCm * pxPerCm, h: panelSize.heightCm * pxPerCm }` (плоская стена в пикселях).
  - **`autoFillWall()` в перспективе** — отдельная ветка: итерируемся в wall-space по сетке, для каждой ячейки считаем quad через `transformRect`, проверяем покрытие стены через **проекцию маски в wall-space** (см. [R4], [R5]).
  - **`canPlacePanel()` в перспективе** — `wallCoverageInRect` не годится для quad. Реализовать `wallCoverageInQuad(mask, quad)` через сэмплинг точек внутри quad (или через rasterizer). См. [R5].
  - Если калибровки нет и нет fallback — **запретить auto-fill** и показать модал «Откалибруйте масштаб». Magic-number `5 px/cm` оставляем только для preview-эффекта в плоском режиме. См. [E3].
  - **Удалить `console.log('[autoFill]', ...)`** в строке 161.
  - **Заменить глобальный `panelIdCounter`** на `crypto.randomUUID()` или `${projectId}-${counter}`. См. [R6].
- [ ] В `lib/costCalculator.ts`:
  - `coveredAreaM2` считать через реальные см, а не пиксели.

### 2.2 Frontend — UI

- [ ] В `PhotoEditorPage.tsx`:
  - Если калибровка отсутствует — над canvas плашка `Inter 14px/400`, фон `#FFF8E1`, текст `#6B5500`: «Размер панелей приблизительный — откалибруйте масштаб для точного результата». Кнопка-ссылка «Откалибровать» открывает `CalibrationOverlay`.
- [ ] `CalibrationOverlay.tsx` уже есть — подключить `Apply` к `scene.calibration` через store action `setCalibration(cal: ScaleCalibration)`.

### 2.3 Backend

- [ ] Без изменений.

### 2.4 Тесты

- [ ] Расширить `layoutEngine.test.ts`:
  - Тест: панель 60×60 см при `pixelsPerCm = 5` → `renderWidth === 300`.
  - Тест fallback: без калибровки — старое поведение, есть warning в store.
  - Тест `wallCoverageInQuad` — quad полностью внутри маски стены → coverage = 1.0; quad наполовину снаружи → coverage ≈ 0.5.
  - Тест `autoFillWall` в перспективе: число размещённых панелей > 0, все имеют корректный `wallSpace`.
  - Тест запрета auto-fill без калибровки → пустой массив + warning.
- [ ] Расширить `costCalculator.test.ts`:
  - `coveredAreaM2` считается через реальные см.

---

## Фаза 3: Авто-определение перспективы (vanishing points)

> **Цель:** При загрузке фото автоматически предложить 4 угла стены. Пользователь подтверждает или корректирует.
> **Технология:** OpenCV.js (LSD line detection + RANSAC vanishing points).
> **Зависимости:** Фаза 1B (нужно куда показывать результат — warp). Фаза 2 опционально (auto-fill в перспективе становится осмысленным).
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Результат:** В 70% интерьерных фото юзер не трогает углы вообще.

### 3.0 Подготовка

- [ ] **Web Worker host**: создать `src/domains/visualizer/lib/cvWorkerHost.ts` — общий шаблон Worker с очередью задач (для VP-detector в Фазе 3 и YOLO-detector в Фазе 4). Реализовать ОДИН раз здесь, переиспользовать в Фазе 4.
- [ ] **Датасет**: создать `frontend/src/domains/visualizer/__tests__/fixtures/perspective/` — 20 фото интерьеров с эталонными углами в `expected.json`. Источник: открытые наборы (Hypersim/SUN360) или собственная съёмка. Назначить ответственного.

### 3.1 Frontend — сервис vanishing-point detection

- [ ] Установить `@techstark/opencv-js` (~8 MB, lazy-load).
- [ ] Создать `src/domains/visualizer/lib/vanishingPointDetector.ts`:
  - `initOpenCV(): Promise<void>` — lazy инициализация в Web Worker (не блокировать main thread).
  - `detectWallCorners(imageUrl: string, wallMask: WallMask): Promise<PerspectiveCorners | null>`:
    - **Нормализация координат**: маска SegFormer 512×512, фото может быть 4032×3024. Все координаты VP пересчитываются в систему фото перед возвратом. См. [T4].
    - **Фильтрация линий по wallMask**: LSD выдаёт все линии фото; брать только те, у которых ≥80% длины внутри маски стены — иначе RANSAC поймает линии мебели/окон. См. [T3].
    - LSD-детекция линий на фото.
    - Кластеризация по направлению → вертикальные / горизонтальные.
    - RANSAC → 2 vanishing points (горизонтальный + вертикальный).
    - Пересечение крайних линий внутри bounding box `wallMask` → 4 угла.
    - Возврат `null` если confidence < 0.6 (стена слишком пустая).
    - **Защита от нескольких стен в кадре** ([E1]): если найдены ≥3 кластеров направлений — возвращать `null` с диагностикой `'multi-plane'`, не угадывать.
- [ ] Web Worker `lib/vanishingPointWorker.ts` — оборачивает OpenCV.js, чтобы не блокировать UI.
  - **Координация с YOLO-воркером** (Фаза 4): запускать последовательно, не параллельно, на устройствах с RAM < 4 GB. См. [D3].
  - Feature detection WebAssembly + memory limit; при отказе — graceful skip, статус «авто недоступно».

### 3.2 Frontend — интеграция в store и pipeline

- [ ] В `visualizerStore.ts`:
  - В action `uploadPhoto()` после `segmentScene()` запустить `detectWallCorners()` параллельно.
  - Статус: `'detecting-perspective'` (между `'segmenting'` и `'ready'`).
  - Если результат `≠ null` → `scene.perspective = createPerspective(corners, fitWallSize(mask))`.
  - Флаг `scene.perspectiveAutoDetected: boolean` — для UI «было определено автоматически».
- [ ] В `PhotoEditorPage.tsx`:
  - После загрузки — если auto-detected — подсказка-toast `Inter 14px/400`, фон `#E8F5E9`, текст `#2E7D32`: «Перспектива определена автоматически. Поправьте углы, если нужно». Кнопка «Открыть редактор перспективы» переключает `editorMode = 'perspective'`.

### 3.3 Дизайн

- [ ] В режиме `'perspective'` — auto-detected углы рисуются `#4CAF50` (подтверждённо), при ручном перетаскивании — `#FF9800` (изменено пользователем).
- [ ] Spinner в шапке во время `'detecting-perspective'`: Ant Design `Spin`, текст «Определяем углы стены…».

### 3.4 Backend

- [ ] Без изменений.

### 3.5 Тесты

- [ ] Unit `vanishingPointDetector.test.ts` (моки OpenCV):
  - Mock LSD с 4 идеальными линиями → проверить корректные 4 угла.
  - Низкая confidence → `null`.
  - Multi-plane (≥3 кластера) → `null` с диагностикой `'multi-plane'`.
  - Mask 512×512 vs photo 4032×3024 — координаты выходных углов в системе фото (нормализация T4).
- [ ] Component `cvWorkerHost.test.ts`: очередь — две задачи в очереди → выполнение последовательное; abort прерывает текущую.
- [ ] Сценарий в `visualizerStore.test.ts`: upload → segment → detect-perspective → ready, перспектива записана.
- [ ] **Датасет-acceptance** (запускается вне CI, локально перед релизом): 20 фото из `__tests__/fixtures/perspective/` → метрика `≥ 14/20` углов в пределах 5% от эталона.

---

## Фаза 4: Авто-определение масштаба (детекция эталонов)

> **Цель:** Автоматически найти на фото объект известного размера (розетка, дверь, плинтус) и предложить one-click калибровку.
> **Технология:** YOLOv8n (ONNX ~6 MB), inference через `onnxruntime-web` в Web Worker (через `cvWorkerHost` из Фазы 3.0). Альтернатива: дообучение на интерьерах.
> **Зависимости:** Фаза 2 (нужна осмысленная связка калибровки и layout). Фаза 3 (для `cvWorkerHost`). Идеально — после обеих.
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Результат:** Пользователь видит подсветку розетки и кнопку «Использовать как эталон (8 см)» — клик и калибровка готова.

### 4.0 Подготовка

- [ ] Скачать предобученную модель YOLOv8n COCO (классы: `tv, refrigerator, oven, sink, toilet, microwave, ...`). Решить, дообучать ли на специфичных классах (`outlet, switch, baseboard`) — см. открытый вопрос #2.
- [ ] **Датасет**: создать `frontend/src/domains/visualizer/__tests__/fixtures/references/` — 30 фото с розетками/выключателями + bbox-разметкой в `expected.json`.

### 4.1 Frontend — сервис детекции эталонов

- [ ] Установить `onnxruntime-web` (~3 MB).
- [ ] Скачать готовую модель YOLOv8n COCO (или дообучить на классы `outlet, door, window, baseboard, light_switch` — отдельная задача датасайентисту).
- [ ] Создать `src/domains/visualizer/lib/referenceDetector.ts`:
  - `detectReferences(imageUrl: string): Promise<ReferenceCandidate[]>`
  - `ReferenceCandidate = { type: 'outlet'|'door'|'window'|'switch', bbox: BoundingBox, knownSizeCm: number, confidence: number }`
  - Inference через ORT Web в Web Worker.
- [ ] Создать `src/domains/visualizer/lib/scaleEstimator.ts`:
  - `estimateScaleFromReference(candidate: ReferenceCandidate, perspective?: PerspectiveTransform): ScaleCalibration`
  - **Если есть перспектива** — bbox эталона сначала проецируется в plane стены через `inverseTransformRect`, и `pixelsPerCm` считается уже в plane координатах. Иначе при наклоне bbox `width` искажён, и масштаб будет неправильным. См. [E4].
  - Использует длинную сторону bbox + `knownSizeCm` → `pixelsPerCm`.
- [ ] **Lazy-load YOLO**: не грузить 6 МБ ONNX при upload — инициализировать после первого взаимодействия с canvas (или скрытой prefetch через `requestIdleCallback`). См. [T5].

### 4.2 Frontend — UI выбора эталона

- [ ] Новый компонент `src/domains/visualizer/ui/ReferenceCandidatesOverlay.tsx`:
  - На canvas рисует прямоугольники-кандидаты (`stroke #4CAF50`, dashed).
  - Tooltip над каждым: «Розетка ~8 см. Использовать как эталон?» + кнопка `Применить`.
  - Клик `Применить` → action `setCalibration(...)` + закрытие overlay.
- [ ] Расширить `CalibrationOverlay.tsx`:
  - В верх добавить блок «Найдено автоматически:» со списком кандидатов (если есть).
  - Существующий ручной flow остаётся как fallback («Не подходит — выберите вручную»).

### 4.3 Frontend — интеграция в store

- [ ] В `visualizerStore.ts`:
  - Поле `scene.referenceCandidates: ReferenceCandidate[]`.
  - Запуск `detectReferences()` параллельно с `detectWallCorners()` после сегментации.
  - Флаг `scene.calibrationAutoDetected: boolean`.

### 4.4 Дизайн

- [ ] В шапке canvas — статус-чип «Масштаб: ✓ автоматически (по розетке)» / «Масштаб: ⚠ вручную» / «Масштаб: ✗ не задан».
- [ ] Цвета чипов: success `#E8F5E9 / #2E7D32`, warning `#FFF8E1 / #6B5500`, error `#FFEBEE / #C62828`.

### 4.5 Backend

- [ ] Без изменений. Финальная `ScaleCalibration` будет персиститься после Фазы 5.

### 4.6 Тесты

- [ ] Unit `referenceDetector.test.ts` (моки ORT): входной тензор → корректный bbox + class.
- [ ] Unit `scaleEstimator.test.ts`:
  - Без перспективы: bbox 100px + outlet (8 см) → `pixelsPerCm = 12.5`.
  - С перспективой: bbox в углу стены → проекция через inverse transform → корректный `pixelsPerCm` (E4).
- [ ] Component `ReferenceCandidatesOverlay.test.tsx`: клик на кандидате → store action вызван с правильным `ScaleCalibration`.
- [ ] **Датасет-acceptance** (вне CI): 30 фото из `__tests__/fixtures/references/` → precision ≥ 0.85, recall ≥ 0.7.

---

## Фаза 5A: Pre-task — Setup Alembic (если нужно)

> **Цель:** Убедиться, что Alembic настроен и хотя бы одна миграция применена. Если репозитории сейчас только in-memory — настроить.
> **Зависимости:** результат Фазы 0 (audit). Если Alembic уже есть и работает — пропускаем.
> **Атомарность:** независимая под-фаза, можно запустить параллельно с любой frontend-фазой.

### 5A.1 Backend — инфраструктура миграций

- [ ] Если в `backend/alembic/` отсутствует — проинициализировать: `alembic init alembic`, настроить `env.py` под асинхронный SQLAlchemy + `settings.DATABASE_URL` (по `backend/CONVENTIONS.md`).
- [ ] Создать «нулевую» миграцию по текущему состоянию ORM-моделей (если их ещё нет — это означает, что весь проект на in-memory; тогда Фаза 5A резко расширяется и должна быть отдельным планом, не частью этого).
- [ ] Проверить `alembic upgrade head` и `alembic downgrade -1` на пустой БД.

### 5A.2 Backend — тесты

- [ ] `tests/infrastructure/test_alembic.py`: smoke-test apply + rollback + apply.

> **Definition of Done:** `alembic upgrade head` отрабатывает без ошибок; `downgrade -1` возвращает БД в исходное состояние.

---

## Фаза 5B: Backend — domain + persistence для perspective/calibration

> **Цель:** Domain layer + ORM-модели + миграция новых полей. Без API — только данные.
> **Зависимости:** Фаза 5A.
> **Атомарность:** релиз-кандидат: схема готова, но фронт ещё не использует.

### 5B.1 Backend — Domain Layer

> **Важно**: НЕ сохранять `referenceCandidates` (runtime-результат ML-детекции), сохранять только финальную `calibration`, выбранную пользователем. См. [D2].

- [ ] В `backend/app/domain/visualizer/entities.py`:
  - Расширить `@dataclass Scene`: поля `perspective_corners: PerspectiveCorners | None`, `calibration: ScaleCalibration | None`, `perspective_auto_detected: bool`, `calibration_auto_detected: bool`, `version: int = 1`.
- [ ] В `backend/app/domain/visualizer/value_objects.py`:
  - `@dataclass(frozen=True) class ScaleCalibration` (поля mirror frontend type).
  - `@dataclass(frozen=True) class PerspectiveCorners` (4 точки в типобезопасном виде).
  - Метод `__post_init__` валидирует: ровно 4 точки + не коллинеарны (площадь quad > epsilon).
- [ ] В `backend/app/domain/visualizer/exceptions.py`:
  - `class CollinearCornersError(Exception)` — для невалидной перспективы.
  - `class StaleSceneVersionError(Exception)` — для multi-tab race (E8).

### 5B.2 Backend — Infrastructure (persistence)

> **Pre-check** (см. Фаза 5A): миграционная инфра должна быть готова.

- [ ] `infrastructure/persistence/models.py`:
  - Расширить `VisualizationProjectModel`: колонки `perspective_corners JSONB`, `calibration JSONB`, `perspective_auto_detected BOOL DEFAULT FALSE`, `calibration_auto_detected BOOL DEFAULT FALSE`, `version INT DEFAULT 1`.
- [ ] `infrastructure/persistence/repositories/visualizer_repo.py`:
  - Обновить маппинг `_to_entity` / `_to_model` для новых полей.
  - При `save()` — инкремент `version` + проверка прежнего значения (для оптимистичной блокировки). При несовпадении → `raise StaleSceneVersionError`.
- [ ] Alembic миграция:
  - Файл: `alembic/versions/{timestamp}_add_perspective_calibration_to_scenes.py`.
  - `upgrade()` + **обязательно** `downgrade()` (по `backend/CONVENTIONS.md`).
  - Описательное имя: `add_perspective_calibration_to_scenes`.

### 5B.3 Backend — тесты

- [ ] `tests/domain/test_visualizer.py`:
  - `test_perspective_corners_validates_collinearity` — degenerate quad → `CollinearCornersError`.
  - `test_scale_calibration_immutable` — попытка mutation замороженного value object.
  - `test_scene_version_default_one`.
- [ ] `tests/infrastructure/test_visualizer_repo.py`:
  - Round-trip persist Scene с perspective_corners, calibration → load → equal.
  - `save()` с устаревшим `version` → `StaleSceneVersionError`.
- [ ] `tests/infrastructure/test_alembic_visualizer_migration.py`:
  - `upgrade head` → `downgrade -1` → `upgrade head` (без data loss для сторонних таблиц).

> **Definition of Done:** домен и persistence готовы; API и frontend пока используют старый flow (без новых полей).

---

## Фаза 5C: Backend API + Frontend sync

> **Цель:** Endpoints для save/load/PATCH + frontend подключение к ним. После этого данные перспективы синхронизированы с сервером.
> **Зависимости:** Фаза 5B (домен и persist готовы), Фаза 1B (фронт умеет с perspective работать).
> **Атомарность:** релизуется одним PR, потому что endpoints без frontend-клиента бесполезны.

### 5C.1 Backend — Application Layer

- [ ] В `application/visualizer/use_cases.py`:
  - Расширить `SaveProject`: метод `execute()` принимает и сохраняет новые поля `Scene` (по конвенции — один use case = один класс с методом `execute()`).
  - Расширить `LoadProject.execute()`: возвращает их.
  - Новый use case `UpdatePerspective` (`execute(project_id, corners, version)`) — отдельная команда для частичного апдейта.
  - Новый use case `UpdateCalibration` (`execute(project_id, calibration, version)`).

### 5C.2 Backend — Infrastructure (API)

- [ ] `infrastructure/api/visualizer.py`:
  - Pydantic DTO с правильными суффиксами (по `backend/CONVENTIONS.md`):
    - `PerspectiveCornersUpdate` (Pydantic) — body для PATCH.
    - `CalibrationUpdate` — body для PATCH.
    - `SceneResponse` — расширить с новыми полями.
  - Расширить `POST /visualizer/projects` и `GET /visualizer/projects/{id}` под новые поля.
  - Новые роуты:
    - `PATCH /api/visualizer/projects/{id}/perspective` — `body: PerspectiveCornersUpdate`
    - `PATCH /api/visualizer/projects/{id}/calibration` — `body: CalibrationUpdate`
  - Маппинг доменных исключений в HTTP (по конвенции `infrastructure/api/error_handlers.py`):
    - `CollinearCornersError` → **422** + `{detail: "...", code: "degenerate_corners"}`. См. [D4].
    - `StaleSceneVersionError` → **409 Conflict** + текущее состояние. См. [E8].
  - OpenAPI описания + примеры в каждом роуте.

### 5C.3 Frontend — API client + store

- [ ] В `domains/visualizer/lib/visualizerApi.ts` (создать если нет):
  - `saveProject()` — обновить body согласно новой schema.
  - `updatePerspective(projectId, corners, version)` / `updateCalibration(projectId, cal, version)`.
  - Обработка `409 Conflict`: вернуть `version mismatch` → store решает что делать (показать toast «есть свежие данные с другого таба»).
  - Обработка `422 degenerate_corners`: тихий retry-skip (не показывать пользователю — это intermediate drag).
- [ ] В `visualizerStore.ts`:
  - Дебаунс 1 сек после изменения углов / калибровки → авто-PATCH на бэкенд (если проект сохранён).
  - **Локальная pre-валидация** non-collinearity перед отправкой. См. [D4].
  - **Стратегия конфликта localStorage vs backend**: при загрузке — backend version всегда побеждает; localStorage используется только как кэш для оффлайна. См. [R7].
  - **Undo для перспективы и калибровки** — добавить эти действия в существующий undo-stack (сейчас он только для маски). См. [E7].
  - При cancel/abort действий перспективы — отмена in-flight PATCH запросов через `AbortController`. См. [D6].
  - **Селекторный доступ**: компоненты обращаются к новым полям только через селекторы (по `frontend/CONVENTIONS.md`).

### 5C.4 Тесты (по DDD-слоям, согласно `backend/CONVENTIONS.md`)

- [ ] Backend `tests/application/test_update_perspective.py`:
  - happy path: existing project → корректный update.
  - degenerate corners → `CollinearCornersError`.
  - stale version → `StaleSceneVersionError`.
- [ ] Backend `tests/application/test_update_calibration.py` — аналогично.
- [ ] Backend `tests/application/test_save_project_with_perspective.py` — расширенный SaveProject.
- [ ] Backend `tests/api/test_visualizer_perspective_api.py`:
  - PATCH happy path → 200 + обновлённое значение.
  - PATCH degenerate → 422 + `code: degenerate_corners`.
  - PATCH stale version → 409 + текущее состояние.
- [ ] Frontend:
  - `visualizerApi.test.ts` — моки fetch для новых endpoints, обработка 409 и 422.
  - Интеграция в `visualizerStore.test.ts`: setPerspective → debounce 1s → авто-PATCH вызван (mock); abort при clearPerspective.

> **Definition of Done:** проект, сохранённый с перспективой, открывается через неделю с теми же углами и калибровкой. Multi-tab race возвращает 409.

---

## Фаза 6 (опционально): Depth Estimation на бэкенде

> **Цель:** Для случаев, когда vanishing-point detection дал низкий confidence (пустые однотонные стены), использовать ML-модель оценки глубины.
> **Технология:** MiDaS / Depth Anything V2 (ONNX), inference на бэкенде. Опционально GPU.
> **Зависимости:** Фаза 3 (frontend знает, как обработать ответ — `PerspectiveCorners`). Фаза 5C (есть API-инфраструктура, в которую интегрироваться).
> **Bounded Context:** backend / `visualizer` + frontend / `visualizer`.
> **Результат:** Авто-перспектива работает почти всегда (90%+).

### 6.1 Backend — ML инфраструктура

- [ ] Решение по инфраструктуре (design-doc `docs/design-docs/DEPTH-ESTIMATION-INFRA.md`):
  - Вариант A: FastAPI + `onnxruntime` на CPU (медленно, ~3–5 сек/фото, бесплатно).
  - Вариант B: GPU-инстанс (3–10k ₽/мес).
  - Вариант C: managed inference API (Replicate / Modal / HuggingFace, ~$0.005/вызов).
- [ ] Выбор и обоснование.

### 6.2 Backend — Domain + Application

- [ ] В `domain/visualizer/services.py`:
  - `class PlaneFittingService` (stateless) — RANSAC fitting плоскости по точкам с depth. Без зависимостей от ML/инфры.
- [ ] В `application/visualizer/use_cases.py`:
  - `class DetectPerspectiveFromDepth` — `execute(image_bytes, wall_mask) -> PerspectiveCorners | None`.
  - Координирует: вызов `IDepthEstimator` (ABC из domain) → `PlaneFittingService` → `PerspectiveCorners`.

### 6.3 Backend — Infrastructure

- [ ] `domain/visualizer/repositories.py` (или новый `services.py`): добавить ABC `IDepthEstimator`.
- [ ] `infrastructure/ml/midas_depth_estimator.py`:
  - Реализация `MiDaSDepthEstimator(IDepthEstimator)` (CPU через onnxruntime) **или** `ReplicateDepthEstimator(IDepthEstimator)` (managed API) — выбор по конфигу `DEPTH_PROVIDER` в `settings`.
- [ ] `infrastructure/api/visualizer.py`:
  - Endpoint `POST /api/visualizer/perspective/auto-detect` — body: `multipart/form-data { photo, wall_mask_png }`.
  - Async очередь — фронт получает 202 + polling URL, либо WebSocket-прогресс.
- [ ] `config.py`: добавить `DEPTH_PROVIDER: Literal["local", "replicate"]`, `DEPTH_API_KEY: str | None`.

### 6.4 Frontend

- [ ] В `lib/vanishingPointDetector.ts`: если LSD-confidence < 0.6 **и** `editorMode !== 'perspective'` (юзер ещё не открыл ручной редактор) → fallback на бэкенд `auto-detect`. См. [D6].
- [ ] Прогресс «Анализ глубины…» в шапке canvas (Ant Design `Progress`).
- [ ] EXIF orientation нормализация на фронте перед upload. См. [T8].

### 6.5 Тесты

- [ ] Backend `tests/domain/test_plane_fitting.py`: чистый unit-тест `PlaneFittingService` (фиктивный depth_map → ожидаемая нормаль).
- [ ] Backend `tests/application/test_detect_perspective_from_depth.py`: мок `IDepthEstimator` + мок `PlaneFittingService` → корректная оркестрация.
- [ ] Backend `tests/api/test_perspective_auto_detect_api.py`: интеграция с мок-IDepthEstimator.
- [ ] Frontend: race-condition тест — late depth response при `editorMode === 'perspective'` → ответ игнорируется.
- [ ] **Датасет-acceptance** (вне CI): 50 «сложных» фото → coverage с фазой 6 vs без.

> **Definition of Done:** для пустой однотонной стены, где фаза 3 возвращала `null`, теперь возвращается валидный `PerspectiveCorners` в ≥70% случаев.

---

## Риски и митигации

Сводный реестр. Идентификаторы (R/D/T/E) используются в чек-листах фаз выше.

### R — Регрессии: новый код пересекается с существующим

| ID | Фаза | Где | Риск | Митигация |
|---|---|---|---|---|
| **R1** | 1 | `KonvaCanvas.tsx:555–578` — ветка перспективы рендерит `<Line closed fill={panel.color}>` без дизайна | Существующая ручная перспектива уже визуально сломана — фаза 1 должна **починить**, а не «дополнить» | Первый чек-бокс фазы 1.2 — заменить эту ветку. Скриншот «до/после» в QA |
| **R2** | 2 | `layoutEngine.ts:43–53` — `panelSizeInPixels()` уже принимает `calibration` | Двойная работа + риск сломать тесты при «изменении сигнатуры» | Не менять сигнатуру, аудит вызовов, расширить покрытие тестами |
| **R3** | 1 | `KonvaCanvas.tsx:600,630` — `draggable={... && !perspectiveCorners}` | Включение drag в перспективе без правильной обработки координат → панели «прыгают» от screen-space к wall-space | Реализовать `inverseTransformPoint` для drag handler и **сначала** покрыть unit-тестом маппинга |
| **R4** | 2 | `layoutEngine.ts:183–184` — `for (let y; ...; y += heightPx)` | Auto-fill в перспективе ставит панели «не по стене», а строго по осям фото | Отдельная ветка `autoFillWall` для перспективы: итерация в wall-space + `transformRect` каждой ячейки |
| **R5** | 2 | `layoutEngine.ts:99` — `wallCoverageInRect(mask, x, y, w, h)` | В перспективе панель — quad; bbox по нему сильно завышен → массовое отвержение валидных placement | Реализовать `wallCoverageInQuad` через сэмплинг точек внутри quad |
| **R6** | 2/5 | `layoutEngine.ts:24` — `let panelIdCounter = 0` (модуль-level) | Конфликты ID при загрузке проекта с бэкенда + смешивание с свежими | Перейти на `crypto.randomUUID()` |
| **R7** | 5 | `visualizerStore.ts` имеет localStorage persist | Конфликт «свежести» localStorage vs backend → юзер видит устаревшие данные | Стратегия: backend всегда побеждает при загрузке; localStorage = оффлайн-кэш |
| **R8** | 1 | Глобальный `konvaDesignImageCache` (Map) | Смешивание warped и non-warped канвасов → визуальные баги при смене перспективы | Отдельный `panelWarpCache` с инвалидацией по nonce перспективы |

### D — Неявные зависимости backend ↔ frontend

| ID | Фазы | Риск | Митигация |
|---|---|---|---|
| **D1** | 3,4 → 5 | Поля `perspective_auto_detected`/`calibration_auto_detected`/`referenceCandidates` появляются на фронте раньше, чем в схеме backend | Решить сразу: что персистится (`*_auto_detected` — да; `referenceCandidates` — нет, см. D2). Schema-first подход |
| **D2** | 4 → 5 | `referenceCandidates` — runtime-данные, могут «попасть» в SaveProject как лишний payload | Явно исключить из API DTO. Тест: PUT/PATCH с этим полем → 422 |
| **D3** | 3,4 | Два Web Worker (OpenCV + ONNX) запущены параллельно при upload → OOM на мобильном | Sequential queue: VP-detect завершается → запускается reference-detect. Feature-detect RAM, на ≤4 GB — отключать reference-detect |
| **D4** | 5 | Backend строго валидирует non-collinearity углов; debounced PATCH присылает промежуточное drag-состояние | Frontend pre-check; backend → 422 + понятный код, retry с exponential backoff |
| **D5** | 5 | В backend могут быть только in-memory repos — Alembic вообще не настроен | Pre-task в Фазе 5: «Setup Alembic + first migration». Заложить +1 день |
| **D6** | 6 | Depth-fallback может прийти после того, как юзер уже работает руками | Race-resolution: при `editorMode === 'perspective'` (юзер открыл редактор) — игнорировать поздние ответы depth |

### T — Технически сложные места

| ID | Фаза | Риск | Митигация |
|---|---|---|---|
| **T1** | 1 | Bilinear warp в JS — алиасинг и швы; на 60×60 см при 5 px/cm = 300×300 px → тормоза при 50 панелях | WebGL-шейдер (Pixi/regl); benchmark на этапе 1.1 |
| **T2** | 1 | Inverse homography возле horizon line → деления на ~0 → панель «уезжает в бесконечность» | Clamp wall-space координат внутри `[0, wallW] × [0, wallH]` |
| **T3** | 3 | RANSAC vanishing points ловит линии вне стены (мебель, отражения) → неправильные углы | Фильтрация LSD-линий по `wallMask` (≥80% длины внутри маски) |
| **T4** | 3 | `wallMask` — 512×512 (SegFormer), фото — 4032×3024 → координаты не сходятся | Явная нормализация в API `detectWallCorners`; assertion на размерности |
| **T5** | 4 | YOLO ONNX 6 МБ грузится 5–10 сек на медленном интернете → блок при upload | Lazy-load после первого UI-взаимодействия или `requestIdleCallback` prefetch |
| **T6** | 1 | WebGL-контекст лимит браузера (16 в Chrome) — Konva + Pixi + Before/After + zoom-окно | Один общий offscreen WebGL renderer; в Фазе 0 посчитать существующие контексты |
| **T7** | 1 | `computeBrightnessAdjustment` сейчас даёт `opacity`, но при warp нужна полноценная коррекция через canvas filter | Вынести коррекцию внутрь `panelWarpRenderer` |
| **T8** | 6 | EXIF orientation — мобильные фото «лежат» → углы перспективы повёрнуты | Нормализация EXIF на фронте перед upload + перед inference |

### E — Edge cases, не покрытые в плане

| ID | Фаза | Edge case | Митигация |
|---|---|---|---|
| **E1** | 3 | Несколько стен в кадре (угол комнаты) — VP-detect находит ≥3 направлений | Возврат `null` + диагностика `'multi-plane'`; UI: «Не уверены — отметьте углы вручную» |
| **E2** | 2 | Стена с дверями/окнами — auto-fill оставляет «дыры», непонятно почему | Подсветка obstacle-зон полупрозрачным красным + tooltip «здесь дверь, панель не помещается» |
| **E3** | 2 | Нет ни эталона, ни ручной калибровки → magic-number 5 px/cm | Запрет auto-fill + модал «Откалибруйте, иначе размер приблизительный» |
| **E4** | 4 | Эталон в перспективе — bbox искажён → неправильный `pixelsPerCm` | Сначала перспектива, потом проекция bbox эталона в plane стены через inverse transform |
| **E5** | 5 | При load проекта VP-detector выдаёт другие углы, чем сохранённые | Приоритет — сохранённые. Toast: «Есть новое предложение — применить?» (опционально) |
| **E6** | 1 | У юзера 30 панелей без перспективы → включает перспективу — панели не там | Миграция координат: `wallSpace = inverseTransformRect(currentXY)` при первом включении |
| **E7** | 5 | Undo не работает для углов перспективы и калибровки | Добавить эти действия в существующий undo-stack |
| **E8** | 5 | Multi-tab race — два таба переписывают друг друга | Optimistic locking через `version` в схеме + 409 Conflict на бэкенде |
| **E9** | 1/3 | Drag углов перспективы за границы фото — quad валиден математически, но wall-space теряет смысл | Soft-clamp: визуально позволять, но `transformRect` отрезать выходящие за границы |
| **E10** | 3,4,6 | iOS Safari, < 256 MB heap — OpenCV+ONNX+WebGL может уронить вкладку | Feature detection + graceful degrade в pure manual режим |
| **E11** | 3 | Низкое качество JPEG (артефакты блоков) → LSD ловит ложные линии | Pre-blur + порог confidence ≥ 0.7 (не 0.6) на «грязных» фото; flag `'low-quality'` на основе entropy |
| **E12** | 1 | Юзер размещает 50 панелей → жмёт «Сбросить перспективу» — что с ними? | Confirm-модал «Сохранить позиции в плоском режиме?» (через прямую проекцию quad → bbox) |

---

## Сводная таблица: трудозатраты и зависимости

| Фаза | Frontend | Backend | ML/CV | Зависимости | Атомарный релиз | Полезность |
|---|---|---|---|---|---|---|
| 0 — Аудит | 1 день | — | — | нет | doc-only | необходимо |
| **1A** — Hot-fix регрессии R1 | 1 день | — | — | Фаза 0 | ✅ да | срочно |
| **1B** — Полный warp + wall-space | 6–8 дней | — | — | 1A | ✅ да | **высокая** |
| 2 — Калибровка ↔ layout | 4–5 дней | — | — | 1B (можно ||) | ✅ да | **высокая** |
| 3 — Auto-perspective (VP) | 10–12 дней | — | OpenCV.js | 1B (+ 2 опц.) | ✅ да | очень высокая |
| 4 — Auto-calibration (YOLO) | 10–12 дней | — | YOLOv8n + датасет | 2 + 3 (для cvWorkerHost) | ✅ да | высокая |
| **5A** — Setup Alembic | — | 1–2 дня | — | Фаза 0 | ✅ да | блокер для 5B |
| **5B** — Domain + persistence | — | 4–5 дней | — | 5A | ✅ да (без API) | средняя |
| **5C** — API + frontend sync | 3–4 дня | 2–3 дня | — | 5B + 1B | ✅ да | средняя |
| 6 — Depth estimation (опц) | 3 дня | 6–8 дней | MiDaS + GPU/API | 3 + 5C | ✅ да | edge-cases |

> Каждая sub-фаза — **самостоятельный релиз**: можно остановиться после неё, ничего не сломается.
> Цифры включают buffer на риски (R/D/T/E). Без buffer — сроки на 30–40% меньше, но вероятность провала растёт.

**Hot-fix-набор (1 день)**: Фаза 0 + 1A → закрывает критическую регрессию (R1) в существующей ручной перспективе. Можно зарелизить отдельным PR.

**Минимальный полезный набор**: Фазы 0 + 1A + 1B + 2 → **~12 дней** frontend-разработчика, без новой инфраструктуры. Даёт работающий ручной режим перспективы и правильные размеры панелей.

**Рекомендуемый продакшн-набор**: 0 + 1A + 1B + 2 + 3 + 5A + 5B + 5C → **~6–7 недель** одного fullstack-разработчика, без GPU-затрат.

**Премиум-набор**: + Фазы 4 и 6 → **+ 4 недели** + датасет (200 размеченных фото) + GPU-инстанс ≈ 5–10k ₽/мес или ~$50/10k фото на managed API.

---

## Definition of Done — критерии завершённости каждой фазы

Каждая фаза считается завершённой только при выполнении **всех** общих и фазе-специфичных критериев.

### Общие (для всех фаз, кроме 0)

- [ ] Все чек-боксы фазы закрыты (`- [x]`).
- [ ] Тесты в подсекции «Тесты» зелёные (`vitest run` для frontend, `pytest` для backend).
- [ ] Покрытие новых модулей: ≥85% lines (`vitest --coverage` / `pytest --cov`).
- [ ] Линт чистый: `npm run lint` (frontend) / `ruff check .` (backend).
- [ ] Нет `console.log` / `print` в новом коде (по конвенциям). Только `logger.info` на бэкенде.
- [ ] DDD-границы соблюдены: `domain` не импортирует из `application` / `infrastructure`; домен `visualizer` не импортирует UI из других доменов.
- [ ] Соблюдена конвенция именования: PascalCase для компонентов/типов, camelCase для lib, snake_case для backend файлов.
- [ ] PR-описание содержит: что делает, какие риски (R/D/T/E) закрыты, скриншоты при UI-изменениях.
- [ ] Регрессий по существующим тестам нет (полный test suite зелёный).

### Фаза-специфичные DoD

| Фаза | Критерий |
|---|---|
| 0 | `docs/design-docs/PERSPECTIVE-AUDIT.md` создан с ответами на все 6 вопросов |
| 1A | При включении ручной перспективы видна **текстура дизайна** на quad, а не цветная заливка |
| 1B | Панель в перспективе рендерится через warp; FPS ≥ 30 при 50 панелях; drag работает в wall-space |
| 2 | Панель 30×30 см при `pixelsPerCm = 5` имеет `renderWidth = 150`; auto-fill в перспективе размещает корректно |
| 3 | На 14 из 20 фикстур из `__tests__/fixtures/perspective/` возвращены углы в пределах 5% от эталона |
| 4 | На 30 фикстурах precision ≥ 0.85, recall ≥ 0.7 для розеток/выключателей |
| 5A | `alembic upgrade head` + `downgrade -1` + `upgrade head` работают без ошибок |
| 5B | Round-trip Scene с perspective+calibration через repository — поля сохраняются точно |
| 5C | Сохранение проекта через UI → перезагрузка страницы → углы и калибровка восстановлены |
| 6 | Для пустых стен (где Фаза 3 = `null`) Фаза 6 даёт валидные углы в ≥70% случаев |

---

## Acceptance Criteria (по итогу всех фаз)

- [ ] При загрузке фото типового интерьера за ≤ 5 сек на ноутбуке с интегрированной графикой автоматически определяются: маска стены (уже есть), 4 угла перспективы, минимум 1 эталон масштаба.
- [ ] Размещённая панель 30×30 см при калибровке через розетку имеет физически корректный размер (±10%).
- [ ] Панель в перспективе рендерится как warped quad, FPS при 50 панелях ≥ 30 на средней машине.
- [ ] Юзер может в любой момент переключиться в ручной режим и поправить углы / калибровку.
- [ ] При повторной загрузке проекта (после `SaveProject`) перспектива и калибровка восстанавливаются с бэкенда.
- [ ] Все новые модули покрыты unit-тестами (≥ 85% lines), сценарий «upload → auto-detect → place panels → save → reload» покрыт integration-тестом.

---

## Открытые вопросы (требуют решения до старта)

1. **WebGL или offscreen canvas** для warp? — решается в Фазе 1.1.
2. **YOLO**: брать готовую COCO или дообучать на интерьерных классах (`outlet`, `switch`, `baseboard`)? Дообучение требует датасета и MLE-ресурса.
3. **Depth estimation**: CPU локально (медленно, бесплатно) vs managed API (быстро, стоит денег)? Решается в Фазе 6.1.
4. **Web Worker инфраструктура**: общий шаблон воркеров для CV-задач, или каждый сам? Предлагается общий `lib/cvWorkerHost.ts`.
5. **Fallback порядок** при низкой confidence: VP → depth → manual? Описать в design-doc после Фазы 3.
6. **Alembic в проекте** — настроен или нет? Если нет, кто и когда его настраивает? (см. [D5])
7. **Стратегия миграции существующих проектов** в localStorage юзеров — как открыть старый проект без `version` поля (см. [E8])?
8. **Поведение `wallSpace` для уже размещённых панелей** при первом включении перспективы — auto-migrate ли, или сбросить расстановку (см. [E6])?
9. **Confirmation flow** при сбросе перспективы с панелями (см. [E12]) — модал, undo, или silent reset?

---

> **Следующий шаг**: запустить Фазу 0 (аудит). По её результатам уточнить детали Фазы 1.
