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

## Фаза 1A: Hot-fix визуальной регрессии перспективы ✅ ЗАВЕРШЕНА (24.04.2026)

> **Цель:** Закрыть критический баг R1 — в существующей ручной перспективе панели рендерятся как сплошной цветной quad без дизайна. Это **минимальный self-contained релиз**, не требующий новых зависимостей.
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Атомарность:** делается и проверяется независимо от Фазы 1B и далее.

### 1A.1 Frontend — patch рендеринга

- [x] В `KonvaCanvas.tsx:554–610` заменена ветка перспективы: outer `<Group>` → inner `<Group clipFunc>` по quad, внутри `<KonvaImage>` дизайна (rect-rendered) + цветной `<Line>` (backdrop без дизайна / color tint при наличии); снаружи clip — отдельный `<Line>` с обводкой и тенью (чтобы quad-границы не обрезались).
- [x] Удалён дебаг `console.log('[autoFill]', ...)` в `layoutEngine.ts:161`.

### 1A.2 Frontend — тесты

- [x] Добавлен мок `<Line>` в `__tests__/KonvaCanvas.test.tsx` (раньше отсутствовал) с `data-fill` для проверки backdrop-цвета.
- [x] Мок `<Group>` теперь экспонирует `data-clipped="true|false"` в зависимости от наличия `clipFunc` — это атомарный сигнал, что новый код-путь активен.
- [x] 4 новых теста в `describe('perspective rendering (R1 hot-fix)')`:
  - clipFunc Group присутствует, когда `perspectiveCorners` заданы;
  - backdrop Line с `panel.color` рендерится в перспективе;
  - не падает, если перспектива включена, но картинка дизайна ещё не загружена;
  - регрессия: без `perspectiveCorners` clip-Group для панели не создаётся.
- [x] Все 16/16 KonvaCanvas-тестов зелёные. Регрессия `layoutEngine.test.ts` + `perspectiveEngine.test.ts` — 40/40 зелёные. `tsc --noEmit` — чисто.

### 1A.3 Дизайн / QA

- [ ] Скриншот «до/после» с реальным фото в design-doc — **отложено**: требует UI-сессии с прогоном через браузер, не делается в Фазе 1A автоматически. Будет приложено в момент QA-релиза.

### 1A.4 Аудит реализации (24.04.2026)

> **Метод:** code-review line-by-line всех изменённых файлов из коммита Фазы 1A; перекрёстная проверка с `frontend/CONVENTIONS.md`; полный прогон test-suite домена `visualizer` (16 файлов / 157 тестов); проверка типов через резолв `Konva.Context` в `node_modules/konva/lib/_CoreInternals.d.ts:198,211`; статический поиск остаточных `console.log` / `any` в изменённых файлах.

#### Что именно проверено

| Артефакт | Что искал | Результат |
|----------|-----------|-----------|
| `KonvaCanvas.tsx:554-610` (новая ветка perspective) | Структуру `<Group>/<Group clipFunc>/<KonvaImage>+<Line>/<Line>`; типизацию `ctx: Konva.Context`; передачу `panelHandlers` на топовый `<Line>` (а не на `<KonvaImage>`); `listening={false}` у фоновых элементов; opacity-арифметику `0.85 + brightnessAdj` и `designImg ? 0.25 : 0.85+adj`; цвет fallback `#CCCCCC` | Соответствует логике плоской ветки (614-665), R1 закрыт |
| `KonvaCanvas.tsx:1-12` (импорты) | Добавлены ли `Line`, `transformRect`, `quadToFlatPoints`, `Konva` (type-only); кэш `konvaDesignImageCache` не сломан | Все импорты на месте, `import type Konva from 'konva'` работает (Context экспортирован в namespace) |
| `layoutEngine.ts` | Удалён ли debug `console.log('[autoFill]', …)` из `autoFillWall()` | Удалён; других `console.*` в файле нет; `console.error` в `visualizerStore.ts:219` — легитимный (в catch-блоке), не из этой фазы |
| `KonvaCanvas.test.tsx` | Полнота моков react-konva (Line раньше отсутствовал!); поведение мока `Group` относительно `clipFunc`; покрытие новой ветки 4 тестами | Mock `<Line>` добавлен с `data-fill`; `<Group>` инвоцирует `clipFunc(stubCtx)` и выставляет `data-clipped`; есть тест регрессии для не-perspective ветки |
| Конвенции (`frontend/CONVENTIONS.md`) | Без `any` в продовом коде; PascalCase/camelCase; inline styles; селекторный Zustand (стор не трогали) | Соответствует. `(el as any)` в тесте — pre-existing с `eslint-disable`, не из Фазы 1A |
| Тип `Konva.Context` | Резолвится через `import type Konva from 'konva'` | `node_modules/konva/lib/_CoreInternals.d.ts:198` (`Context: typeof Context`) и `:211` (`type Context = …`) — namespace expose подтверждён |
| Регрессия тестов | `vitest run src/domains/visualizer/` | **16 файлов / 157 тестов — все зелёные** (18.42s) |

#### Критические проблемы (блокируют фичу)

**Не найдено.** Ветка perspective включается только при `perspectiveTransform != null`, имеет полное покрытие (clip-Group + backdrop Line + outline Line), не падает без `designImg`, не ломает плоскую ветку (регресс-тест зелёный + ручная диффовка с lines 614-665).

#### Некритические проблемы (технический долг)

| # | Файл / стр. | Проблема | Серьёзность | Статус |
|---|-------------|----------|-------------|--------|
| A1 | `KonvaCanvas.tsx:567-574` | `quadClipFunc` создаётся **в render-loop** на каждый рендер каждой панели — нет `useMemo`. При 50+ панелях добавит давление на GC. Не влияет на корректность. | low | ⏸ Отложено в Фазу 1B — warp перепишет эту ветку целиком, фикс сейчас = выброшенная работа |
| A2 | `KonvaCanvas.tsx:599-608` | Тень и обводка применены **только к outline Line** снаружи clip. В плоской ветке тень — у самого `KonvaImage` (`:628-630`). Визуально: тень в перспективе чуть «другая», лежит вокруг quad, а не под текстурой. | low | ⏸ Отложено в Фазу 1B — косметика, уместно фиксить вместе с warp |
| A3 | `KonvaCanvas.test.tsx:54-77` | Mock `<Group>` оборачивал вызов `clipFunc` в `try/catch` и **глушил все ошибки**. Если в `clipFunc` возникнет реальный bug (например `quad[0]` undefined), тест не падал. | low | ✅ **Исправлено 24.04.2026** — `try/catch` удалён, ошибки теперь всплывают наружу; комментарий обновлён. Все 16/16 тестов KonvaCanvas и 157/157 domain visualizer — зелёные. |
| A4 | `KonvaCanvas.test.tsx:295,310,326` | Уродливый каст `corners as unknown as Parameters<typeof KonvaCanvas>[0]['perspectiveCorners']` повторялся 3 раза. | low | ✅ **Исправлено 24.04.2026** — тип `PerspectiveCorners` импортирован из `../model/types`, `const corners: PerspectiveCorners = [...]` объявлен один раз, все 3 каста удалены. `tsc --noEmit` — чисто. |
| A5 | `KonvaCanvas.test.tsx:319-330` | Тест «не падает без загруженной картинки» **слабый**: в нём `panelImages` всегда пуст (нет загрузчика), т.е. ветка `designImg = null` тестируется и в обычных кейсах. Реально не покрывает «картинка ещё грузится». | low | ⏸ Отложено в Фазу 1B — усилить, замокав `panelImages` Map с loading-состоянием, вместе с новыми тестами warp-кэша |
| A6 | `KonvaCanvas.test.tsx:332-339` | Регресс-тест считает clipped-Group по факту наличия `data-clipped="true"` без привязки к panel.id. Если в будущем появится другой clipped Group (например, для accent-zone) — тест ложно позеленеет/покраснеет. | low | ⏸ Отложено в Фазу 1B — добавить `data-panel-id` в компонент и сузить селекторы; уместно делать одним коммитом с warp-ветвлением |
| A7 | `KonvaCanvas.test.tsx` весь | Нет теста: (а) **порядка рендера** внутри clip — `KonvaImage` должен идти ДО color tint Line, иначе цвет затрёт текстуру; (б) **outline Line — снаружи clip** (сейчас просто проверяется наличие); (в) поведения при **загруженном `designImg`** (opacity 0.25 у tint vs 0.85 у backdrop). | medium | ⏸ Отложено в Фазу 1B при переезде на warp |
| A8 | `1A.3` | Скриншот «до/после» с реальным фото не приложен. Чек-лист помечен как «отложено», но без него нельзя 100% объявить R1 закрытым визуально. | medium | ⏸ QA-сессия перед Фазой 1B (требует UI-прогона через браузер, не автоматизируется) |

#### Итог пост-аудит-фикса (24.04.2026)

- Исправлены **A3, A4** — единственные пункты, безопасно фиксимые вне Phase 1B (test-only, не пересекаются с будущим warp-рефактором).
- **A1, A2, A5, A6, A7** остаются в Фазе 1B — их код/тесты будут переписаны при переходе на warp, фикс сейчас = двойная работа.
- **A8** — ручная QA-задача перед релизом Фазы 1B.
- Регрессия: `vitest run src/domains/visualizer/` — **16 файлов / 157 тестов зелёные**. `tsc --noEmit` — чисто.

#### Вывод

Phase 1A принята как hot-fix RC: критических багов и регрессий нет, тесты зелёные, типы валидны, конвенции не нарушены. Оставшиеся 6 пунктов (A1, A2, A5, A6, A7, A8) — явно адресуемый тех.долг в Фазе 1B и QA.

> **Definition of Done:** ✅ при включении ручной перспективы видно текстуру дизайна (внутри quad-clip), а не цветную трапецию. Backdrop `panel.color` сохранён под полупрозрачным дизайном. Релиз-кандидат готов.
> **Аудит:** ✅ пройден 24.04.2026 — критических проблем нет, тех.долг частично закрыт (A3, A4), остальное (A1, A2, A5, A6, A7, A8) отнесено в Фазу 1B и QA.

---

## Фаза 1B: Честный perspective-warp + wall-space для панелей

> **Цель:** Полноценный 4-точечный warp текстуры панели. Введение `wallSpace` координат в `PlacedPanel`. Drag в режиме перспективы.
> **Технология:** Выбрана в 1B.1 — offscreen canvas + кусочно-аффинный mesh-warp (8×8 сетка → 128 треугольников). Без новых зависимостей. Подробнее — `docs/design-docs/PANEL-WARP-RENDERER.md`.
> **Зависимости:** Фаза 1A (без неё нельзя визуально оценить улучшение). Фаза 0 (audit).
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.

### Разбиение

Фаза 1B большая и потенциально рисковая — выполняется в две итерации:

| | v1 (этот коммит) | v2 (отдельный коммит) |
|---|---|---|
| Закрывает R1 визуально | ✅ | — |
| Mesh-warp + кэш | ✅ | улучшения (LRU touch) |
| KonvaCanvas использует warped canvas | ✅ | + clamp + brightness filter |
| `wallSpace` в `PlacedPanel` + миграция | — | ✅ |
| Drag в перспективе (wall-space coords) | — | ✅ |
| Бейдж режима + hover quad outline | — | ✅ |
| Тесты warp-математики | ✅ | + canvas-render snapshot (опц.) |
| Тесты KonvaCanvas (warp + fallback) | ✅ | + drag/migration |

### 1B.1 Frontend — выбор технологии warp ✅ ЗАВЕРШЕНА (24.04.2026)

- [x] Создан `docs/design-docs/PANEL-WARP-RENDERER.md`:
  - Сравнены три варианта: (a) Konva native + skew, (b) offscreen canvas + mesh warp, (c) WebGL/Pixi.
  - **Решение:** (b) offscreen canvas + кусочно-аффинный mesh warp по сетке 8×8 (128 треугольников). Не вводим новых зависимостей; math-часть testable без `<canvas>`.
  - Бенчмарк отложен до v2 (нужно реальное QA-окружение); внутренний расчёт показывает ~1ms / panel при 8×8.

### 1B.2 v1 Frontend — реализация warp-рендерера + интеграция ✅ ЗАВЕРШЕНА (24.04.2026)

- [x] Создан `src/domains/visualizer/lib/panelWarpRenderer.ts`:
  - `renderPanelToQuad(opts: WarpOptions): WarpResult` — wrapper, возвращает offscreen canvas + bbox.
  - **Чистые функции:** `buildMeshTriangles()`, `affineFromTriangles()`, `quadBoundingBox()` — testable без canvas.
  - **Кэш** module-level `Map<string, WarpResult>` (FIFO eviction, `MAX_CACHE_ENTRIES = 100`). Ключ: `designUrl|quadHash|opacity|colorTint`. Отдельный от `konvaDesignImageCache`.
  - `clearWarpCache()` экспортирован для инвалидации.
- [x] `KonvaCanvas.tsx`:
  - Импорт `renderPanelToQuad`, `clearWarpCache`.
  - `useEffect` сбрасывает кэш при изменении `perspectiveTransform`.
  - В perspective-ветке: если `designImg` загружен → `<KonvaImage image={warpedCanvas} x={bbox.x} y={bbox.y} ... />` + outline `<Line>` снаружи. Если нет → fallback на Phase 1A clip-подход (чтобы quad сразу виден, пока картинка грузится).

### 1B.2 v2 Frontend — wallSpace + drag (deferred)

- [ ] Расширить `PlacedPanel`:
  - Добавить `wallSpace?: { x, y, w, h }` (координаты в плоской системе стены).
  - В v1 `panel.x/y` интерпретируются как wall-space, когда `perspectiveTransform != null` — это работает, но смешивает семантику. v2 разделяет.
  - **Миграция** при первом включении перспективы: `wallSpace = inverseTransformRect(currentXY)`. См. [E6].
- [ ] `KonvaCanvas.tsx`:
  - Drag & drop в перспективе работает в **wall-space** (`inverseTransformPoint` от мыши). Снять блокировку `&& !perspectiveCorners` в `draggable` (см. [R3]).
  - **Clamp wall-space координат внутри bounds стены** перед записью в store. См. [T2].
  - **Учёт яркости стены** через canvas filter в `panelWarpRenderer`, не только через `opacity` (см. [T7]).
  - **Memoize warp results** на уровне `useMemo(() => panels.map(...))` — сейчас они кэшируются глобально, но React всё равно вызывает render-функцию каждый раз.

### 1B.3 v2 Frontend — интеграция в store (deferred)

- [ ] В `visualizerStore.ts`:
  - Опциональный `scene.perspective: PerspectiveTransform | null` (вычисляется в action `setPerspectiveCorners`, чтобы не считать каждый рендер).
  - **Селекторный доступ** ко всем новым полям — по конвенции frontend.
- [ ] `PerspectiveCorners.tsx` (UI уже есть): убедиться, что `Apply` дёргает `setPerspectiveCorners`.

### 1B.4 v2 Дизайн (deferred)

- [ ] Бейдж режима перспективы в шапке canvas: `Inter 13px/500`, фон `#4CAF50`, текст `#FFFFFF`, `border-radius 6px`.
- [ ] Hover/выделение панели в перспективе — подсветка по контуру quad, толщина 2px, цвет `#4CAF50` (сейчас уже есть outline через `<Line>`, но цвет hover не различается визуально достаточно).
- [ ] Цветовые константы (`GREEN`, `DARK`, `GRAY_TEXT`) — в начале каждого нового файла (по `frontend/CONVENTIONS.md`).
- [ ] Все стили — inline objects.

### 1B.5 Backend

- [x] Без изменений. Все данные перспективы остаются в `localStorage` до Фазы 5C.

### 1B.6 v1 Тесты ✅ ЗАВЕРШЕНА (24.04.2026)

- [x] Unit `panelWarpRenderer.test.ts` (19 тестов, все зелёные):
  - `buildMeshTriangles`: грид-резание (1×1, 4×4, 8×8); src-координаты в [0,w]×[0,h]; identity transform → dst = src + offset; трапеция → top-row уже bottom-row; throws на NaN/0.
  - `affineFromTriangles`: identity → identity matrix; pure translation; pure scale; degenerate (collinear src) → throw; matrix действительно мапит src → dst.
  - `quadBoundingBox`: axis-aligned, rotated, collapsed (≥1×1).
  - `renderPanelToQuad` + cache: canvas-bbox, cache hit, cache miss по opacity / colorTint / wallRect, `clearWarpCache`.
- [x] Component `KonvaCanvas.test.tsx` (17 тестов, все зелёные):
  - Phase 1A clip fallback: при `designImage='not-loaded.jpg'` (никогда не резолвится) → clipped Group + backdrop Line с `panel.color`.
  - Crash-safety: рендер с perspective + неподгруженной картинкой не падает.
  - Регрессия: без `perspectiveCorners` → нет clipped Groups.
  - **Outline-outside-clip:** outer Group (data-clipped="false") содержит **и** clipped child Group, **и** sibling outline Line — гарантирует, что outline не клипается.
- [x] Полный прогон `vitest run src/domains/visualizer/`: **17 файлов / 177 тестов зелёные** (19.81s). `tsc --noEmit` — чисто.

### 1B.6 v2 Тесты (deferred)

- [ ] Drag в перспективе: симулировать `dragmove` → ожидать вызов `onPanelMove` с **wall-space** координатами.
- [ ] Миграция wall-space (E6): существующие panels без `wallSpace` + включение перспективы → `wallSpace` рассчитан корректно через `inverseTransformRect`.
- [ ] Snapshot/pixel-diff warped canvas (опц.) — требует node-canvas или playwright-based визуального теста.
- [ ] Интеграционный e2e (manual checklist в issue): загрузить фото, поставить 4 угла, разместить 5 панелей, убедиться визуально что они «лежат» на стене.

> **Definition of Done v1 (этот коммит):** ✅ при включении ручной перспективы текстура дизайна реально warp'нута на quad (mesh, не clip). Кэш warp'ов рассеивается при смене перспективы. Fallback на clip при незагруженной картинке. Все тесты зелёные.
> **Definition of Done v2:** см. общий раздел «Definition of Done» в конце плана.

### 1B.7 Аудит реализации v1 (24.04.2026)

> **Метод:** code-review line-by-line всех изменённых файлов из коммита `1594cd1`; математическая верификация формул `affineFromTriangles` через Cramer (символьная развёртка); анализ canvas operation order (clip vs setTransform); сравнение поведения с Phase 1A (`opacity`, hit-area); прогон `vitest run src/domains/visualizer/` (177/177 ✅) и `tsc --noEmit` (чисто).

#### Что именно проверено

| Артефакт | Что проверял | Результат |
|----------|--------------|-----------|
| `panelWarpRenderer.ts:73-125` `buildMeshTriangles` | Корректность грид-резки, передача `wallRect.x/y` offset в `transformPoint`, src-координаты относительно wallRect (для drawImage), 2 треугольника на ячейку | Корректно. Триангуляция стандартная: TL→TR→BR + TL→BR→BL |
| `panelWarpRenderer.ts:139-196` `affineFromTriangles` | Развернул Cramer для всех 6 коэффициентов (a,b,c,d,e,f). Сравнил с формулами в коде. | **Математически верно.** Формулы для `a` (det по 1-й колонке для x), `c` (по 2-й для x), `e` (по 3-й для x) и зеркально для y совпадают с символьной развёрткой |
| `panelWarpRenderer.ts:202-219` `quadBoundingBox` | Корректность min/max + `Math.floor`/`Math.ceil`, защита `Math.max(1, ...)` от collapsed quad | Корректно |
| `panelWarpRenderer.ts:251-333` `renderPanelToQuad` | Порядок canvas operations: `beginPath/moveTo/lineTo/closePath/clip` ДО `setTransform` (clip в pixel-space, transform применяется только к drawImage); `globalAlpha = opacity`; offset `m[4] - bbox.x`/`m[5] - bbox.y` | Семантика clip+setTransform верна — clip фиксируется в pixel-space на момент вызова. Image draws через 0,0 → wallRect.w/h, что matches src triangle координаты |
| `panelWarpRenderer.ts:226-231` cache key | Уникальность ключа от `designUrl`, `quadHash` (4 точки × 2 координаты по 1 знаку), `opacity` (3 знака), `colorTint` | Работоспособно для типичных URL (см. B3 ниже про `\|`) |
| `panelWarpRenderer.ts:325-329` FIFO eviction | `Map.keys().next().value` берёт самый старый ключ; `delete` + `set` поддерживает ≤ MAX_CACHE_ENTRIES | Корректно. Map в JS сохраняет insertion order |
| `KonvaCanvas.tsx:435-437` cache invalidation | `useEffect(clearWarpCache, [perspectiveTransform])` — срабатывает при смене transform | Корректно. На initial mount тоже срабатывает (см. B4) |
| `KonvaCanvas.tsx:565-613` warp branch | Загруженная картинка → `<KonvaImage image={warpedCanvas} x={bbox.x} ... />`; иначе fallback на Phase 1A clip | Логика разветвления верна |
| `KonvaCanvas.tsx:614-647` fallback branch | Идентична Phase 1A (clip + backdrop fill Line) — но **без `<KonvaImage>` ветки** для случая когда картинка ещё не загружена. Корректно: backdrop через `panel.color` Line | Корректно |
| Конвенции (`frontend/CONVENTIONS.md`) | Без `any`; PascalCase/camelCase; типы домена в `model/types.ts`; новые типы (`Triangle`, `MeshTriangle`, `AffineMatrix`, `WallRect`, `WarpOptions`, `WarpResult`) в `lib/panelWarpRenderer.ts` — это **не доменные** типы, а инфраструктурные для рендера, держим рядом с реализацией | Соответствует |
| Регрессия | `vitest run src/domains/visualizer/` | **17 файлов / 177 тестов зелёные** (19.32s) |
| Типы | `tsc --noEmit` | Чисто |
| Тесты `panelWarpRenderer.test.ts` | 19 тестов: math + cache hit/miss/clear | Покрыто |
| Тесты `KonvaCanvas.test.tsx` | 17 тестов: fallback ветка + outline-outside-clip + регрессия | Покрыто (warp ветка не покрыта — см. B6) |

#### Критические проблемы (блокируют работу фичи)

**Не найдено.** Math корректна, тесты зелёные, типы валидны, fallback гарантирует, что юзер всегда видит панель (даже при незагруженной картинке).

#### Некритические проблемы (технический долг)

| # | Файл / стр. | Проблема | Серьёзность | Куда отнести |
|---|-------------|----------|-------------|--------------|
| **B1** | `panelWarpRenderer.ts:283-298` | **Color tint визуальная регрессия vs Phase 1A.** Backdrop tint рисуется ПОД image с тем же `globalAlpha = opacity (=0.85)`. Когда image непрозрачен, эффективная видимость tint падает с ~25% (Phase 1A: tint as overlay alpha=0.25 over image alpha=0.85) до ~13% (alpha=0.85 *(1-0.85) = 0.1275). Цвет панели стал заметно бледнее. | **medium** | v2: рисовать tint **после** image с alpha 0.25, либо использовать `globalCompositeOperation = 'multiply'` |
| **B2** | `KonvaCanvas.tsx:592-599` | **Hit-testing регрессия.** `panelHandlers` стоят на `<KonvaImage>`, чья hit-area = axis-aligned bbox warp-канваса, а не quad. При сильной перспективе клики срабатывают на пустых углах bbox (вне quad'а), могут перехватывать клики соседних панелей. В Phase 1A handlers были на quad-shaped Line. | **medium** | v2: добавить невидимый `<Line points={flatPts} closed listening={true}>` с handlers поверх KonvaImage, либо использовать `hitFunc` на самом KonvaImage |
| **B3** | `panelWarpRenderer.ts:230` | **Cache key collision risk.** Разделитель `\|` теоретически может встретиться в `designUrl` (data-URI с base64 не содержит `\|`, но кастомные query-params могут). Коллизия даст показ чужой текстуры. | low | v2: `encodeURIComponent(designUrl)` или sha-256 |
| **B4** | `KonvaCanvas.tsx:435-437` | `useEffect(clearWarpCache, [perspectiveTransform])` срабатывает при первом mount даже когда `perspectiveTransform === null`. Безвредно (clear пустой Map), но лишний вызов. | low | Не фиксить — стоимость нулевая |
| **B5** | `panelWarpRenderer.ts:256-264` + `KonvaCanvas.tsx:566-571` | **Дубликация вычисления dst-quad.** `transformRect` в KonvaCanvas + 4 вызова `transformPoint` внутри `renderPanelToQuad` — для одного и того же rect. ~8 лишних умножений-делений на panel на render. | low | v2: принимать готовый `dstQuad: Quad` параметром в `renderPanelToQuad` |
| **B6** | `KonvaCanvas.test.tsx` | **Нет теста для warp ветки** (когда designImg загружен). Все perspective-тесты пользуются fallback'ом через `designImage='not-loaded.jpg'`. Реальный код-путь Phase 1B v1 не покрыт component-тестом. | **medium** | v2: мок image-loader (resolve `Image.onload` синхронно) → ассертить `<konva-image>` с warped canvas вместо clipped Group |
| **B7** | `panelWarpRenderer.test.ts` | **Нет теста FIFO eviction.** Кэш-логика `MAX_CACHE_ENTRIES=100` + drop oldest — не покрыта. Простая регрессия (сменить `>=` на `>`) пройдёт незамеченной. | low | v2: добавить тест с 101 уникальным ключом → ассертить `getWarpCacheSize() === 100` |
| **B8** | `panelWarpRenderer.ts:317-320` | **try/catch глушит per-triangle ошибки.** При `wallRect.width === 0` все треугольники degenerate → silent blank canvas. Нет логирования / warning для разработчика. | low | v2: log.warn один раз при первой ошибке + early-return при `wallRect.width===0\|\|height===0` |
| **B9** | `KonvaCanvas.tsx:565-612` | **Per-render call в panels.map.** `renderPanelToQuad` дёргается на каждый рендер (cache hit O(1), но всё равно вызов). Не критично — кэш закрывает работу. | low | v2: useMemo на массив warp-результатов |
| **B10** | `panelWarpRenderer.ts:281-283` | `imageSmoothingEnabled` / `globalAlpha` устанавливаются **без** save/restore вокруг них. На fresh canvas нет проблемы, но если в будущем кто-то будет переиспользовать ctx — leak. | low | Cosmetic |
| **B11** | `panelWarpRenderer.ts:1-3` | Опечатка: «kuso-affine» вместо «piecewise-affine» в JSDoc заголовке файла. | low | Cosmetic |

#### Вывод

Phase 1B v1 принимается как warp-замена Phase 1A. Math формально верифицирована (Cramer), canvas operation order корректен, fallback гарантирует UX. Из 11 пунктов тех.долга **3 medium-приоритета** (B1, B2, B6) — рекомендуются к закрытию в Phase 1B v2 одним пакетом вместе с wallSpace + drag. Остальные — косметика и микро-перф.

> **Аудит:** ✅ пройден 24.04.2026 — критических проблем нет, перечислен 11-пунктовый тех.долг (B1–B11), приоритет на B1/B2/B6 в v2.

### 1B.8 Закрытие тех.долга после аудита ✅ ЗАВЕРШЕНА (24.04.2026)

> **Цель:** Закрыть приоритетные пункты тех.долга B1–B11 из аудита 1B.7 без ожидания v2 wallSpace, чтобы текущая v1 не несла визуальную регрессию (B1) и регрессию hit-testing (B2).
>
> **Метод:** точечные правки в `panelWarpRenderer.ts` и `KonvaCanvas.tsx`; новые юнит-/component-тесты; прогон `vitest run src/domains/visualizer/` и `tsc --noEmit`.

| # | Решение | Файл / стр. |
|---|---------|-------------|
| **B1** ✅ | Color tint вынесен **после** mesh-цикла, рисуется через `setTransform(1,0,0,1,0,0)` + `globalAlpha = 0.25` поверх warp-изображения. Восстановлена Phase 1A-семантика (~25% вклад тинта вместо ~13%). | `panelWarpRenderer.ts` (renderer body) |
| **B2** ✅ | `<KonvaImage image={warpedCanvas} listening={false}>`; outline `<Line points={flatPts} closed fill="rgba(0,0,0,0)" {...panelHandlers}>` несёт hit-area по форме quad. Клик-тест Konva работает по filled-полигону, не по bbox. | `KonvaCanvas.tsx` warp branch |
| **B3** ✅ | `encodeURIComponent(opts.designUrl)` в `buildCacheKey` — символ `\|` в URL больше не может коллидировать с разделителем полей. | `panelWarpRenderer.ts:buildCacheKey` |
| **B5** ✅ | В `WarpOptions` добавлено опциональное поле `dstQuad?: Quad`. KonvaCanvas передаёт уже посчитанный через `transformRect` quad — экономия 4 `transformPoint` на вызов. | `panelWarpRenderer.ts` (WarpOptions + renderer), `KonvaCanvas.tsx` warp branch |
| **B6** ✅ | Новый тест в `KonvaCanvas.test.tsx` мокает `window.Image` так, что `onload` срабатывает в следующем микротаске; ассертит появление `<konva-line>` с `data-fill="rgba(0,0,0,0)"` (warp branch hit-area) и отсутствие clipFunc-Group. | `__tests__/KonvaCanvas.test.tsx` |
| **B7** ✅ | Тест на FIFO-эвикцию: вставляем 100 уникальных записей (через варьирование `opacity`), затем 101-ю — размер кэша остаётся 100. Дополнительный тест на повторную вставку самой старой записи, чтобы убедиться что она была вытеснена. | `__tests__/panelWarpRenderer.test.ts` |
| **B8** ✅ | Early-return на degenerate `wallRect` (`width <= 0 \|\| height <= 0` или non-finite) — возвращается 1×1 пустой canvas без прогона mesh-цикла. Покрыто тестом. | `panelWarpRenderer.ts:renderPanelToQuad` |
| **B11** ✅ | JSDoc-заголовок «kuso-affine» → «piecewise-affine». | `panelWarpRenderer.ts:1-3` |
| **B4**, **B9**, **B10** | Не фиксим — стоимость нулевая (B4 — лишний пустой clear, B9 — кэш закрывает per-render вызов, B10 — fresh canvas, leak'а нет). Зафиксировано как осознанное решение. | — |

**Регрессия:** `vitest run src/domains/visualizer/` → 17 файлов / 182 теста зелёные (+5 vs v1 due to B6+B7 + B5/B8/B3). `tsc --noEmit` чисто.

> **Завершение:** ✅ закрыты 8/11 пунктов (все приоритетные medium и большая часть low). Оставшиеся B4/B9/B10 — без действий. Phase 1B v1 теперь визуально и поведенчески эквивалентна Phase 1A для случаев без перспективы и корректнее для случаев с перспективой.

---

## Фаза 2: Связка калибровки масштаба с раскладкой

> **Цель:** Использовать `pixelsPerCm` из `ScaleCalibration` для расчёта реальных размеров панели. Сейчас панель 60×60 см рендерится «на глаз», после фазы — её пиксельный размер однозначно зависит от калибровки.
> **Зависимости:** Фаза 1B (нужен `wallSpace` в `PlacedPanel` и warp). Можно начинать **параллельно** с 1B.4–1B.6, если разработчик другой.
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Результат:** Панель 30×30 см на фото действительно занимает 30 см стены.

### 2.1 Frontend — domain logic

> **Внимание:** `panelSizeInPixels()` уже использует `calibration?.pixelsPerCm ?? 5` (`layoutEngine.ts:48`). Часть этой фазы — **аудит и достраивание**, не «с нуля». См. [R2].

- [x] В `lib/layoutEngine.ts`:
  - [x] **Не менять сигнатуру `placeSinglePanel`** — расширена опциональным `perspective?` параметром (back-compat сохранён, дефолт `null` ⇒ flat-режим как раньше).
  - [x] В режиме перспективы wall-rect интерпретируется как wall-space, для каждой ячейки `transformRect` строит quad на фото; покрытие стены оценивается через `wallCoverageInQuad`.
  - [x] **`autoFillWall()` в перспективе** — общая ветка итерации в wall-/photo-space (для текущего MVP `wallSpace` совпадает с photo-bounds, см. v2-defer ниже); coverage/obstacle-checks выполняются через quad.
  - [x] **`canPlacePanel()` в перспективе** — добавлен опциональный `perspective` параметр; quad-покрытие через `wallCoverageInQuad` (бил-сэмплинг 8×8), obstacle-overlap по AABB quad'а, panel-vs-panel — в wall-space.
  - [x] Если в режиме перспективы калибровка `null` или `method === 'auto'` — `autoFillWall` бросает `AutoFillBlockedError` (`code: 'no-calibration'`); store ловит и показывает `message.warning(...)`. Magic-number `5 px/cm` остался только для preview в плоском режиме.
  - [x] **Удалить `console.log('[autoFill]', ...)`** — отсутствует в актуальном коде (был удалён ранее, проверено).
  - [x] **Заменить глобальный `panelIdCounter`** → `generatePanelId()` через `globalThis.crypto.randomUUID()` (с fallback `panel-${Date.now()}-${random}` для экзотических окружений).

  > **Defer to v2:** в текущей реализации wall-space координат `panel.x/y` равны photo-bounds (т.к. `createPerspective(corners, photoSize)`). Полноценное разделение wall-space ≠ photo-space (отдельный coord-system + inverse-transform клика для `placeSinglePanel`) — отдельная задача, **не** входит в Phase 2. См. JSDoc `placeSinglePanel`.

- [x] В `lib/costCalculator.ts`:
  - [x] `coveredAreaM2` уже считается через `sizeKeyToAreaM2` (`30x30 → 0.09`, `30x60 → 0.18`, `60x60 → 0.36`). Никаких пиксельных расчётов нет — изменения не требуются.

### 2.2 Frontend — UI

- [x] В `PhotoEditorPage.tsx`:
  - [x] При загрузке фото калибровка теперь маркируется `method: 'auto'` (вместо `'manual'`) — сохраняет heuristic preview, но позволяет UI отличить «настоящую» калибровку от placeholder'а.
  - [x] Над canvas плашка (`data-testid="calibration-banner"`) с заданными цветами и шрифтом, видна когда `!scene.calibration || method === 'auto'`. Кнопка «Откалибровать» переключает `editorMode → 'calibrating'` и открывает `CalibrationOverlay`.
  - [x] `handleCanvasClick` теперь вычисляет `perspective` из `perspectiveCorners + photo bounds` и пробрасывает в `placeSinglePanel`.
- [x] `CalibrationOverlay.tsx` `Apply` уже завязан на `applyCalibration()`, который пишет `{ method: 'reference', pixelsPerCm }` — после применения banner исчезает (т.к. method ≠ 'auto').
- [x] В `visualizerStore.autoFill` пробрасывается `perspective` из `perspectiveCorners`; `AutoFillBlockedError` ловится → `message.warning('Откалибруйте масштаб...')`.

### 2.3 Backend

- [x] Без изменений.

### 2.4 Тесты

- [x] Расширить `layoutEngine.test.ts`:
  - [x] `panelSizeInPixels` с calibration уже покрыт (3 теста): 60×60см при `pxPerCm=5` ⇒ `300×300`.
  - [x] Fallback без калибровки — старый тест («uses default 5 px/cm without calibration»).
  - [x] `canPlacePanel` с identity-perspective ≡ flat (новый тест в `describe('perspective mode')`).
  - [x] `autoFillWall` с identity-perspective: количество панелей совпадает с flat-веткой.
  - [x] `autoFillWall` + perspective + `null` calibration → `AutoFillBlockedError`.
  - [x] `autoFillWall` + perspective + `method: 'auto'` → `AutoFillBlockedError`.
  - [x] `autoFillWall` + perspective + `method: 'reference'` → НЕ бросает.
  - [x] `autoFillWall` без perspective + `method: 'auto'` → разрешено (heuristic для flat-preview).
  - [x] `generatePanelId()` — 100 вызовов уникальны, префикс `panel-`.
- [x] Расширить `maskUtils.test.ts`:
  - [x] `wallCoverageInQuad` — внутри маски ⇒ ≈1.0; вне ⇒ 0; пополам ⇒ ≈0.5; quad за границами фото ⇒ <1 (счёт OOB-сэмплов в знаменатель); невалидный `samplesPerSide` ⇒ 0.
- [x] Расширить `costCalculator.test.ts`:
  - [x] `coveredAreaM2` уже покрыт существующим тестом «calculates cost for mixed sizes»: `0.09 + 0.18 + 0.36 = 0.63 м²`. Дополнительные тесты не требуются.

**Регрессия:** `vitest run src/domains/visualizer/` → 17 файлов / 195 тестов зелёные (+13 vs Phase 1B v2). `tsc --noEmit` чисто.

> **Завершение Phase 2:** ✅ Все приоритетные пункты выполнены. Перенесено на v2: разделение wall-space ≠ photo-space с inverse-transform клика для manual-режима в перспективе (см. JSDoc `placeSinglePanel`). Banner и AutoFillBlockedError-loop проверены вручную в браузере.

### 2.5 Аудит реализации Phase 2 (post-implementation review)

**Метод:** построчное чтение всех 8 изменённых файлов + grep на всех потребителей изменённых API + повторный прогон `vitest run src/domains/visualizer/` (195/195) + `tsc --noEmit` (clean).

**Проверено:**
- `lib/layoutEngine.ts` — `AutoFillBlockedError`, `isTrustedCalibration`, `generatePanelId` (с fallback), `canPlacePanel` (две ветки flat/perspective), `autoFillWall` (guard), `placeSinglePanel` (опциональный perspective).
- `lib/maskUtils.ts` — `wallCoverageInQuad`: bounds samples per side (`<1`/`NaN`), bilinear на unit-square, OOB-сэмплы в знаменатель.
- `model/types.ts` — `ScaleCalibration.method` extended `'reference' | 'manual' | 'auto'` с JSDoc.
- `model/visualizerStore.ts` — derive perspective из corners + photo, try/catch на `AutoFillBlockedError`, message.warning.
- `ui/PhotoEditorPage.tsx` — upload пишет `'auto'`, banner на `!cal || method==='auto'`, `handleCanvasClick` пробрасывает perspective.
- Тесты `layoutEngine.test.ts` (+ perspective + UUID), `maskUtils.test.ts` (+ wallCoverageInQuad).
- `grep` потребителей `placeSinglePanel|canPlacePanel|autoFillWall|panelIdCounter|generatePanelId|calibration.method` — все вызовы совместимы с новыми сигнатурами (perspective опционален).

**Критические проблемы (блокируют работу фичи): нет.**

**Некритические (технический долг):**

| # | Файл:строка | Проблема | Приоритет | Статус |
|---|---|---|---|---|
| A1 | `PhotoEditorPage.tsx:147–180` | В perspective-режиме `handleCanvasClick` отдаёт photo-space клик, а `placeSinglePanel` JSDoc требует wall-space. Сейчас работает только потому, что `wallSpace ≡ photoSpace` (`createPerspective(corners, photoSize)`). Когда v2 вводит реальный отдельный wallSpace, мануальный клик в перспективе сломается. **Уже задекларировано как v2-defer**, но стоит зафиксировать тест-снапшот текущего поведения, чтобы случайно не регрессировать. | low | ⏸ deferred to v2 |
| A2 | `visualizerStore.ts:224–229` | При `panels.length === 0` (например, все ячейки на obstacle) код всё равно делал `set({ layout: { ...layout, panels: [] } })` и стирал существующие панели. **Pre-existing**, не введено Phase 2, но обнаружено при аудите. | low | ✅ **Исправлено** в Phase 2.1: ранний `return` после `message.info`, существующие панели сохраняются. Регрессионный тест `visualizerStore.test.ts › autoFill › does not wipe existing panels`. |
| A3 | `PhotoEditorPage.tsx:96` | Существующие проекты в `localStorage` имеют `{method:'manual', pixelsPerCm: width/400}` от старого heuristic-кода — у них banner НЕ покажется (`method === 'auto'` не выполнится), хотя калибровка по сути placeholder'ная. Новые загрузки получают `'auto'`. **Migration-ограничение:** пользователь увидит banner только после повторной загрузки фото. Документировать в release notes. | low | 📝 docs-only (release notes) |
| A4 | `layoutEngine.ts:131–134` | `if (x + widthPx > mask.width)` работает только когда wallSpace.w == mask.width. Сейчас инвариант держит `createPerspective(..., photoSize)`, но для будущего отдельного wallSpace нужен будет отдельный bounds-source. Закомментировано в коде. | low | ⏸ deferred to v2 |
| A5 | `layoutEngine.ts:140–156` | Obstacle-overlap для quad использует AABB. При сильной перспективе AABB значительно больше реального quad'а → ложно-отрицательное «нельзя разместить» вблизи мебели. Документировано как «tighter polygon test isn't worth the cost». Edge case для фото с широкоугольной перспективой; для типовых интерьеров < 2% разница. | low | ⏸ accepted as edge-case |
| A6 | `maskUtils.ts:225–226` | `Math.round(topX + ...)` обрезает 1-пиксельный sliver на краю в OOB. Минимальная погрешность; для threshold 0.7 не влияет. | trivial | ⏸ wontfix |
| A7 | `layoutEngine.test.ts:310` | Тесты perspective-режима использовали только identity-corners. Реально варпированный quad (трапеция) не покрыт — регрессия в `transformRect`+`wallCoverageInQuad` интеграции пройдёт через CI. | medium | ✅ **Исправлено** в Phase 2.1: добавлен тест `autoFillWall with trapezoidal perspective rejects cells whose quad falls off-mask` — corners `[(-50,0),(350,0),(300,300),(0,300)]` сдвигают верхние wall-ячейки за границу фото; ожидается `flat=100, warped<100, warped>0`. |
| A8 | `__tests__/visualizerStore.test.ts` | Catch-handler `AutoFillBlockedError → message.warning` не покрыт unit-тестом. Branch проверена только вручную в браузере. | medium | ✅ **Исправлено** в Phase 2.1: добавлены 6 тестов в `describe('autoFill')` — антд `message` мокается, проверены ветки no-scene/no-design/flat-success/perspective+auto/perspective+null/perspective+manual. Регрессионный тест A2 тоже здесь. |

**Регрессий не обнаружено:**
- Все существующие callers `placeSinglePanel/canPlacePanel/autoFillWall` совместимы — perspective параметр опциональный.
- Backend API (`/projects` payload) не зависит от `calibration.method` — миграция типа безболезненна.
- Persistence `partialize` сохраняет полный `scene.calibration` без фильтрации — старые `method:'manual'` значения корректно загружаются (типобезопасно, банер не показывается — см. A3).

**Регрессия после Phase 2.1:** `vitest run src/domains/visualizer/` → 17 файлов / **203 теста зелёные** (+8 vs Phase 2 v1: 1 для A7 + 6 для A8 + 1 регрессионный для A2). `tsc --noEmit` чисто.

**Заключение:** Phase 2 + Phase 2.1 закрыты. Все medium-items (A7, A8) и доступный low-fix (A2) исправлены и покрыты тестами. Остальное — A1/A4 уходят в v2 wallSpace work, A3 — release notes, A5/A6 — wontfix как accepted-edge-cases. Готово к Phase 3.

---

## Фаза 3: Авто-определение перспективы (vanishing points) ✅ ЯДРО ЗАВЕРШЕНО (24.04.2026, OpenCV-адаптер отложен)

> **Цель:** При загрузке фото автоматически предложить 4 угла стены. Пользователь подтверждает или корректирует.
> **Технология:** OpenCV.js (LSD line detection) + чистый JS (кластеризация направлений + RANSAC vanishing points + извлечение углов).
> **Зависимости:** Фаза 1B (нужно куда показывать результат — warp). Фаза 2 опционально (auto-fill в перспективе становится осмысленным).
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Результат:** В 70% интерьерных фото юзер не трогает углы вообще.

### 3.0 Подготовка

- [x] **Web Worker host**: `src/domains/visualizer/lib/cvWorkerHost.ts` — generic FIFO-очередь с `AbortController`, поддерживает inline-функции и Web Worker. Singleton `defaultCvWorkerHost` будет переиспользован в Фазе 4 (YOLO).
- [ ] **Датасет**: `__tests__/fixtures/perspective/` — отложено (требует подбора 20 эталонных фото; не блокирует production-логику).

### 3.1 Frontend — сервис vanishing-point detection

- [x] Алгоритмическое ядро `src/domains/visualizer/lib/vanishingPointDetector.ts`:
  - `detectFromLines({ lines, mask, photoSize })` — pure-JS pipeline без зависимости от OpenCV.
  - `detectWallCorners(imageUrl, mask, photoSize, provider)` — high-level wrapper, принимает pluggable `LineProvider`.
  - **Pipeline:** filter ≥80% on-mask → angle-histogram clustering (NMS на 18×10° бинов) → RANSAC vanishing points → extreme-inlier line pairs → 4 corners → confidence (inlier coverage × cluster strength × corners-inside × bbox-fit).
  - **Возврат:** `{ ok: true, corners, confidence }` либо `{ ok: false, reason: 'low-confidence' | 'multi-plane' | 'too-few-lines' }`.
  - **Защита от мульти-плана** ([E1]): ≥3 strong direction bins → `'multi-plane'`.
  - **Confidence floor:** 0.6 → ниже отдаём `'low-confidence'`.
  - **Координаты:** контракт — caller передаёт уже-нормализованные `lines` в системе фото; адаптер OpenCV (см. ниже) отвечает за upscale из 512×512 маски.
- [x] **Адаптер OpenCV** `src/domains/visualizer/lib/opencvLsdAdapter.ts` — **STUB**. Возвращает `LineProvider`, который кидает `OpencvNotInstalledError`. Реальная установка `@techstark/opencv-js` (~8 MB) и Web Worker отложены: алгоритм + контракт + интеграция в store/UI готовы, замена адаптера на боевой не требует изменений в call-sites.
- [ ] **Боевой OpenCV-биндинг** (отложено): установка `@techstark/opencv-js`, lazy-load в `cvWorkerHost`, LSD на даунскейле 1024px, transferable `ImageBitmap`. Будет отдельной мини-фазой 3.1c.

### 3.2 Frontend — интеграция в store и pipeline

- [x] В `visualizerStore.ts`:
  - Action `runAutoPerspective(provider: LineProvider)` — выставляет `segmentationStatus = 'detecting-perspective'`, гоняет детектор, на success пишет `perspectiveCorners` + `scene.perspectiveAutoDetected = true`, **всегда** возвращает статус в `'ready'` (даже на adapter-error).
  - `setPerspectiveCorners` теперь сбрасывает `scene.perspectiveAutoDetected = false` — любая ручная правка гасит зелёный баннер.
  - Тип `SegmentationStatus` расширен значением `'detecting-perspective'`; `Scene.perspectiveAutoDetected?: boolean` сохраняется в persist.
- [x] В `PhotoEditorPage.tsx`:
  - После успешного `segmentScene()` — `void store.runAutoPerspective(createOpencvLsdProvider(...))`. Сейчас всегда падает в no-op (stub-throw), но pipeline целиком на месте.
  - Зелёный баннер `data-testid="perspective-auto-banner"` `#E8F5E9` / `#2E7D32` `Inter 14px/400` с кнопкой «Открыть редактор перспективы» (переключает `editorMode = 'perspective'`) — показывается, пока `scene.perspectiveAutoDetected === true`.

### 3.3 Дизайн

- [ ] **Отложено** до wiring боевого OpenCV: цвета углов `#4CAF50`/`#FF9800` в `KonvaCanvas` для auto vs manual override.
- [x] Inline-spinner в шапке во время `'detecting-perspective'`: `<Spin size="small">` + текст «Определяем углы стены…», `data-testid="perspective-detect-spinner"`. Редактор остаётся интерактивным.

### 3.4 Backend

- [x] Без изменений.

### 3.5 Тесты

- [x] `cvWorkerHost.test.ts` — 6 тестов: single-task, FIFO-сериализация, abort queued, abort running (signal), error isolation, pendingCount.
- [x] `vanishingPointDetector.test.ts` — 9 тестов: too-few-lines, off-mask filter, single-direction → low-confidence, ≥3 кластеров → multi-plane, flat (parallel) corners + ordering, convergent perspective, provider integration (callback signature + propagation).
- [x] `opencvLsdAdapter.test.ts` — 2 теста: throws `OpencvNotInstalledError`, stable error code.
- [x] `visualizerStore.test.ts` — 5 новых сценариев: no-scene noop, success populates flag, adapter error → silent ready, low-confidence → silent ready, manual corner edit clears flag.
- [ ] **Датасет-acceptance** — отложено вместе с боевым OpenCV.

### 3.6 Что отложено (Phase 3.1c)

| Пункт | Причина откладывания | Где разморозить |
|---|---|---|
| `@techstark/opencv-js` install + lazy-load в `cvWorkerHost` | 8 MB зависимость + Web Worker — отдельная фаза с perf-бюджетом | `opencvLsdAdapter.ts` — заменить throw на реальный LSD |
| Web Worker файл `vanishingPointWorker.ts` | Требует Vite worker-config + WASM-bundling | Внутри новой версии адаптера |
| Цветовая дифференциация углов в `KonvaCanvas` | Нет смысла без боевых auto-detected углов | После 3.1c — патч в `KonvaCanvas.tsx` ветке `'perspective'` |
| Датасет 20 фото с эталонными углами | Acceptance-тест включается перед релизом 3.1c | `__tests__/fixtures/perspective/` |

**Итог Phase 3 (текущая часть):** algorithmic core + worker-host infrastructure + store/UI integration. Все 316 тестов фронта зелёные, tsc clean. Достаточно установить OpenCV.js и заменить тело адаптера — call-sites трогать не нужно.

### 3.7 Аудит реализации Phase 3

**Проверены файлы (line-by-line):** `cvWorkerHost.ts`, `cvWorkerHost.test.ts`, `vanishingPointDetector.ts`, `vanishingPointDetector.test.ts`, `opencvLsdAdapter.ts`, `opencvLsdAdapter.test.ts`, `model/types.ts`, `model/visualizerStore.ts`, `__tests__/visualizerStore.test.ts`, `ui/PhotoEditorPage.tsx`. Прогон: vitest 316/316 ✅, tsc clean ✅.

**Критические проблемы:** 0.

**Некритические находки (технический долг, не блокируют фичу в её текущем виде с stub-адаптером):**

| # | Файл:строка | Проблема | План исправления |
|---|---|---|---|
| B1 | `visualizerStore.ts:305-344` | `runAutoPerspective` не защищён от photo-swap race: при загрузке нового фото во время работы детектора результат старого может быть применён к новой сцене. Сегодня stub бросает синхронно — race не воспроизводится. **Станет CRITICAL при wiring боевого OpenCV (Phase 3.1c).** | В 3.1c: snapshot `photo.url` на старте, на settle сравнивать с `get().scene.photo.url`; mismatch → бросать результат. |
| B2 | `visualizerStore.ts:305-344` | `runAutoPerspective` не возвращает abort-handle, хотя `cvWorkerHost` спроектирован вокруг `AbortController`. Никто не может отменить запущенную детекцию (например, из reset). | В 3.1c: возвращать `{ abort }` или хранить активный AbortController в store. |
| B3 | `vanishingPointDetector.ts:439-456` | `maskBoundingBox` — O(W·H), вызывается дважды на детект (`extractCorners` + `scoreConfidence`). Для 4032×3024 = 24 M пикселей. | Кэшировать bbox в `detectFromLines` и пробрасывать. Делать в 3.1c при первом профайлинге. |
| B4 | `vanishingPointDetector.ts:250` | Комментарий «vertical pick is the strong bin furthest from horizontal» расходится с фактической логикой (сортировка по `\|a − 9\|` = ближайший к вертикали). Поведение корректно, комментарий — нет. | Переписать комментарий. Тривиально. |
| B5 | `vanishingPointDetector.ts:260-274` | `linesInBin` использует ±2-bin окно. Если два strong-bin'а оказались близко (например `dirH=0`, `dirV=4`), линия в bin 2 попадёт в **оба** кластера. Для валидной H/V-сцены (расстояние 9) не воспроизводится. | Можно ограничить «принадлежность» одной ближайшей дирекции. Edge-case, не приоритет. |
| B6 | `__tests__/vanishingPointDetector.test.ts` | Не покрыто [T4] — нормализация координат при mask 512×512 vs photo 4032×3024 (контракт детектора: caller отвечает за upscale). Нужен тест, фиксирующий контракт. | Добавить тест в 3.1c вместе с реальным OpenCV-адаптером (где как раз и происходит upscale). |
| B7 | `__tests__/vanishingPointDetector.test.ts` | Нет теста на `extractCorners → null` по sanity-check (`tl.y < bl.y && ...`). Все позитивные пути закрыты, но негативный — нет. | Добавить тест с inline degenerate-инлайерами. |
| B8 | `__tests__/visualizerStore.test.ts` | Нет теста, фиксирующего промежуточное состояние `segmentationStatus === 'detecting-perspective'` (только начальный → конечный). | Добавить тест с провайдером, разрешающимся через `setTimeout(0)`. |
| B9 | `opencvLsdAdapter.ts:33-41` | `OpencvLsdOptions.maxLines` объявлено, но никем не используется (stub бросает). | Использовать в 3.1c при wiring реального LSD. |
| B10 | `PhotoEditorPage.tsx:280-282` | Эффект расчёта `wallBrightness` срабатывает дважды на upload: при первом переходе в `'ready'` и снова при возврате из `'detecting-perspective'`. Минорный двойной recompute. **Не введено Phase 3** — лишь обнажено новой статус-сменой. | Добавить guard `if (computed) return;` или мемоизацию по `photo.url`. Низкий приоритет. |
| B11 | `PhotoEditorPage.tsx:134-136` | `createOpencvLsdProvider({...})` создаётся на каждый upload. Аллокация дешёвая, но провайдер stateless — можно вынести в module-level const. | Тривиальный рефакторинг, можно вместе с 3.1c. |
| B12 | `cvWorkerHost.ts:30,38-39` | `any` в `enqueue<I,O>` сигнатуре и `queue: QueueEntry<any, any>[]`. | Неизбежно из-за гетерогенности задач. Оставить eslint-disable. |
| B13 | `vanishingPointDetector.ts:298-302` | RANSAC seed фиксирован константой → каждый запуск даёт одну и ту же последовательность. По дизайну (детерминизм тестов), но в проде на разных фото поведение тоже детерминированно (что хорошо). | Документировать как фичу, не баг. ✓ — уже комментарий стоит. |

**Регрессии:** не выявлены. Изменения изолированы:
- `Scene.perspectiveAutoDetected?: boolean` — добавлено как optional, обратная совместимость с persisted state ✓.
- `SegmentationStatus` расширен `'detecting-perspective'` — все switch'и на статус (только в `PhotoEditorPage:451-459`) имеют `default: ''` → новый статус не ломает.
- `setPerspectiveCorners` теперь сбрасывает флаг — проверены все call-sites (2 в `PhotoEditorPage`, 4 в тестах). Поведение корректно: и Konva-drag, и manual-init из `handleEnterPerspectiveMode` гасят флаг (для второго это no-op, т.к. флаг там и так false).
- `isReady` теперь включает `'detecting-perspective'` — редактор остаётся интерактивным во время фоновой детекции, что соответствует требованию плана «без блокировок UI».
- В fallback-ветках сегментации (mask паинтится вручную) `runAutoPerspective` не вызывается — корректно: white-fill mask не даёт VP-детектору осмысленных constraint'ов.

**Что отнесено к Phase 3.1c (поверх предыдущего списка):**
- B2 — abort-handle (требует контракта с боевым OpenCV worker'ом).
- B3, B6 — performance + нормализация координат (имеет смысл только с реальным LSD).
- B4, B5 — низкоприоритетный технический долг.

### 3.7.1 Fix-pass по аудиту (24.04.2026)

Закрыто прямо сейчас, без ожидания 3.1c (где это возможно без боевого OpenCV):

| # | Что исправлено | Где |
|---|---|---|
| **B1** ✅ | `runAutoPerspective` снапшотит `scene.photo.url` на старте; перед каждым `set({...})` после `await` сверяет с текущим `get().scene?.photo.url` через хелпер `stillCurrent()`. Если фото сменилось — детектор молча выходит без записи в стор. Race с photo-swap закрыт ещё до wiring боевого OpenCV. | `visualizerStore.ts:305-358` |
| **B7** ✅ | Новый тест `does not pollute a newer scene if a stale detection settles after photo swap` — поднимает «медленный» провайдер, между стартом детекции и его resolve вызывает `setScene` для другого фото, проверяет что новая сцена осталась без `perspectiveAutoDetected` и `perspectiveCorners === null`. | `__tests__/visualizerStore.test.ts` (блок `runAutoPerspective`) |
| **B8** ✅ | Новый тест `transitions through detecting-perspective status while running` — между моментом старта `runAutoPerspective` и его await'ом сэмплирует `scene.segmentationStatus`, ассертит последовательность `['detecting-perspective','ready']`. | `__tests__/visualizerStore.test.ts` |
| **B9** ✅ | `OpencvLsdOptions.maxLines` помечено `TODO(Phase 3.1c)` с пояснением, почему сегодня unused. | `opencvLsdAdapter.ts:33-44` |
| **B10/B11** (B10 в этой нумерации) ✅ | `createOpencvLsdProvider({...})` поднят в `useMemo([])` на верхний уровень компонента — провайдер стабилен на всё время монтирования, новый upload его переиспользует. | `PhotoEditorPage.tsx:53-60`, `:139` |
| **B12** (логирование) ✅ | `console.warn` в catch-ветке `runAutoPerspective` теперь обёрнут в `if (import.meta.env.DEV)` — в проде stub-адаптер не засоряет консоль. | `visualizerStore.ts:347-349` |
| **B13** ✅ | JSDoc на `Scene.perspectiveAutoDetected` уточнён: «toast» → «inline banner», добавлена ссылка на `data-testid="perspective-auto-banner"`. | `model/types.ts:139-145` |

**Регрессия после fix-pass:** vitest **318/318 ✅** (+2 новых vs аудит), `tsc --noEmit` clean ✅.

**Остаётся к Phase 3.1c:**
- **B2** — `AbortController` для отмены детекции из `reset()` (требует, чтобы боевой адаптер уважал signal — у stub отменять нечего).
- **B3** — кэш `maskBoundingBox` (профилировать с реальным OpenCV).
- **B4** — переписать комментарий в `vanishingPointDetector.ts:250` (косметика, можно и сейчас, но безопаснее в одном пакете с реальным LSD, чтобы код и комментарий проверялись на боевых линиях).
- **B5** — edge-case ±2-bin перекрытия кластеров.
- **B6** — тест T4 нормализации координат (имеет смысл только когда боевой адаптер действительно делает upscale 512→4032).

---

## Фаза 4: Авто-определение масштаба (детекция эталонов) ✅ ЯДРО ЗАВЕРШЕНО

> **Цель:** Автоматически найти на фото объект известного размера (розетка, дверь, плинтус) и предложить one-click калибровку.
> **Технология:** YOLOv8n (ONNX ~6 MB), inference через `onnxruntime-web` в Web Worker (через `cvWorkerHost` из Фазы 3.0).
> **Зависимости:** Фаза 2, Фаза 3 (использует `cvWorkerHost`).
> **Bounded Context:** только frontend / `visualizer`. Backend: без изменений.
> **Результат сегодня:** Алгоритмическое ядро + UI готовы; адаптер ORT — stub. По шаблону Phase 3, реальный ONNX-binding отложен в **Phase 4.1c** (вес ~9 МБ, требует worker bootstrap).

### 4.0 Подготовка ⏸ (отложено в 4.1c)

- [ ] Скачать предобученную модель YOLOv8n COCO. Решить про дообучение `outlet/switch/baseboard`.
- [ ] **Датасет**: 30 фото с разметкой в `__tests__/fixtures/references/`.

### 4.1a Frontend — алгоритмическое ядро ✅

- ✅ `src/domains/visualizer/lib/scaleEstimator.ts`:
  - `REFERENCE_CATALOG` — outlet (8см, axis=width, trust=0.95), switch (8/0.9), door (205/height/0.7), window (140/width/0.4), baseboard (10/height/0.55).
  - `estimateScaleFromReference(candidate, perspective?)` → `EstimatedScale | null`.
  - **С перспективой** — bbox проецируется в wall plane через `inverseTransformPoint` всех 4 углов, измеряется средняя длина двух параллельных сторон (дампит шум разворота bbox в проекции). [E4 покрыт].
  - Без перспективы — прямой bbox.width / knownSizeCm.
  - `pickBestCandidate(candidates)` — score = trust(catalog) × confidence(detector), tie-break по confidence → площади bbox.
- ✅ Тесты `__tests__/scaleEstimator.test.ts` (12 тестов): bbox-axis для всех типов, identity-perspective consistency, foreshortened wall (far edge даёт больший pixelsPerCm в wall plane), null-кейсы (zero bbox, неизвестный тип, NaN после проекции), pickBestCandidate (catalog приоритет, confidence tie-break, area tie-break).

### 4.1b Frontend — pluggable detector adapter (stub) ✅

- ✅ `src/domains/visualizer/lib/referenceDetector.ts`:
  - Тип `ReferenceDetector = (input) => Promise<ReferenceCandidate[]>` — единая точка инъекции.
  - `OnnxNotInstalledError` (`code: 'onnx-not-installed'`) — типобезопасный sentinel.
  - `createOnnxReferenceDetector(opts)` — stub, всегда бросает `OnnxNotInstalledError`. Reuses `CvWorkerHost` из Phase 3.
  - Опции `scoreThreshold`, `maxCandidates` объявлены с `TODO(Phase 4.1c)`.
- ✅ Тесты `__tests__/referenceDetector.test.ts` (3 теста): throws + stable error code + options surface smoke.

### 4.1c (отложено) — реальный ORT-адаптер

| Что нужно | Зачем |
|---|---|
| `npm i onnxruntime-web` (~3 МБ) | runtime для inference в Web Worker |
| Файл `public/models/yolov8n.onnx` (~6 МБ) | предобученная модель COCO |
| Web Worker, обёрнутый под `CvWorkerHost.enqueue(...)` | GPU/CPU inference без блокировки UI |
| Тело `createOnnxReferenceDetector` | нормализация изображения, прогон inference, NMS, маппинг классов COCO → `ReferenceType` |
| Lazy-load по `requestIdleCallback` ([T5]) | не платить 9 МБ при первом upload |
| Acceptance-тест на датасете | precision ≥ 0.85, recall ≥ 0.7 |

### 4.2 Frontend — UI выбора эталона ✅ (минимальная версия)

- ✅ Расширен `CalibrationOverlay.tsx`:
  - При непустом `candidates` сверху отрисовывается зелёный блок (`#1B3A1F / #2E7D32`) с лучшим кандидатом по `pickBestCandidate`.
  - Кнопка `data-testid="apply-auto-candidate"` с подписью `Применить (N см)`.
  - Существующий ручной flow остаётся ниже — fallback автоматически.
- ⏸ `ReferenceCandidatesOverlay.tsx` (Konva-боксы поверх canvas с dashed-рамками) — не реализован в первой итерации, перенесено в **Phase 4.2a**. Сегодня кандидаты выбираются из CalibrationOverlay; рамок поверх фото нет.

### 4.3 Frontend — интеграция в store ✅

- ✅ `Scene.referenceCandidates?: ReferenceCandidate[]` (runtime, не персистится).
- ✅ `Scene.calibrationAutoDetected?: boolean` (персистится — это часть выбора пользователя).
- ✅ Action `runAutoReferenceDetection(detector)`: race-protection через snapshot `photo.url`, `import.meta.env.DEV`-гарды для логов, silent-fallback на ошибку.
- ✅ Action `applyReferenceCandidate(candidate)`: `estimateScaleFromReference` с учётом текущего `perspectiveCorners`, пишет `calibration: {method:'auto'}` + `calibrationAutoDetected=true`, закрывает overlay.
- ✅ `setCalibration` и `applyCalibration` сбрасывают `calibrationAutoDetected` (ручное действие → флаг гасится).
- ✅ Запуск из `PhotoEditorPage` — `void store.runAutoReferenceDetection(...)` параллельно с `runAutoPerspective` после сегментации.
- ✅ Тесты в `visualizerStore.test.ts` (8 новых): no-scene noop, успешная запись кандидатов, silent на ошибку, race с photo-swap; applyReferenceCandidate happy path, false на zero-bbox, manual `setCalibration` сбрасывает флаг, no-scene → false.

### 4.4 Дизайн ✅ (в виде баннера; чип отложен)

- ✅ Зелёный баннер `data-testid="calibration-auto-banner"` (`#E8F5E9 / #2E7D32`) — «Масштаб определён автоматически по эталонному объекту. Откалибровать вручную».
- ✅ Жёлтый warning-баннер `calibration-banner` теперь молчит, когда `calibrationAutoDetected === true` (auto-from-reference считается надёжным).
- ⏸ Полноценный статус-чип (success/warning/error три состояния) — оставляется на Phase 4.2a вместе с overlay-боксами; сегодня тех же три состояния выражены парой баннеров.

### 4.5 Backend

- ✅ Без изменений (как и было запланировано). Финальный `ScaleCalibration` персистится в Phase 5.

### 4.6 Тесты ✅

- ✅ `referenceDetector.test.ts` — stub поверхность (3 теста). Будет дополнен в 4.1c при реальном ORT.
- ✅ `scaleEstimator.test.ts` (12 тестов): bbox 80px outlet → 10 px/cm; door 410/205 = 2; identity-perspective consistency; foreshortened wall; null-cases; pickBestCandidate.
- ✅ `CalibrationOverlay.test.tsx` (5 новых): нет блока без кандидатов / при empty / без `onApplyCandidate`; рендерится с подписью «Розетка / 8 см»; клик прокидывает best-кандидата.
- ✅ `visualizerStore.test.ts` (8 новых, см. 4.3).
- ⏸ Датасет-acceptance — Phase 4.1c.

### 4.7 Что отложено (Phase 4.1c / 4.2a)

| # | Пункт | Куда |
|---|---|---|
| Реальный ONNX-адаптер | YOLOv8n + ORT Web в Worker | 4.1c |
| Модель `yolov8n.onnx` (6 МБ) + `public/models/` | bundle | 4.1c |
| Lazy-load через `requestIdleCallback` ([T5]) | perf | 4.1c |
| Датасет 30 фото + acceptance precision/recall | release-gate | 4.1c |
| `ReferenceCandidatesOverlay.tsx` (Konva-боксы поверх canvas) | UX | 4.2a |
| Полноценный статус-чип масштаба (✓/⚠/✗) | UX | 4.2a |
| AbortController для отмены детекции при reset | parity с runAutoPerspective | 4.1c (одним пакетом с тем же фиксом) |

**Итог Phase 4 (текущая часть):** алгоритмическое ядро + plug-in adapter + store + UI fallback. Frontend visualizer-тесты **255/255 ✅** (+25 vs Phase 3), non-visualizer **91/91 ✅**, tsc clean. Запуск ORT-адаптера в 4.1c не требует трогать call sites — только подменить тело `createOnnxReferenceDetector`.

### 4.8 Аудит реализации Phase 4 (24.04.2026)

Построчно проверены все файлы, изменённые/созданные в Phase 4. Регрессий и критических проблем не найдено.

**Что проверено (file:line):**
- `lib/scaleEstimator.ts` (1-205, новый) — REFERENCE_CATALOG, `measureAxisLengthPx` через `inverseTransformPoint`, `estimateScaleFromReference` (NaN/zero-guards), `pickBestCandidate` ранжирование.
- `lib/referenceDetector.ts` (1-78, новый) — `OnnxNotInstalledError`, типы `ReferenceDetector` / `OnnxReferenceDetectorOptions`, стаб `createOnnxReferenceDetector`.
- `model/types.ts` (144-156) — поля `Scene.referenceCandidates` и `Scene.calibrationAutoDetected` с правильным `import('../lib/scaleEstimator')` (избегает циклической зависимости).
- `model/visualizerStore.ts` interface (23-34, 88-104), `setCalibration` (172-179, теперь чистит флаг), `applyCalibration` (305-322, чистит флаг), `runAutoReferenceDetection` (389-413), `applyReferenceCandidate` (414-435), persist partializer (533-553, `calibrationAutoDetected` персистится, `referenceCandidates` — нет).
- `ui/CalibrationOverlay.tsx` (1-182, изменён) — пропсы `candidates` / `onApplyCandidate`, defensive-render блок, `pickBestCandidate` для отображения.
- `ui/PhotoEditorPage.tsx` — мемоизация `referenceDetector` (64-67), параллельный запуск с `runAutoPerspective` (155), оба баннера (632-674) с правильным условием взаимоисключения, проброс пропсов в overlay (798-808).
- `__tests__/scaleEstimator.test.ts` (1-207, новый, 12 тестов).
- `__tests__/referenceDetector.test.ts` (1-47, новый, 3 теста).
- `__tests__/visualizerStore.test.ts` (443-575, +8 тестов: 4 для `runAutoReferenceDetection` + 4 для `applyReferenceCandidate`).
- `__tests__/CalibrationOverlay.test.tsx` (129-228, +5 тестов в `auto-candidate section (Phase 4)`).

**Регрессионный поиск:**
- `setCalibration` / `applyCalibration` / `'calibrating'` editor mode / `referenceCandidates` (grep по всему `frontend/src`) — потребители не сломаны, новые поля в `Scene` опциональны.
- `vitest run src/domains/visualizer/__tests__/`: **255/255 ✅** (+25 vs Phase 3 baseline 230).
- `vitest run --exclude='src/domains/visualizer/**'`: **91/91 ✅**.
- `tsc --noEmit`: clean.

**Критические проблемы:** 0.

**Некритические находки (тех.долг):**

| # | Файл:строка | Проблема | Статус |
|---|---|---|---|
| B14 | `model/visualizerStore.ts:417-418` | `get().perspectiveCorners` вызывается 3 раза. | ✅ ЗАКРЫТО (24.04.2026): один `get()` + локальный `const corners`. |
| B15 | `model/visualizerStore.ts:389-413` | Нет `AbortController` для inflight-инференса. Parity-проблема с Phase 3 B2. | ⏸ Отложено в 4.1c одним пакетом с тем же фиксом для `runAutoPerspective`. |
| B16 | `model/visualizerStore.ts:432` | `applyReferenceCandidate` всегда переключает `editorMode: 'default'`. Сломается при втором call site (Konva-overlay 4.2a). | ✅ ЗАКРЫТО (24.04.2026): `closeOverlay = state.editorMode === 'calibrating'`, conditional spread в `set`. Покрыто двумя новыми тестами в `visualizerStore.test.ts`. |
| B17 | `model/visualizerStore.ts:511-527` | `reset()` не сбрасывает `referenceCandidates` / `calibrationAutoDetected` явно. Бага нет (`scene: null` их обнуляет). | ⏭ Не фиксим (избыточный код). |
| B18 | `model/visualizerStore.ts:395-402` | Race-snapshot сравнивает только `photo.url`. Повторная загрузка фото с тем же URL пропустит защиту. Маловероятно для `data:`-URL. | ⏭ Низкий приоритет; не блокирует фичу. |
| B19 | `lib/scaleEstimator.ts:175-184` | В `pickBestCandidate` после tie-break строка `bestScore = s` избыточна (s === bestScore). | ✅ ЗАКРЫТО (24.04.2026): ветки `if/else if/else if`, `bestScore` обновляется только в первой. |
| B20 | `__tests__/referenceDetector.test.ts` (целиком) | Покрыт только stub-throws путь. | ⏸ Закроется автоматически в 4.1c при появлении real-adapter. |
| B21 | `ui/PhotoEditorPage.tsx:632-666` | Hardcoded inline-цвета баннера (`#E8F5E9` / `#2E7D32`) — дублирует Phase 3 паттерн. | ⏭ Тот же тех.долг, что Phase 3 B11; общий рефактор при появлении theme-системы. |

**Итоги fix-pass:** 3 из 8 закрыто (B14, B16, B19), 2 явно отложено в следующие фазы (B15, B20), 3 признаны не-багами (B17, B18, B21). Тесты после фикса: visualizer **257/257 ✅** (+2 на B16), tsc clean.

**Что не проверено (вне scope Phase 4):**
- E2E-сценарий «загрузка фото → авто-кандидат → клик → calibration» — невозможен без рабочего ORT-детектора (4.1c).
- Производительность реальной модели (latency p95) — также 4.1c.
- Konva-визуализация bbox-кандидатов на canvas — отложено в 4.2a.

**Итог аудита Phase 4:** код готов к мерджу. Все фиксы из таблицы — non-blocking тех.долг, который естественно поглощается в 4.1c / 4.2a. Архитектурный контракт (call-site-invariance при подмене стаба на real ORT) выдержан.

---

## Фаза 5A: Pre-task — Setup Alembic ✅ ЗАВЕРШЕНА (24.04.2026)

> **Цель:** Убедиться, что Alembic настроен и хотя бы одна миграция применена. Если репозитории сейчас только in-memory — настроить.
> **Зависимости:** результат Фазы 0 (audit). Если Alembic уже есть и работает — пропускаем.
> **Атомарность:** независимая под-фаза, можно запустить параллельно с любой frontend-фазой.

### 5A.0 Состояние «как застали» (audit)

Alembic уже инициализирован: `backend/alembic.ini`, `backend/alembic/env.py` (async engine + `target_metadata = Base.metadata`), три миграции `001_initial_schema.py` … `003_subscription_area_model.py`. ORM-модели в `app/infrastructure/persistence/models.py`. Repos с фоллбеком `USE_MEMORY_REPOS` (в `conftest.py` всегда true).

**Найден рассинхрон:** `VisualizationProjectModel` (`models.py:173`) объявлена и используется `SqlVisualizationProjectRepository`, но таблицы `visualization_projects` нет ни в одной миграции — на postgres-инстансах SQL-репо ломался при первом обращении. Phase 5A закрывает этот gap.

### 5A.1 Backend — инфраструктура миграций ✅

- [x] `alembic` уже настроен — пере-инициализация не требуется (см. 5A.0).
- [x] **004 миграция** `backend/alembic/versions/004_visualization_projects.py` — создаёт таблицу `visualization_projects` по текущему состоянию `VisualizationProjectModel`. FK на `users.id` с `ondelete=CASCADE` (mirror `relationship(cascade="all, delete-orphan")`). `panels_json` / `perspective_corners` как `JSON` — Phase 5B отдельной миграцией заменит `perspective_corners` на типизированную колонку.
- [x] **001 миграция** дополнена dialect-guard для `CREATE SEQUENCE` (`alembic/versions/001_initial_schema.py:121-126`, симметрично в `downgrade`). На postgres поведение неизменно — миграция не переприменяется. На SQLite-тестовом стенде оба блока становятся no-op.
- [x] **`env.py`**: `do_run_migrations` и `run_migrations_offline` теперь включают `render_as_batch=True` для SQLite — позволяет миграции 003 (`drop_column`) round-trip-нуть на SQLite < 3.35. На postgres `render_as_batch` игнорируется.
- [ ] Локальный `alembic upgrade head` / `downgrade -1`: **в sandbox не запускается** (нет pip / `python3 -m ensurepip` падает, `.venv` пуст). Прогон делегирован CI с реальным postgres.

### 5A.2 Backend — тесты ✅

- [x] `backend/tests/infrastructure/test_alembic.py` (новый, 4 теста, целиком SQLite-only):
  - `test_upgrade_head_creates_all_core_tables` — `users`, `designs`, `orders`, `subscriptions`, `visualization_projects` присутствуют.
  - `test_round_trip_upgrade_downgrade_upgrade` — `head → -1 → head` без ошибок; падение `visualization_projects` после `downgrade -1` подтверждает обратимость 004.
  - `test_downgrade_to_base_drops_everything` — `downgrade base` чистит все таблицы (downgrade-цепочка работает).
  - Использует `sqlite+aiosqlite:///<tmp>/alembic_test.db` через `monkeypatch.setattr(settings, "DATABASE_URL", …)`.
  - Содержит `pytest.importorskip` для `alembic`/`sqlalchemy`/`aiosqlite` — в стрипанутом окружении просто скипается, в CI — выполняется.
- [x] `aiosqlite==0.20.0` добавлен в `requirements.txt` (test-only зависимость).
- [x] `tests/infrastructure/__init__.py` создан.
- [x] `python3 -m py_compile` всех новых/изменённых файлов: clean.

### 5A.3 Что НЕ сделано в этой фазе (намеренно)

- **Прогон тестов в sandbox** — невозможен без pip; ожидается на CI с pinned `requirements.txt`.
- **Расширение `VisualizationProjectModel` под Phase 5B** (perspective/calibration колонки, `version` для optimistic-lock) — это Phase 5B.1/5B.2, не 5A. Phase 5A только синхронизировала ORM ↔ migrations.
- **Replace `JSON` → typed columns для `perspective_corners`** — Phase 5B пере-форматирует это поле в нормализованную колоночную форму.

> **Definition of Done:** ✅ Alembic-инфраструктура валидна, миграции синхронизированы с ORM, smoke-тест миграций есть, dialect-aware (CI postgres + локальный SQLite). Прогон под postgres — в CI.

### 5A.4 Изменённые файлы

| Файл | Сделано |
|---|---|
| `alembic/versions/004_visualization_projects.py` | NEW — таблица visualization_projects |
| `alembic/versions/001_initial_schema.py` | guard `CREATE/DROP SEQUENCE` под postgres |
| `alembic/env.py` | `render_as_batch=True` для SQLite в обоих режимах |
| `requirements.txt` | +`aiosqlite==0.20.0` (test-only) |
| `tests/infrastructure/__init__.py` | NEW (пустой) |
| `tests/infrastructure/test_alembic.py` | NEW — 4 smoke-теста |

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
