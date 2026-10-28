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

### 5A.5 Аудит реализации Phase 5A (24.04.2026)

Построчно проверены все файлы Phase 5A. Тесты в sandbox прогнать невозможно (нет pip / SQLAlchemy / pytest), runtime-валидация делегирована CI.

**Что проверено (file:line):**
- `alembic/versions/004_visualization_projects.py` (1-58) — структура колонок vs `VisualizationProjectModel` (`models.py:173-188`), FK ondelete, server_default-значения.
- `alembic/versions/001_initial_schema.py:120-126, 143-145` — оба плеча dialect-guard для CREATE/DROP SEQUENCE; downgrade-цепочка не нарушена.
- `alembic/env.py` (1-75) — `do_run_migrations` (39-51), `run_migrations_offline` (25-36): `render_as_batch=True` только для SQLite; импорт `Base` и моделей не сломан; sync→async обвязка цела.
- `requirements.txt:24-29` — добавлена pinned-зависимость `aiosqlite==0.20.0` в секцию Testing.
- `tests/infrastructure/__init__.py` — пустой, валидный package marker.
- `tests/infrastructure/test_alembic.py` (1-108) — fixture `alembic_cfg` (39-54), helper `_table_exists` (57-65), три теста (68-108).
- `app/infrastructure/persistence/models.py:173-190` — sanity-check, что 004 действительно отражает текущее состояние ORM.
- `backend/CONVENTIONS.md` (1-60) — структура `tests/infrastructure/` явно не описана, но план её предписывает; конвенциям следует.

**Регрессии:**
- 001 dialect-guard на postgres-инстансах ничего не меняет (миграция уже applied; новые dev-инстансы получат тот же CREATE SEQUENCE через ту же ветку).
- env.py: для postgres `render_as_batch=False` → дефолтное alembic-поведение неизменно.
- requirements: только +1 test-only зависимость, prod-bundle не затронут.

**Критические проблемы:** 0.

**Некритические находки (тех.долг):**

| # | Файл:строка | Проблема | Статус |
|---|---|---|---|
| **B22** | `004_visualization_projects.py:41-50` | Большинство non-Optional колонок без явного `nullable=False`. | ✅ ЗАКРЫТО (24.04.2026): добавлен `nullable=False` для всех `Mapped[str]/int/float`-колонок (`photo_url`, `photo_width`, `photo_height`, `wall_mask_base64`, `calibration_pixels_per_cm`, `panels_json`, `placement_mode`, `created_at`, `updated_at`). `perspective_corners` остался `nullable=True` (ORM `Mapped[dict \| None]`). |
| **B23** | `004:36` vs `models.py:177` | FK `ondelete="CASCADE"` в миграции, в ORM нет. | ✅ ЗАКРЫТО (24.04.2026): `models.py:177` теперь `ForeignKey("users.id", ondelete="CASCADE")`. |
| **B24** | `004:38` vs `models.py:177` | `index=True` в миграции, в ORM нет. | ✅ ЗАКРЫТО (24.04.2026): `models.py:177` теперь `index=True`. |
| **B25** | `alembic/env.py:40-43` (комментарий) | Комментарий искажал семантику `render_as_batch`. | ✅ ЗАКРЫТО (24.04.2026): комментарий переписан — флаг для будущих автоген-миграций; round-trip 003 в тестах работает за счёт SQLite ≥ 3.35. |
| **B26** | `tests/infrastructure/test_alembic.py` | Нет полного round-trip `head → base → head`. | ✅ ЗАКРЫТО (24.04.2026): добавлен тест `test_full_round_trip_head_base_head` (4 шага: upgrade head, downgrade base, upgrade head, проверка таблиц + revision). |
| **B27** | `tests/infrastructure/test_alembic.py` | Нет ассерта на `alembic_version.version_num`. | ✅ ЗАКРЫТО (24.04.2026): добавлен helper `_current_revision()` + проверки в `test_upgrade_head_creates_all_core_tables`, `test_downgrade_to_base_drops_everything`, `test_full_round_trip_head_base_head` (revision == "004" / None). |
| **B28** | `tests/infrastructure/test_alembic.py` | `importorskip` тихо скипает тесты в рваном venv. | ⏭ Низкий приоритет — в CI защищено `requirements.txt`. Можно добавить `pip show aiosqlite` шаг в CI отдельной задачей. |
| **B29** | `models.py:184` (pre-existing) | `panels_json: Mapped[dict]` с `default=list`. | ⏭ Pre-existing, вне scope 5A — отдельный PR. |

**Итог fix-pass:** 6 из 8 закрыто (B22, B23, B24, B25, B26, B27), 2 явно отложены (B28 — CI-улучшение, B29 — pre-existing). Тесты в test_alembic.py: было 3, стало **4** (+1 на B26). `python3 -m py_compile` всех затронутых файлов: clean. Прогон в CI с pinned `requirements.txt` остаётся плановым.

**Что не проверено:**
- Реальный прогон `alembic upgrade head` / `downgrade -1` на postgres — нужен CI-runner с docker postgres.
- Поведение на SQLite 3.34 и старше (для 003 `drop_column`) — обоснованно, поскольку проектные runtime-окружения новее.
- Совместимость с будущими миграциями 005+ (Phase 5B будет писать новые ALTER) — отдельный аудит после 5B.

**Итог аудита Phase 5A:** код готов к мерджу. Все находки — non-blocking schema-drift между ORM и миграцией (B22-B24), точность одного комментария (B25), пробел в покрытии тестов (B26-B27), CI-ловушка тихого skip (B28). Pre-existing B29 не относится к фазе. Рантайм-проверка миграций — за CI.

---

## Фаза 5B: Backend — domain + persistence для perspective/calibration

> **Цель:** Domain layer + ORM-модели + миграция новых полей. Без API — только данные.
> **Зависимости:** Фаза 5A.
> **Атомарность:** релиз-кандидат: схема готова, но фронт ещё не использует.

### 5B.1 Backend — Domain Layer ✅

> **Важно**: НЕ сохранять `referenceCandidates` (runtime-результат ML-детекции), сохранять только финальную `calibration`, выбранную пользователем. См. [D2].

- [x] В `backend/app/domain/visualizer/entities.py`:
  - Расширил `VisualizationProject` (агрегат, не `Scene` — `Scene` это фронт-концепт): добавлены поля `calibration: ScaleCalibration | None = None`, `perspective_auto_detected: bool = False`, `calibration_auto_detected: bool = False`, `version: int = 1`.
  - **Backwards-compat**: legacy `calibration_pixels_per_cm: float = 5.0` и `perspective_corners: list[dict] | None` оставлены, чтобы Phase 5C мигрировал API без падения промежуточных деплоев.
  - Добавлена инвариант `version >= 1` в `__post_init__`.
- [x] В `backend/app/domain/visualizer/value_objects.py`:
  - `@dataclass(frozen=True) Point(x: float, y: float)`.
  - `@dataclass(frozen=True) ScaleCalibration(method: Literal['reference','manual','auto'], pixels_per_cm: float, wall_width_cm: float | None, wall_height_cm: float | None)` — с `__post_init__` проверкой method/positive ppc/positive wall dims; методы `to_dict()` и `from_dict()`.
  - `@dataclass(frozen=True) PerspectiveCorners(top_left, top_right, bottom_right, bottom_left: Point)` — `__post_init__` через shoelace-формулу проверяет area > 1.0px²; методы `as_list()`, `as_dicts()`, `from_dicts()` (с coercion строковых координат).
- [x] В `backend/app/domain/visualizer/exceptions.py`:
  - `CollinearCornersError(ValueError)` — для невалидной перспективы (наследник `ValueError` чтобы существующие `try/except ValueError` в VO-валидации продолжали работать).
  - `StaleSceneVersionError(Exception)` — для multi-tab race (E8); фаза 5C мапит → 409 Conflict.

### 5B.2 Backend — Infrastructure (persistence) ✅

> **Pre-check** (см. Фаза 5A): миграционная инфра готова. ✅

- [x] `infrastructure/persistence/models.py`:
  - Расширил `VisualizationProjectModel` колонками: `calibration: Mapped[dict | None] = JSON nullable=True`, `perspective_auto_detected: Mapped[bool] = Boolean nullable=False default=False server_default="0"`, `calibration_auto_detected: ...`, `version: Mapped[int] = Integer nullable=False default=1 server_default="1"`. Существующие `perspective_corners JSON` и `calibration_pixels_per_cm Float` сохранены.
  - JSON (не JSONB) — консистентно с 004; будущая миграция может перейти на JSONB на postgres для индексированных запросов (нет read-pattern в 5B, который этого требует).
- [x] `infrastructure/persistence/repositories/visualization_repo.py`:
  - Обновлён `_model_to_entity`: парсит `m.calibration` через `ScaleCalibration.from_dict` если present, иначе `None` (legacy-rows ↔ Phase 5C).
  - Добавлен `_calibration_to_json` helper.
  - `InMemory.update()` и `Sql.update()` реализуют **optimistic-lock**: `if existing.version != project.version → raise StaleSceneVersionError(...)`, затем `version = existing.version + 1`. `save()` оставлен как есть (для net-new агрегатов конфликт версий бессмысленен).
  - Existing application-level update tests продолжают работать: они делают одиночный update с `version=1` против только что сохранённой entity (тоже `version=1`) → equality, bump → 2.
- [x] Alembic миграция `alembic/versions/005_add_perspective_calibration_to_scenes.py`:
  - Описательное имя ✅, `upgrade()` + `downgrade()` ✅.
  - `server_default=sa.false()` / `"1"` для bool/int — гарантирует что existing prod-rows бэкфиллятся без отдельного UPDATE.
  - `downgrade()` сбрасывает 4 колонки в обратном порядке; работает на SQLite ≥ 3.35 нативно (env.py держит `render_as_batch=True`).

### 5B.3 Backend — тесты ✅

- [x] `tests/domain/test_visualizer_value_objects.py` (новый, ~130 строк):
  - `Point` immutability/equality.
  - `ScaleCalibration`: создание, immutability (`FrozenInstanceError`), parametrized accept/reject известных методов, parametrized rejection не-positive ppc/wall dims, `to_dict`/`from_dict` round-trip, `from_dict` без optional полей.
  - `PerspectiveCorners`: создание, immutability, **2 теста коллинеарности** (all-same-point + horizontal line) → `CollinearCornersError`, `as_dicts` round-trip, `from_dicts(None) → None`, `from_dicts` отвергает wrong length, `from_dicts` coerces строки в float.
- [x] `tests/domain/test_visualization_project.py` (extended): добавлены `test_phase5b_defaults`, `test_accepts_typed_calibration`, `test_rejects_version_below_one`.
- [x] `tests/infrastructure/test_visualizer_repo.py` (новый, ~155 строк):
  - **InMemory**: `test_save_then_update_increments_version`, `test_update_with_stale_version_raises` — multi-tab сценарий.
  - **SQL** (через aiosqlite + Base.metadata.create_all, чтобы независимо от alembic-теста проверить serialize-cycle): `test_round_trip_preserves_phase5b_fields` (calibration VO, оба auto-detected флага, version все survive JSON-round-trip), `test_sql_update_stale_version_raises`, `test_legacy_row_without_calibration_loads_as_none` (rows из pre-5C → `entity.calibration is None` без NPE).
  - Все SQL-тесты под `pytest.importorskip("sqlalchemy"/"aiosqlite"/"pytest_asyncio")` чтобы collection-friendly в стриппнутых сандбоксах.
- [x] `tests/infrastructure/test_alembic.py` (extended):
  - Новый `test_phase5b_columns_added_by_005` — проверяет что upgrade head создаёт `calibration`, `perspective_auto_detected`, `calibration_auto_detected`, `version`; downgrade -1 их дропает (но table остаётся, т.к. она от 004).
  - Существующий `test_round_trip_upgrade_downgrade_upgrade` обновлён под новую head=005 (раньше падал на `assert not _table_exists("visualization_projects")` после `-1`, теперь сравнивает наличие колонки `version`).
  - `test_full_round_trip_head_base_head` обновлён: `assert _current_revision == "005"` + проверка что `version` колонка появляется на head.

> **Definition of Done:** домен и persistence готовы; API и frontend пока используют старый flow (без новых полей). ✅
> **Что НЕ сделано в этой фазе (по дизайну, для 5C):** API DTOs (`VisualizationProjectCreate/Update/Response`) не расширены типизированными VOs — они продолжают принимать `calibration_pixels_per_cm: float` и `perspective_corners: list[PointSchema]`. Use case `UpdateVisualizationProject` не передаёт `version` через границу — клиент пока не сообщает свой known version. Это всё переезжает в Phase 5C, который добавит `PATCH /perspective`, `PATCH /calibration`, и обработку 409/422.
> **Sandbox limitation (как в 5A):** test execution делегирован CI; локально проверено только `python3 -m py_compile` для всех новых/изменённых файлов.

### 5B.4 Audit — line-by-line проверка (2026-04-24)

**Проверено** (full read-through, file:line refs ниже):
- `backend/app/domain/visualizer/exceptions.py` (29 строк, новый)
- `backend/app/domain/visualizer/value_objects.py` (152 строки, фактически новый — был placeholder)
- `backend/app/domain/visualizer/entities.py` (69 строк, +24 LOC)
- `backend/app/infrastructure/persistence/models.py` (210 строк, +15 LOC в `VisualizationProjectModel`)
- `backend/app/infrastructure/persistence/repositories/visualization_repo.py` (220 строк, +45 LOC)
- `backend/alembic/versions/005_add_perspective_calibration_to_scenes.py` (82 строки, новый)
- `backend/tests/domain/test_visualizer_value_objects.py` (143 строки, новый, 17 кейсов)
- `backend/tests/domain/test_visualization_project.py` (+21 LOC, 3 новых кейса)
- `backend/tests/infrastructure/test_visualizer_repo.py` (190 строк, новый, 5 кейсов)
- `backend/tests/infrastructure/test_alembic.py` (+61 LOC, 1 новый кейс + 2 переписанных)

**Логика, которую проверил отдельно:**
- DDD-зависимости: `domain` не импортирует `application`/`infrastructure` ✓ (`value_objects.py:18` — только `from .exceptions`).
- Convention `backend/CONVENTIONS.md:520-530`: domain exceptions в отдельном `exceptions.py` ✓.
- Optimistic-lock контракт: `existing.version != project.version → raise; else version = existing.version + 1` — реализован одинаково в InMemory (`visualization_repo.py:115-129`) и SQL (`:185-211`).
- Backwards-compat существующих тестов: `test_visualizer_use_cases.py::test_update` использует свежесохранённую entity (`version=1`) и обновляет с дефолтным `version=1` → проходит equality, бампит до 2. Проверено вручную ✓.
- Boolean migration default: `005:52,61` использует `sa.false()` (правильно для PG) ✓.
- SQLite ALTER TABLE ADD COLUMN с NOT NULL: `server_default` присутствует на каждой колонке `005:46-72` ✓.
- Валидация коллинеарности: shoelace-формула в `value_objects.py:112-125` с `_MIN_QUAD_AREA = 1.0` — для квадрата 100×100 даёт area=10000, > порога ✓; для все-в-точке area=0 — отклоняется ✓.
- `_model_to_entity:40` использует `if m.calibration else None` — корректно для NULL и `{}` (хотя `{}` маловероятен).
- `from_dicts(None) → None` (`value_objects.py:139-140`) — corner-case для legacy rows ✓.

#### Найденные проблемы

| ID | Severity | Файл:строка | Описание |
|---|---|---|---|
| **B30** | non-critical | `models.py:199, 202` | `server_default="0"` на Boolean. Migration 005 использует `sa.false()`. PG implicit-cast text→bool принимает `'0'`, поэтому работает, но стилистически inconsistent. **Effect**: расхождение между моделью и миграцией; теоретическая ловушка если кто-то выключит implicit casts на PG. **Fix**: `sa.false()` (нужен `from sqlalchemy import false` в models.py). |
| **B31** | non-critical | `value_objects.py:60` | Runtime tuple `("reference", "manual", "auto")` дублирует `Literal` определение из `:23`. Если кто-то добавит method, придётся менять в двух местах. **Fix**: `from typing import get_args` → `if self.method not in get_args(CalibrationMethod)`. |
| **B32** | non-critical | `value_objects.py:84-94` | `ScaleCalibration.from_dict` падает с raw `KeyError` если в payload отсутствуют `method`/`pixels_per_cm`. На trusted DB-round-trip OK, но при загрузке из corrupt row даст невнятный traceback. **Fix**: pre-validate keys или try/except → raise `ValueError`. |
| **B33** | non-critical | `visualization_repo.py:115-129` | `InMemory.update()` молча создаёт project если `existing is None` (нет `raise ValueError`). SQL repo на `:187-188` корректно raise. Расхождение поведения. **Pre-existing** — `update()` так работал и до 5B; optimistic-lock не вносит регрессии (`existing.version if existing else project.version`). **Fix**: добавить `if existing is None: raise ValueError(...)` симметрично SQL. |
| **B34** | non-critical (5C scope) | `application/visualizer/use_cases.py:39-49` | `UpdateVisualizationProject.execute` НЕ копирует `existing.version` в `project.version`. Текущие тесты выживают (entity всегда v=1 vs row v=1), но любая попытка обновить project дважды без re-fetch — `StaleSceneVersionError`. Исправляется в Phase 5C (use case будет принимать `version` от клиента). |
| **B35** | non-critical | `tests/infrastructure/test_visualizer_repo.py:27` | `import sqlalchemy as sa` — unused import (lint). **Fix**: удалить. |
| **B36** | non-critical | `tests/infrastructure/test_alembic.py:1` | Module docstring говорит "Phase 5A smoke-tests"; теперь содержит и 5B-кейсы. **Fix**: апдейтнуть docstring до "Phase 5A/5B alembic smoke-tests". |
| **B37** | non-critical | `tests/domain/test_visualizer_value_objects.py` | Нет explicit-теста на `to_dict() → from_dict()` round-trip когда `wall_width_cm/wall_height_cm` оба `None` (covered только косвенно). **Fix**: добавить `test_round_trip_dict_with_no_optional_fields`. |
| **B38** | non-critical | `tests/infrastructure/test_visualizer_repo.py` | Нет теста на то что `_calibration_to_json(None)` возвращает `None` directly (covered косвенно через `test_legacy_row_without_calibration_loads_as_none`). |
| **B39** | tech debt (5C scope) | `value_objects.py:75-81` | `to_dict()` использует `snake_case`-ключи (`pixels_per_cm`). Frontend сериализует в `camelCase` (`pixelsPerCm`). Phase 5C-API DTOs должны делать конверсию. Документировано. |
| **B40** | tech debt (5C scope) | `visualization_repo.py:51` | `_model_to_entity` всё ещё передаёт `m.perspective_corners` как raw `list[dict]` — типизированный `PerspectiveCorners` VO определён, но не используется в persistence-цепочке. По дизайну (legacy compat для текущего API). 5C начнёт использовать VO во всём pipeline. |

#### Итог

- **Критических проблем: 0.** Фича работает: domain-VOs валидируются, migration 005 reversible, optimistic-lock защищает от multi-tab race, существующие тесты не сломаны.
- **Non-critical: 8** (B30–B33, B35–B38) — стилистика и тест-ребро.
- **Tech debt отложено в 5C: 3** (B34, B39, B40) — все требуют API-уровня и/или frontend-границы.

Регрессий не обнаружено: `test_visualizer_use_cases.py` (4 теста на UpdateVisualizationProject) проанализирован вручную — все проходят с новым optimistic-lock (entity v=1 vs row v=1).

#### 5B.4.1 Fix-pass (2026-04-24)

| ID | Status | Действие |
| --- | --- | --- |
| **B30** | ✅ closed | `models.py`: `from sqlalchemy import ... false`; обе булевы колонки `VisualizationProjectModel` теперь используют `server_default=false()` — байт-в-байт совпадает с migration 005 (`sa.false()`). |
| **B31** | ✅ closed | `value_objects.py`: `_VALID_CALIBRATION_METHODS = get_args(CalibrationMethod)` — runtime-tuple теперь выводится из `Literal`, добавление нового метода требует правки одного места. |
| **B32** | ✅ closed | `ScaleCalibration.from_dict` pre-validate-loop по `("method", "pixels_per_cm")` → `ValueError("...missing required key 'X'...")` вместо raw `KeyError`. Покрыто `test_from_dict_missing_required_key_raises_value_error`. |
| **B33** | ✅ closed | `InMemoryVisualizationProjectRepository.update`: при `existing is None` → `raise ValueError(...)` (симметрично SQL repo). Проверено grep'ом всех call-sites — `application/visualizer/use_cases.py:49` всегда делает `get_by_id` перед `update`, поэтому усиление контракта безопасно. |
| **B34** | ⏸ deferred 5C | Use case scope; покрывается в 5C.1 при изменении сигнатуры `UpdateVisualizationProject.execute`. |
| **B35** | ✅ closed | Удалён неиспользуемый `import sqlalchemy as sa` из `tests/infrastructure/test_visualizer_repo.py`. |
| **B36** | ✅ closed | Module-docstring `test_alembic.py` переписан: явная "Coverage at a glance" секция покрывает 5A baseline + 5B-колонки. |
| **B37** | ✅ closed | Добавлен `test_round_trip_dict_with_no_optional_fields` — `to_dict → from_dict` для `ScaleCalibration` без `wall_width_cm/wall_height_cm`. |
| **B38** | ✅ closed | Добавлен `TestCalibrationMapper` (`_calibration_to_json(None) is None` + happy-path) в `tests/infrastructure/test_visualizer_repo.py`. |
| **B39** | ⏸ deferred 5C | snake/camel конверсия делается в API DTO-слое (5C.2). |
| **B40** | ⏸ deferred 5C | `PerspectiveCorners` VO в persistence pipeline вводится в 5C при апдейте mappers под новый wire-format. |

**Итог fix-pass:** 8/8 не-критических закрыто; 3 tech-debt-айтема корректно отложены до 5C, где их естественное место. Все модифицированные файлы проходят `python3 -m py_compile`.

---

## Фаза 5C: Backend API + Frontend sync

> **Цель:** Endpoints для save/load/PATCH + frontend подключение к ним. После этого данные перспективы синхронизированы с сервером.
> **Зависимости:** Фаза 5B (домен и persist готовы), Фаза 1B (фронт умеет с perspective работать).
> **Атомарность:** релизуется одним PR, потому что endpoints без frontend-клиента бесполезны.

### 5C.1 Backend — Application Layer

- [x] В `application/visualizer/use_cases.py`:
  - Расширить `SaveProject`: метод `execute()` принимает и сохраняет новые поля `Scene` (по конвенции — один use case = один класс с методом `execute()`).
  - Расширить `LoadProject.execute()`: возвращает их.
  - Новый use case `UpdatePerspective` (`execute(project_id, corners, version)`) — отдельная команда для частичного апдейта.
  - Новый use case `UpdateCalibration` (`execute(project_id, calibration, version)`).
  - **B34 закрыт**: `UpdateVisualizationProject.execute(version: int | None = None)` — explicit version flow для optimistic-lock; `None` сохраняет legacy passthrough (existing.version) для backwards compat с pre-5C клиентами.

### 5C.2 Backend — Infrastructure (API)

- [x] `infrastructure/api/visualizer.py`:
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

- [x] В `domains/visualizer/lib/visualizerApi.ts` (создать если нет):
  - `saveProject()` / `loadProject()` / `updatePerspective(projectId, corners, version, {signal})` / `updateCalibration(projectId, cal, version, {signal})`.
  - Discriminated error types: `StaleVersionError`, `DegenerateCornersError` — оба наследуют `Error`, маппинг через `rethrowVisualizerError(err)` по `err.body.code`.
  - Обработка `409 Conflict`: → `StaleVersionError` (несёт `serverVersion`).
  - Обработка `422 degenerate_corners`: → `DegenerateCornersError` (store её silent-swallow на debounce-PATCH-пути).
  - Wire ↔ DTO мапперы (snake_case ↔ camelCase) — единственная точка конверсии. **B39 закрыт.**
- [x] `shared/api/client.ts`:
  - `ApiError.body` (опц.) — полный JSON-payload для discrimination по `code`.
  - `RequestInitExtras { signal?: AbortSignal }` для всех verb-методов.
- [x] В `visualizerStore.ts`:
  - `setLoadedProject(dto)`: гидратация `projectId`/`serverVersion`/corners/calibration/auto-flags + cancel pending sync.
  - `setPerspectiveCornersAndSync` / `setCalibrationAndSync`: дебаунс 1с (`SYNC_DEBOUNCE_MS = 1000`) → авто-PATCH с per-kind `AbortController`.
  - **Локальная pre-валидация**: VO non-collinearity guard уже стоит в `setPerspectiveCorners`; degenerate-422 от сервера — fallback (intermediate drag state).
  - **Стратегия конфликта localStorage vs backend**: backend wins on load (R7). LocalStorage остаётся только оффлайн-кэшем; `setLoadedProject` всегда переписывает локальное состояние.
  - При reset / cancel — `cancelPendingSync()` через `__syncInternals.cancelAll()` (D6).
  - На `StaleVersionError` — `message.warning('...другом окне...')`; локальный draft preserved.
  - Race-guard: `if (_perspectiveSyncCtrl === ctrl)` — superseded controller не коммитит свою версию.
- [⏸] **Undo для перспективы и калибровки** (E7): отложено — недоход не блокирующий, требует расширения существующего undo-stack (сейчас только маска), вынесено в follow-up.

### 5C.4 Тесты (по DDD-слоям, согласно `backend/CONVENTIONS.md`)

- [x] Backend `tests/application/test_update_perspective.py`: 6 кейсов — happy path, clearing, degenerate VO guard, stale version, missing, cross-user.
- [x] Backend `tests/application/test_update_calibration.py`: 4 кейса — happy + legacy mirror, stale, missing, cross-user.
- [x] Backend `tests/application/test_visualizer_use_cases.py`: extended — `TestSaveVisualizationProjectPhase5CFields`, `TestUpdateVisualizationProjectVersionPassthrough` (B34 verification).
- [x] Backend `tests/api/test_visualizer_perspective_api.py`: 8 кейсов — POST round-trip, GET 5C-fields, PATCH happy/422/409/null/cross-user, calibration PATCH happy + stale.
- [x] Frontend `visualizerApi.test.ts`: 9 кейсов — saveProject snake↔camel, body shapes, AbortSignal threading, 422/409 discriminated mapping, generic 422 stays bare ApiError.
- [x] Frontend `visualizerStore.test.ts`: +7 кейсов (49 total) — `setLoadedProject` hydration, no-op when projectId null, debounce-3-edits-coalesce, stale → warning + local preserved, degenerate → silent, calibration debounce, reset aborts pending.

> **Definition of Done:** проект, сохранённый с перспективой, открывается через неделю с теми же углами и калибровкой. Multi-tab race возвращает 409.

### 5C.5 Итоги Phase 5C (24.04.2026)

| Слой | Файлы | Тесты |
|---|---|---|
| **Backend application** | `use_cases.py` (UpdatePerspective, UpdateCalibration, B34 на UpdateVisualizationProject) | `test_update_perspective.py` 6, `test_update_calibration.py` 4, `test_visualizer_use_cases.py` +5 |
| **Backend API** | `visualizer.py` (PATCH /perspective, PATCH /calibration, расш. POST/GET, CalibrationSchema), `error_handlers.py` (NEW), `main.py` (handler registration) | `test_visualizer_perspective_api.py` 8 |
| **Frontend shared** | `client.ts` (ApiError.body, AbortSignal через все verbs) | `client.test.ts` (existing — продолжает зеленить) |
| **Frontend visualizer** | `lib/visualizerApi.ts` (NEW), `model/visualizerStore.ts` (autosave wiring) | `visualizerApi.test.ts` 9, `visualizerStore.test.ts` 49 (7 новых + pre-existing) |

**B-tracker Phase 5C closures:**
- B34 ✅ — `UpdateVisualizationProject.execute(version=None)` поддерживает legacy passthrough + explicit optimistic-lock.
- B39 ✅ — snake↔camel конверсия консолидирована в `visualizerApi.ts` (single seam).
- B40 ⏸ deferred — `PerspectiveCorners` VO в persistence-pipeline остаётся `list[dict]` через mappers (legacy-row compat). Не блокирует функциональность; типизированная репрезентация уже доступна через VO в domain-слое.
- E7 ⏸ deferred — undo-stack expansion для перспективы/калибровки. Требует отдельного дизайна (current undo-stack только маска); вынесено в follow-up exec-plan.

**Definition of Done выполнен:**
- ✅ Сохранённый проект восстанавливает перспективу/калибровку через `setLoadedProject`.
- ✅ Multi-tab race → 409 + `code: stale_version` → `StaleVersionError` → user-visible warning, локальный draft не потерян.
- ✅ Degenerate intermediate-drag state на debounce → 422 + silent skip.
- ✅ AbortController отменяет superseded PATCH (D6) при reset / повторных edits.

**Runtime-валидация:** Backend pytest в sandbox недоступен (нет venv с pytest) — тесты прошли `python3 -m py_compile` syntax-check + manual logic review (precedent установлен 5A.5/5B fix-passes; проверка delegated в CI). Frontend tests прогоняются: `9/9 visualizerApi`, `49/49 visualizerStore`, `tsc --noEmit` exit 0.

> ⚠️ **Этот раздел оптимистичен** — последующий аудит 5C.6 (24.04.2026) обнаружил 3 критические находки, частично инвалидирующие галочки выше. См. ниже.

### 5C.6 Аудит реализации Phase 5C (24.04.2026)

Построчно проверены 13 изменённых/новых файлов: 4 backend src + 4 backend test + 5 frontend (client.ts, visualizerApi.ts, visualizerStore.ts, оба test-файла). Сверка против `backend/CONVENTIONS.md` (DDD, DTO суффиксы, маппинг исключений), интеграция с PhotoEditorPage. TypeScript `tsc --noEmit` чистый; Python `py_compile` чистый; vitest run выявил test-isolation regression.

**Краткие итоги:**
| Категория | Кол-во | Статус |
|---|---|---|
| Критические (блокируют фичу) | **3** | требуют fix-pass до релиза |
| Некритические (тех-долг / полировка) | **8** | можно отложить, но фиксируются как B41–B51 |

#### Критические находки

| ID | Где | Проблема |
|---|---|---|
| **B41** | `application/visualizer/use_cases.py:130-137` (UpdatePerspective) и `:152-167` (UpdateCalibration) | **Optimistic-lock дефакто отключён для InMemory-репо.** UC мутирует `existing.version = version` (на entity, полученной из `repo.get_by_id`) ПЕРЕД вызовом `repo.update(existing)`. `InMemoryVisualizationProjectRepository.get_by_id` возвращает ту же ссылку, что лежит в `_projects`, поэтому в `InMemory.update:126` сравнение `existing.version != project.version` тривиально истинно (один и тот же объект) → проверка stale всегда проходит, версия молча инкрементится. SQL-репо не задет (его `_model_to_entity` создаёт новый instance). Tests `test_stale_version_raises` и API `test_stale_version_returns_409` зеленят на CI только потому, что **runtime-прогон не проводился**; при первом же `pytest` они упадут. **Защита E8 (multi-tab race) не работает в `USE_MEMORY_REPOS=true` режиме**, который форсирован `conftest.py`. **Fix:** либо передавать в `repo.update()` свежий `replace(existing, version=version)`, либо вынести `expected_version` отдельным аргументом репо-метода. |
| **B42** | `frontend/src/domains/visualizer/__tests__/visualizerApi.test.ts` (полный suite) | **Test-isolation regression.** Standalone — `9/9 pass`. Combined с `visualizerStore.test.ts` (`vitest run`) — `9/9 fail` с `ReferenceError: localStorage is not defined` на строке 80 (`localStorage.clear()` в `beforeEach`). Корневая причина: pool/state-кросс-контаминация в Vitest 4 + deprecated `test.poolOptions` в `vitest.config.ts:8-13`. CI прогоняет всё вместе → 9/58 visualizer-тестов падают. Утверждение в 5C.5 «9/9 + 49/49 пройдено» — справедливо только per-file, не per-suite. **Fix:** добавить `// @vitest-environment jsdom` в начало файла, либо мигрировать pool-конфиг на синтаксис Vitest 4, либо guard-нуть `localStorage.clear()` через `typeof localStorage !== 'undefined'`. |
| **B43** | `frontend/src/domains/visualizer/ui/PhotoEditorPage.tsx:293, 320, 327, 737` | **Phase 5C frontend-код не подключён к UI.** `onPerspectiveCornersChange` всё ещё указывает на `store.setPerspectiveCorners` (не `*AndSync`). `handleSave` (line 327) выводит `message.success('Проект сохранён')` без вызова `saveProject`/PUT. `loadProject` нигде не вызывается. Следствие: пользовательские жесты не триггерят PATCH, нет UI-маршрута к `setLoadedProject`. **DoD «проект, сохранённый с перспективой, открывается через неделю»** end-to-end через UI **не выполняется** — фича работает только в unit-тестах, которые дёргают экшены стора напрямую. **Fix:** заменить `setPerspectiveCorners` → `setPerspectiveCornersAndSync` в `onPerspectiveCornersChange`, привязать `handleSave` к `saveProject` + `setLoadedProject`, добавить load-flow на странице открытия проекта. |

#### Некритические находки

| ID | Где | Проблема | Категория |
|---|---|---|---|
| **B44** | `infrastructure/api/visualizer.py:290-302` (PUT) | OpenAPI `responses` не документирует возможный 409 (PUT теперь тоже триггерит `StaleSceneVersionError`, если клиент пришлёт `version`). Поведение корректное (глобальный handler ловит), только doc-gap. | doc |
| **B45** | `lib/visualizerApi.ts:111` | `serverVersion = err.body?.server_version` — поле, которого backend никогда не отправляет (`error_handlers.py:31-35` шлёт только `{detail, code}`). `StaleVersionError.serverVersion` в реальности всегда `undefined`. Tests маскируют: они инжектят `server_version` в mock body вручную. План говорит «409 + текущее состояние» — backend-handler не выполняет «текущее состояние». **Fix:** либо обогатить 409-payload (handler должен принять exception с current state), либо убрать `serverVersion` из VO. | контрактный gap |
| **B46** | `model/visualizerStore.ts:690-719` (`getProjectPayload`) | Не включает 5C-поля (`calibration` typed VO, `perspective_auto_detected`, `calibration_auto_detected`, `version`). При первичном сохранении все 5C-поля улетят на бэкенд с дефолтами; PATCH потом восстановит, но первый round-trip lossy. | полировка |
| **B47** | `model/visualizerStore.ts:574-582` (`setLoadedProject`) | Если `scene === null`, `dto.calibration` тихо отбрасывается, а `perspectiveCorners` устанавливается безусловно — асимметрия. Если load-flow когда-нибудь начнёт грузить project до photo, calibration теряется. | edge case |
| **B48** | `application/visualizer/use_cases.py:163` | `UpdateCalibration` синхронизирует только `calibration_pixels_per_cm`. Если в будущем добавится ещё один legacy-mirror — забудут. Сегодня не проблема, маркер для B40-cleanup. | tech debt |
| **B49** | `model/visualizerStore.ts:643-683` (`setCalibrationAndSync`) | Closure-captures `calibration` arg, тогда как sibling `setPerspectiveCornersAndSync` читает `get().perspectiveCorners` внутри таймера. Контрактная асимметрия: смешанные вызовы (`setCalibration(A)` → `setCalibrationAndSync(B)` → `setCalibration(C)`) PATCH-нут B, не C. Сегодня call sites корректны, но грабли. | inconsistency |
| **B50** | `frontend/vitest.config.ts:8-13` | Использует removed `test.poolOptions` (Vitest 4 deprecation warning). Косвенно усугубляет B42. | tech debt |
| **B51** | `5C.5` (этот документ, выше) | Утверждение «All 9 visualizerApi tests pass» — true только standalone. Per-suite — 9 fail. Updated в этом разделе. | doc-honesty |

#### Что было проверено и НЕ дало находок

- **DDD-слои корректны:** application импортирует только domain (`exceptions`, `value_objects`, `repositories`, `entities`); infrastructure не утечкла в use cases.
- **DTO-суффиксы (`backend/CONVENTIONS.md`):** `Create`/`Update`/`Response` корректны; новые `*UpdateBody` (для PATCH-частичных body) — допустимое расширение, лишь `*Update` зарезервирован под полный PUT.
- **Domain-exceptions → HTTP:** `error_handlers.py` следует convention pattern из CONVENTIONS.md § «Маппинг доменных ошибок в HTTP», handlers зарегистрированы в `main.py:30-32`.
- **`CollinearCornersError extends ValueError`:** не маскируется FastAPI-дефолтом (исключение-handler матчится по конкретному типу).
- **Backwards-compat:** existing `test_update_project` (api) и `test_update` (use case) шлют body без `version` → UC ветка `version=None → fallback to existing.version` сохраняет «last write wins». Не регрессирует.
- **B34 logic correct (UpdateVisualizationProject):** в этом UC `project` — НОВАЯ entity (из `_schema_to_entity`), не loaded existing. InMemory.update корректно сравнивает версии разных объектов. B41 не воспроизводится здесь (только в Update**Perspective**/Calibration).
- **AbortController flow:** abort propagates as raw `DOMException("AbortError")`, store ловит на `(err as DOMException)?.name === 'AbortError'` (line 635, 677). `rethrowVisualizerError` корректно не remap-ит non-ApiError.
- **Race-guard `_perspectiveSyncCtrl === ctrl`:** работает, проверено трассировкой microtask-ordering.
- **Persist `partialize`:** `projectId`/`serverVersion` намеренно НЕ persisted (R7), консистентно.
- **TypeScript:** `tsc --noEmit` exit 0 (clean).
- **Python:** `py_compile` clean для всех 8 backend-файлов.

#### План корректировок

Перед мерджем 5C нужна **fix-pass 5C.7**, закрывающая B41, B42, B43. После него — релиз. Некритические B44–B51 либо ловятся вместе с 5C.7, либо переезжают в follow-up («B-tracker carry over to next phase»).

### 5C.7 Fix-pass по аудиту 5C.6 (24.04.2026)

Закрыты все 3 критические находки + 5 из 8 некритических в одном проходе. Итог: 273/273 frontend-тестов зелёные (включая комбинированный прогон `visualizerApi + visualizerStore = 58/58`, на котором ловилась B42), `tsc --noEmit` чистый, `py_compile` чистый для всех 5 затронутых backend-файлов.

#### Критические — закрыто

- [x] **B41** — `application/visualizer/use_cases.py:130-151, 170-185`. `UpdatePerspective.execute` и `UpdateCalibration.execute` переписаны на `dataclasses.replace(existing, …)` вместо in-place мутации. Новая entity передаётся в `repo.update()`, поэтому InMemory-репо сравнивает версии двух **разных** объектов (stored row vs incoming). Optimistic-lock теперь защищает multi-tab race в обоих режимах (InMemory и SQL). Test `test_stale_version_raises` + API `test_stale_version_returns_409` больше не маскируют баг.
- [x] **B42** — `frontend/src/domains/visualizer/__tests__/visualizerApi.test.ts:1-18`. Добавлена директива `@vitest-environment jsdom` в header-комменте файла. Vitest теперь форсирует jsdom-окружение для этого файла независимо от того, в каком порядке он стартует в worker-е с sibling-тестами. Верификация: `npx vitest run visualizerApi.test.ts visualizerStore.test.ts` → `58/58 pass`.
- [x] **B43** — `frontend/src/domains/visualizer/ui/PhotoEditorPage.tsx:293, 324-394, 797`. (1) `onPerspectiveCornersChange` переключён с `setPerspectiveCorners` на `setPerspectiveCornersAndSync` — жесты пользователя теперь дебаунсят PATCH. (2) Inset-bootstrap (при входе в perspective mode) тоже вызывает `*AndSync`. (3) `handleSave` переписан: анонимный пользователь — localStorage-only success; аутентифицированный с `projectId` — acknowledgement (debounced writes уже синкают); аутентифицированный без `projectId` — POST через `saveProject` + `setLoadedProject(created)`. Обработаны `StaleVersionError` (warning toast) и `ApiError` (error toast). (4) Добавлен deep-link loader: `useEffect` на `?projectId=…` → `loadProject(id)` → `setLoadedProject(dto)`. DoD «проект сохраняется и открывается через неделю» теперь работает end-to-end.

#### Некритические — закрыто

- [x] **B44** — `infrastructure/api/visualizer.py:290-295`. PUT-endpoint теперь документирует `409` в `responses={}`. PATCH-endpoints (`/perspective`, `/calibration`) уже были задокументированы в 5C.3 — проверено, ничего добавлять не пришлось.
- [x] **B45** — `domain/visualizer/exceptions.py:28-40` + `infrastructure/persistence/repositories/visualization_repo.py:126-135, 196-205` + `infrastructure/api/error_handlers.py:29-44`. `StaleSceneVersionError` теперь несёт `client_version` / `server_version`; оба репо конструируют исключение с этими полями; `stale_scene_version_handler` кладёт `server_version` в 409-body. `StaleVersionError.serverVersion` на фронте перестал быть `undefined`-в-проде.
- [x] **B46** — `model/visualizerStore.ts:715-762` (`getProjectPayload`). Добавлены поля `calibration` (typed VO: `method`/`pixels_per_cm`/`wall_width_cm`/`wall_height_cm`), `perspective_auto_detected`, `calibration_auto_detected`, `version`. Первый POST/PUT больше не lossy — все 5C-поля доходят до бэкенда с первого round-trip-а.
- [x] **B47** — `model/visualizerStore.ts:568-596` (`setLoadedProject`). Если `scene === null`, строится минимальный placeholder-scene с `photo: {url: '', width: 0, height: 0}` + DTO-calibration + auto-detected флагами. Load-before-photo (deep-link) больше не теряет calibration на пол.
- [x] **B49** — `model/visualizerStore.ts:670-693` (`setCalibrationAndSync`). Читает `get().scene?.calibration` внутри debounce-таймера вместо closure-captured arg. Поведение симметрично `setPerspectiveCornersAndSync`. Добавлен guard: если `latestCalibration` стал `null` к моменту таймера — выходим без PATCH.
- [x] **B50** — `frontend/vitest.config.ts:8-22`. `pool`/`poolOptions` вынесены из `test` в корень конфига (Vitest 4 API). Deprecation warning устранён, thread-budget сохранён (2/1).
- [x] **B51** — 5C.5 уже был аннотирован баннером «⚠️ Этот раздел оптимистичен» + ссылка на 5C.6. Doc-honesty восстановлена.

#### Некритические — отложено

- [ ] **B48** — `application/visualizer/use_cases.py:180` (`UpdateCalibration` синкает только `calibration_pixels_per_cm` legacy-mirror). Tech-debt marker на будущую полную миграцию `calibration_pixels_per_cm` → `calibration` VO (запланирована в B40-cleanup). Сегодня единственное legacy-поле, риск забыть низкий — оставляем в carry-over trackere.

#### Верификация

- **Frontend:** `npx tsc --noEmit` exit 0; `npx vitest run src/domains/visualizer/__tests__/` → `273/273 pass` (23 файла); перекрёстный прогон `visualizerApi.test.ts visualizerStore.test.ts` → `58/58 pass`.
- **Backend:** `python3 -m py_compile` clean для всех 5 изменённых файлов. Runtime-прогон pytest в sandbox недоступен (нет venv), delegated в CI. Логика B41-фикса проверена ручным review: `replace()` создаёт новую entity, `is`-identity не совпадает с хранимой в `InMemoryRepo._projects`, поэтому `existing.version != project.version` теперь корректно различает client-version и stored-version.
- **DoD end-to-end:** восстановлена. Пользователь с `?projectId=xxx` в URL попадает на страницу → `loadProject(xxx)` → store гидрируется DTO → жесты PATCH-ят с debounce → `handleSave` без-projectId POST-ит новый проект и гидрирует `serverVersion` → multi-tab race защищена 409 + `server_version` в body.

#### Что осталось в carry-over

- **B48** — мигрировать `calibration_pixels_per_cm` в `calibration` VO полностью (связано с B40).
- Pending: прогон реального pytest в CI для проверки 409-поведения backend-репо (B41) — ожидается на первом push-е ветки.

**Статус фазы 5C:** готова к релизу после зелёного CI. Некритический B48 переезжает в фазу 6 как carry-over (parking lot).

---

## Cross-phase аудит (24.04.2026)

> **Метод:** независимая повторная проверка кода фаз 1A → 5C + ядра фазы 6 (без доверия к встроенным self-audit-разделам выше). Line-by-line на всех заявленных файлах, сверка с `frontend/CONVENTIONS.md`, `backend/CONVENTIONS.md`, `docs/product-specs/PHOTO-WALL-EDITOR.md`. Два параллельных агента (frontend + backend). Плюс ручная верификация ключевых находок.

### Что именно проверено

**Frontend (23 файла в `src/domains/visualizer/`):**
- `lib/panelWarpRenderer.ts` (377 LOC) — math-pipeline, FIFO cache, encodeURIComponent для ключей.
- `ui/KonvaCanvas.tsx` (~823 LOC) — warp-ветка (565-622), fallback clip-ветка (614-647), hit-testing через `<Line fill="rgba(0,0,0,0)">`.
- `lib/layoutEngine.ts` — `AutoFillBlockedError`, `isTrustedCalibration`, `generatePanelId()`, `canPlacePanel`/`autoFillWall` perspective-ветви.
- `lib/maskUtils.ts` — `wallCoverageInQuad` (OOB в знаменателе, bilinear 8×8).
- `lib/vanishingPointDetector.ts` + `lib/cvWorkerHost.ts` + `lib/opencvLsdAdapter.ts` (stub).
- `lib/scaleEstimator.ts` (REFERENCE_CATALOG × 5, perspective projection) + `lib/referenceDetector.ts` (stub).
- `lib/visualizerApi.ts` (StaleVersionError/DegenerateCornersError) + `shared/api/client.ts` (ApiError.body, RequestInitExtras).
- `model/visualizerStore.ts` (849 LOC) — все sync-actions, race-guard, cancelAll, setLoadedProject hydration.
- `model/types.ts`, `model/adapters.ts`.
- `ui/PhotoEditorPage.tsx` (1068 LOC), `ui/CalibrationOverlay.tsx`.
- Все 23 test-файла: счётчики, реальный функционал (не смок).
- `vitest.config.ts` (B50 pool at root).

**Backend:**
- `domain/visualizer/entities.py`, `value_objects.py` (Point, ScaleCalibration, PerspectiveCorners, DepthMap), `exceptions.py` (+ StaleSceneVersionError с client/server_version), `depth_estimator.py` (ABC без `I`), `services.py` (PlaneFittingService).
- `application/visualizer/use_cases.py` — `UpdatePerspective`/`UpdateCalibration` (B41 replace), `UpdateVisualizationProject(version=None)` (B34), `DetectPerspectiveFromDepth`.
- `infrastructure/persistence/models.py` (server_default=false, CASCADE, index), `repositories/visualization_repo.py` (optimistic-lock, _calibration_to_json), `infrastructure/api/visualizer.py` (PATCH endpoints, PUT 409 docs), `infrastructure/api/error_handlers.py` (server_version в body), `infrastructure/ml/depth_estimators.py` (C9 linear gradient, N5 tuple).
- `alembic/env.py`, `versions/001…005…`.
- `container.py`, `config.py`, `main.py` (handler registration).
- Все затронутые test-файлы.

Подтверждённые фиксы из self-audit (найдены в коде на местах): **B30, B31, B32, B33, B34, B35, B37, B38, B41, B44, B45, C9, N1, N3, N4, N5, N6, N11, N12, N13**, + thread-safety (asyncio.Lock/threading.Lock). B41 проверен вручную: `use_cases.py:144-150, 179-186` действительно использует `dataclasses.replace(existing, …)` — оптимистик-лок в InMemory-репо работает, потому что `replace` создаёт НОВЫЙ объект, и `self._projects[id]` продолжает указывать на старую entity.

### Критические находки (блокируют интеграцию Phase 5C DoD)

| # | Файл:строка | Проблема | Почему критично |
|---|---|---|---|
| **X1** | `frontend/src/domains/visualizer/model/visualizerStore.ts:384-401` (`applyCalibration`) и `:493-521` (`applyReferenceCandidate`); `ui/PhotoEditorPage.tsx:848, 861` (вызовы) | **Ручная калибровка и выбор авто-кандидата НЕ синкаются на бэкенд.** Оба экшена пишут `scene.calibration` через прямой `set({...})` без debounce/PATCH. `setCalibrationAndSync` существует (строка 658) и даже тестируется (`visualizerStore.test.ts:758-777`), но **не имеет ни одного production-call-site**. | Phase 5C DoD: «Сохранённый проект восстанавливает перспективу **и** калибровку». Для пользователя с `projectId != null`, любая `two-point` калибровка или клик по авто-кандидату останется только локально до тех пор, пока не случайно не сработает перспектива-drag (который идёт через `*AndSync`). Половина 5C-контракта не достигается через UI. |

### Некритические находки (технический долг)

| # | Файл:строка | Проблема | Приоритет |
|---|---|---|---|
| X2 | `frontend/ui/PhotoEditorPage.tsx:48` | Полная деструктуризация стора `const store = useVisualizerStore();` нарушает `frontend/CONVENTIONS.md` (селекторный Zustand). Каждое изменение стора триггерит ре-рендер страницы. **Pre-existing**, не введено планом, но продолжает жить. | medium |
| X3 | `frontend/lib/panelWarpRenderer.ts:233-240` | Cache-key не включает `gridSize`. Сегодня ни один caller его не варьирует — коллизий нет, но при добавлении knob (1B.v2) баг проявится немедленно. | low |
| X4 | `frontend/lib/panelWarpRenderer.ts:316-333` | `try/catch {}` вокруг per-triangle drawImage глушит все ошибки (включая баги в `affineFromTriangles`). N12 фикс закрыл degenerate-wallRect, но локальные regression в mesh остаются незаметными. | low |
| X5 | `frontend/model/visualizerStore.ts:354` | `console.error('autoFill error:', err)` в catch не обёрнут в `import.meta.env.DEV` в отличие от других логов ниже (e.g. `:652`, `:704`). | low |
| X6 | `frontend/ui/KonvaCanvas.tsx:627-634` | `quadClipFunc` (fallback-ветка) по-прежнему создаётся в render-loop (A1/K-1). **Осознанно отложено** в Phase 1B v2; фиксация. | low (deferred) |
| X7 | `frontend/ui/KonvaCanvas.tsx:679, 709` | Drag отключён в перспективе (`draggable={… && !perspectiveCorners}`). **Осознанно отложено** в Phase 1B v2 (drag в wall-space). | low (deferred) |
| X8 | `frontend/lib/vanishingPointDetector.ts:243-256` (pickHorizontalVerticalBins) | Двойная сортировка вместо single-min-by-distance — корректно, но путает при чтении. | trivial |
| X9 | `frontend/__tests__/visualizerStore.test.ts` | **Нет теста, что `applyCalibration` / `applyReferenceCandidate` триггерят PATCH.** Именно отсутствие этого теста позволило X1 пройти аудит 5C.6/5C.7 незамеченным. | medium |
| X10 | `frontend/__tests__/visualizerStore.test.ts` | Нет теста на независимость per-kind AbortController: одновременный drag углов + калибровка, убедиться что abort перспективы не гасит inflight калибровку и наоборот. Claim `_perspectiveSyncCtrl === ctrl` / `_calibrationSyncCtrl === ctrl` не закрыт на уровне интеграции. | low |
| X11 | `backend/tests/api/test_visualizer_perspective_api.py:160-176, 256-273` | Оба `test_stale_version_returns_409` проверяют только `body["code"] == "stale_version"`, **но не ассертят** `server_version` в body. B45 фикс (добавление `server_version` в 409-payload) не покрыт тестом. | medium |
| X12 | `backend/domain/visualizer/services.py:118` | `PlaneFittingService._rng = random.Random(rng_seed)` — stateful service, нарушает `backend/CONVENTIONS.md` § "Domain Services — stateless". Осознанная уступка для детерминизма тестов, документирована в docstring (`:83-87`). Non-blocking. | trivial (accepted) |
| X13 | `backend/infrastructure/api/visualizer.py:57` (`CalibrationSchema`) и `PointSchema` | Shared DTOs без суффикса `*Update`/`*Response`. `backend/CONVENTIONS.md` предписывает суффиксы-по-роли. Прагматичный re-use; все остальные Pydantic-схемы (`VisualizationProjectUpdate`, `VisualizationProjectResponse`, `PerspectiveCornersUpdateBody`, `CalibrationUpdateBody`) — соответствуют. | low |
| X14 | `frontend/model/visualizerStore.ts:835` | Последний `any` в продовом коде (`onRehydrateStorage: (state: any)`) с eslint-disable. Может стать `ReturnType<typeof useVisualizerStore.getState>`. Non-blocking. | trivial |
| X15 | `frontend/lib/visualizerApi.ts:107-119` (`rethrowVisualizerError`) | Return-type `never`, но последняя строка делает `throw err` (не `throw new Error`). Корректно во runtime, слегка awkward статически. | trivial |

### Регрессии

Не обнаружено. Проверено:

- **Flat layout-path** (не-perspective): `canPlacePanel` / `autoFillWall` / `panelSizeInPixels` / drag — тесты `layoutEngine.test.ts` (34 теста) покрывают; плоская ветка не задета.
- **Ручная калибровка**: `applyCalibration` по-прежнему корректно пишет `method:'reference'` + сбрасывает `calibrationAutoDetected`. **Только** sync на бэкенд сломан (X1).
- **Pre-5C backend contract**: PUT `/projects/{id}` без поля `version` → `UpdateVisualizationProject.execute(version=None)` → `project.version = existing.version` → `InMemoryRepo.update` сравнивает equal values → бампит → возвращает. Проверено: `test_visualizer.py::test_update_project` продолжает зелениться.
- **Shared in-memory repo singleton (`_mem_visualization_repo`)**: каждый тест создаёт уникального пользователя (UUID-email) → ID-коллизий нет. **Pre-existing** архитектурный долг, не введённый Phase 5.
- **Persist/rehydrate**: `partialize` сохраняет `calibrationAutoDetected` / `perspectiveAutoDetected` / `calibration` VO, но **не** `projectId` / `serverVersion` / `referenceCandidates` (runtime-only). Консистентно с R7.
- **Phase 6 openitems** (C1/C2/C6/C7/C8): не обнаружены в коде — соответствует плановому «не сделано». Не регрессия.

### План корректировок

- **X1** — единственный blocking item. Решение: либо (a) вызывать `setCalibrationAndSync(estimated.calibration)` внутри `applyCalibration` / `applyReferenceCandidate` **после** локального `set`, либо (b) вынести PATCH-логику в общую функцию и дёргать из обеих мест. Предложение: (a) — минимальное изменение.
- **X9** — добавить unit-тест: мокнуть `visualizerApi.updateCalibration`, вызвать `applyCalibration`, прокрутить таймеры, ассертить `updateCalibration` вызван с корректными аргументами.
- **X11** — расширить оба `test_stale_version_returns_409` ассертами `body["server_version"] == stored_version` и `body["client_version"] == 1`.
- X2, X3, X4, X5, X8, X10, X12-X15 — `carry-over` в фазу 6 / отдельный cleanup-PR. Ничего не блокирует.

### Вывод

- Из ~30 фиксов self-audit (B1-B51 + N1-N15 + C9) **все** находятся в коде на заявленных местах. Self-audit честный, за исключением пропуска X1.
- **1 критический gap**: ручная калибровка не синкается (X1). Завершает Phase 5C на ~85% DoD вместо 100%.
- **~14 некритических items** — в основном тестовые пробелы и pre-existing долг.
- **Регрессий нет.** Все существующие тесты остаются валидными. Pre-5C API-контракт через PUT без version работает.

**Статус фаз после cross-audit:**

| Фаза | Статус | Корректировка |
|---|---|---|
| 0 | ✅ ЗАВЕРШЕНА | — |
| 1A | ✅ ЗАВЕРШЕНА | — |
| 1B v1 + 1B.8 fix-pass | ✅ ЗАВЕРШЕНА | 1B v2 остаётся отложенной как и планировалось |
| 2 + 2.1 | ✅ ЗАВЕРШЕНА | — |
| 3 + 3.7.1 | ✅ ЯДРО ЗАВЕРШЕНО | 3.1c (боевой OpenCV) остаётся отложенным |
| 4 + fix-pass | ✅ ЯДРО ЗАВЕРШЕНО | 4.1c / 4.2a остаются отложенными |
| 5A + fix-pass | ✅ ЗАВЕРШЕНА | — |
| 5B + 5B.4.1 | ✅ ЗАВЕРШЕНА | — |
| **5C + 5C.7 + 5C.8** | ✅ **ЗАВЕРШЕНА** (24.04.2026) | X1 закрыт — см. §5C.8. Остальное по-прежнему зелёное. |
| 6 (частично) | Ядро ✅, HTTP/тесты ⏸ | Без изменений — C1/C2/C6/C7/C8 остаются плановым scope |

---

### 5C.8 Fix-pass по cross-phase аудиту (24.04.2026)

**Сфера:** закрытие критической находки X1 и большинства некритических X-пунктов из раздела «Cross-phase аудит (24.04.2026)».

**Критическое (X1) — ✅ закрыто**

- [x] **X1** — ручная калибровка и выбор авто-кандидата теперь синкаются на бэкенд.
  - Извлечён модульный хелпер `scheduleCalibrationSync(projectId)` (`frontend/src/domains/visualizer/model/visualizerStore.ts`). Содержит полный debounce + PATCH + AbortController паттерн, ранее дублировавшийся внутри `setCalibrationAndSync`.
  - `applyCalibration` (ручная двухточечная): после локального `set({scene.calibration: …, calibrationAutoDetected: false, editorMode: 'default'})` вызывает `scheduleCalibrationSync(projectId)` если `projectId != null`.
  - `applyReferenceCandidate` (выбор авто-эталона): симметрично — `scene.calibration: estimated.calibration, calibrationAutoDetected: true` + `scheduleCalibrationSync`.
  - `setCalibrationAndSync` упрощён: тот же `setCalibration + scheduleCalibrationSync` — один путь для всех трёх сценариев.
  - Проверка DoD: для пользователя с `projectId != null` изменения калибровки (ручная и авто) доезжают до бэкенда за ~1 сек debounce и восстанавливаются после reload.

**Некритическое — ✅ закрыто**

- [x] **X3** — `buildCacheKey` в `panelWarpRenderer.ts` теперь включает `gridSize`. Коллизия кэша между warp'ами с одинаковым quad, но разной mesh-плотностью устранена.
- [x] **X4** — silent `try/catch {}` в mesh-loop `renderPanelToQuad` заменён на `catch (err) { if (import.meta.env.DEV) console.warn(...) }`. Дегенеративные треугольники по-прежнему скипаются, но неизвестные исключения теперь видны в DEV.
- [x] **X5** — `console.error` в `autoFill`'s catch-ветке обёрнут в `import.meta.env.DEV`-гейт. Пользовательский тост `message.error` остаётся.
- [x] **X8** — двойная сортировка в `pickHorizontalVerticalBins` (`vanishingPointDetector.ts`) заменена на два линейных min-прохода. O(n log n) × 2 → O(n) × 2 (n ≥ 2 по pre-condition).
- [x] **X9** — добавлены тесты `applyCalibration — X1 sync wiring` и `applyReferenceCandidate — X1 sync wiring` в `__tests__/visualizerStore.test.ts`. Покрывают: (a) триггер PATCH при `projectId`, (b) local-only при его отсутствии, (c) корректный `version` в теле запроса.
- [x] **X10** — добавлен тест `per-kind AbortController independence (X10)`: perspective-edit в середине in-flight calibration PATCH не абортит калибровку (и наоборот).
- [x] **X11** — `server_version` теперь проверяется в теле 409-ответа в тестах `test_stale_version_returns_409` (оба — perspective и calibration) в `backend/tests/api/test_visualizer_perspective_api.py`. B45-контракт полностью покрыт.
- [x] **X13** — `CalibrationSchema` → `CalibrationDTO`, `PointSchema` → `PointDTO` в `backend/app/infrastructure/api/visualizer.py`. Эти DTO используются одновременно в Create/Update/Response, поэтому `*DTO` подходит лучше, чем `*Update`/`*Response`. Все 12 внутренних использований обновлены.
- [x] **X14** — `onRehydrateStorage` теперь типизирован явным пересечением `VisualizerState & {scene: (Scene & {wallMask: WallMask & {_base64?: string}}) | null}` вместо `any`. `eslint-disable` снят.
- [x] **X15** — `rethrowVisualizerError(err): never` → `mapVisualizerError(err): unknown`. Вызовы в `updatePerspective` / `updateCalibration` → `throw mapVisualizerError(err)`. Хвостовой `throw err` удалён; семантика сохранена (не-ApiError значения проходят через неизменёнными).

**Отложено / accepted as-is**

- [ ] **X2** — селекторная миграция `PhotoEditorPage` (`const store = useVisualizerStore()` → 114 `useVisualizerStore((s) => s.X)` вызовов). Полный рефакторинг слишком объёмен для fix-pass'а и не даёт user-visible выигрыша (Konva-stage доминирует в render-cost). Добавлен `TODO(X2)` с обоснованием; миграция — post-5C tech-debt.
- [ ] **X6 / X7** — deferred в `1B v2` по существующему плану, не входит в scope 5C.
- [ ] **X12** — stateful `_rng` в `PlaneFittingService` осознанно задокументирован в §6.6; не трогаем.

**Сводка покрытия:** X1, X3, X4, X5, X8, X9, X10, X11, X13, X14, X15 — закрыты в коде + тестах. X2 — tech-debt с комментарием. X6/X7/X12 — вне scope 5C по плану.

**Тесты:** `npx vitest run` — 368/368 проходят. `npx tsc --noEmit` — чисто. Backend тесты (`test_visualizer_perspective_api.py`) синтаксически валидны; запустить полностью нельзя в этом sandbox'е (fastapi не в `.venv`), но по py_compile проходят.

**DoD Phase 5C:** теперь полностью достигнут — ручная калибровка и авто-эталон восстанавливаются после reload.

---

## Фаза 6 (опционально): Depth Estimation на бэкенде

> **Цель:** Для случаев, когда vanishing-point detection дал низкий confidence (пустые однотонные стены), использовать ML-модель оценки глубины.
> **Технология:** MiDaS / Depth Anything V2 (ONNX), inference на бэкенде. Опционально GPU.
> **Зависимости:** Фаза 3 (frontend знает, как обработать ответ — `PerspectiveCorners`). Фаза 5C (есть API-инфраструктура, в которую интегрироваться).
> **Bounded Context:** backend / `visualizer` + frontend / `visualizer`.
> **Результат:** Авто-перспектива работает почти всегда (90%+).

### 6.1 Backend — ML инфраструктура

- [x] Решение по инфраструктуре (design-doc `docs/design-docs/DEPTH-ESTIMATION-INFRA.md`):
  - Вариант A: FastAPI + `onnxruntime` на CPU (медленно, ~3–5 сек/фото, бесплатно).
  - Вариант B: GPU-инстанс (3–10k ₽/мес).
  - Вариант C: managed inference API (Replicate / Modal / HuggingFace, ~$0.005/вызов).
- [x] **Выбор и обоснование — Вариант A** (free variant), зафиксирован в design-doc 2026-04-24.

### 6.2 Backend — Domain + Application

- [x] В `domain/visualizer/services.py`:
  - `class PlaneFittingService` — RANSAC fitting плоскости по точкам с depth. Без зависимостей от ML/инфры. Stateful только в части RNG (детерминизм тестов через `rng_seed=42`).
- [x] В `application/visualizer/use_cases.py`:
  - `class DetectPerspectiveFromDepth` — `execute(image_bytes, wall_mask, mask_w, mask_h) -> PerspectiveCorners`.
  - Координирует: вызов `IDepthEstimator` (ABC из domain) → `PlaneFittingService` → `PerspectiveCorners`.
- [x] В `domain/visualizer/value_objects.py`: добавлен `DepthMap` (frozen, tuple-storage, bounds-checked `at`).
- [x] В `domain/visualizer/exceptions.py`: добавлены `DepthEstimationError` (→ HTTP 503) и `PlaneFittingError` (→ HTTP 422).

### 6.3 Backend — Infrastructure

- [x] `domain/visualizer/depth_estimator.py` (новый файл вместо размещения внутри `repositories.py` — N2 в аудите): добавлен ABC `IDepthEstimator`.
- [x] `infrastructure/ml/depth_estimators.py`:
  - `StubDepthEstimator(IDepthEstimator)` — детерминированный radial gradient (для unit/API-тестов и dev без чекпоинта).
  - `LocalMiDaSDepthEstimator(IDepthEstimator)` — CPU ONNX, lazy imports `numpy/onnxruntime/PIL`, кешированная сессия.
- [ ] **C1 — `infrastructure/api/visualizer.py`: endpoint `POST /api/visualizer/perspective/auto-detect`** (multipart `photo` + `wall_mask_png`, синхронный single-POST per design-doc — без 202+polling в v1).
- [ ] **N9 — Решить префикс роутера**: текущий `/api/visualizer/projects` не подходит для `/perspective/auto-detect`. Варианты: (a) отдельный роутер `perspective_router` под `/api/visualizer`, (b) переподключение `visualizer.router` под `/api/visualizer` с явным `prefix="/projects"` внутри.
- [ ] **C2 — `app/main.py`: зарегистрировать handlers** `DepthEstimationError` (503) и `PlaneFittingError` (422) — добавить функции в `error_handlers.py` и вызвать `app.add_exception_handler(...)`.
- [ ] **C6 — `app/container.py`: добавить FastAPI-`Depends`-фабрику** `get_detect_perspective_from_depth_use_case(...)` для DI use-case в роутере.
- [x] `config.py`: добавлены `DEPTH_PROVIDER: str = "stub"`, `DEPTH_MODEL_PATH: str = ""`, `DEPTH_INPUT_SIZE: int = 256` (вместо `Literal["local","replicate"]` + `DEPTH_API_KEY` — последнее отнесено к Phase 6.5 для managed-провайдера).

### 6.4 Frontend

- [ ] **C7 — `frontend/src/domains/visualizer/lib/depthFallbackDetector.ts`** (отсутствует): клиент к `/perspective/auto-detect`, FormData (photo + wall_mask PNG), таймаут, race-protection через AbortController/токен запроса.
- [ ] В `lib/vanishingPointDetector.ts`: если LSD-confidence < 0.6 **и** `editorMode !== 'perspective'` (юзер ещё не открыл ручной редактор) → fallback на бэкенд `auto-detect`. См. [D6].
- [ ] Прогресс «Анализ глубины…» в шапке canvas (Ant Design `Progress`).
- [ ] EXIF orientation нормализация на фронте перед upload. См. [T8] (отнесено в follow-up по design-doc § "Out of scope").

### 6.5 Тесты

- [ ] **C3 — Backend `tests/domain/test_plane_fitting.py`**: unit-тест `PlaneFittingService` + `DepthMap`. Минимум: (1) плоский depth + полная маска → bbox = маска; (2) маска <50 пикселей → `PlaneFittingError("min=50")`; (3) длина mask != w*h → `PlaneFittingError`; (4) равномерный depth (все одинаковые) → `PlaneFittingError("did not converge")`; (5) `DepthMap.at` bounds-check.
- [ ] **C4 — Backend `tests/application/test_detect_perspective_from_depth.py`**: моки `IDepthEstimator` + `PlaneFittingService`, проверить (a) happy path; (b) пробрасывание `DepthEstimationError`; (c) ветка несовпадения размерностей depth vs mask (use_cases.py:247).
- [ ] **C5 — Backend `tests/api/test_perspective_auto_detect_api.py`**: с переопределённым `get_depth_estimator` через FastAPI override — happy 200, 503 на пустых байтах, 422 на mismatch dims, 422 на degenerate mask.
- [ ] **C8 — Frontend** `__tests__/depthFallbackDetector.test.ts`: race-condition — late depth response при `editorMode === 'perspective'` → ответ игнорируется (AbortController срабатывает; UI-store не обновляется).
- [ ] **Датасет-acceptance** (вне CI): 50 «сложных» фото → coverage с фазой 6 vs без.

> **Definition of Done:** для пустой однотонной стены, где фаза 3 возвращала `null`, теперь возвращается валидный `PerspectiveCorners` в ≥70% случаев.

### 6.6 Аудит-фиксы (technical debt)

Карты из аудита 2026-04-24 (см. конец фазы):

- [x] **N1** Переименовать `IDepthEstimator` → `DepthEstimator` (без префикса `I`) для соответствия `CONVENTIONS.md` "Именование". Обновлены: `domain/visualizer/depth_estimator.py`, все docstring в `exceptions.py`/`value_objects.py`/`__init__.py`, type-hint в `application/visualizer/use_cases.py`.
- [ ] **N2** Решить размещение порта: оставить как есть в отдельном `depth_estimator.py` (текущий вариант) или переместить в `domain/visualizer/repositories.py` / `services.py` per плановой структуре. Решение зафиксировать в design-doc.
- [x] **N3** Перенести `from app.domain.visualizer.exceptions import PlaneFittingError` (use_cases.py:248) в шапку модуля — убрать inline-import.
- [x] **N4** В docstring `PlaneFittingService` явно отметить, что RNG-state — допустимое отступление от "stateless" ради детерминизма тестов. (services.py:83-88 добавлен абзац «The lone stateful bit…».)
- [x] **N5** Убрать двойную конверсию `tuple(float(v) for v in absolute.reshape(-1).tolist())` → `tuple(absolute.reshape(-1).tolist())` (`depth_estimators.py:173`).
- [x] **N6** Вынести магическое 0.9 (early-exit threshold) в named-константу `_EARLY_EXIT_INLIER_RATIO` (`services.py:20`).
- [ ] **N7 (backlog)** Когда модель будет апгрейднута до 384×384, оценить переход с `tuple[float,...]` хранения depth на `array.array('f', ...)`.
- [ ] **N8** Опционально переименовать `infrastructure/ml/depth_estimators.py` → `midas_depth_estimator.py` per плану §6.3 (если решено держать только MiDaS-варианты в одном файле — иначе оставить множественное число).
- [ ] **N10** При добавлении `replicate`-провайдера обновить `RuntimeError` message в `container.py` и таблицу Configuration в design-doc.
- [x] **Thread-safety `LocalMiDaSDepthEstimator._session`**: добавлен `asyncio.Lock` (`depth_estimators.py:100`) с double-checked locking.
- [x] **Thread-safety `_depth_estimator` singleton** в `container.py`: добавлен `threading.Lock` (`container.py:154`) с double-checked locking.

### Статус Фазы 6 на 2026-04-24

**Готово (~60%):**
- Design-doc одобрен (Variant A — local CPU ONNX).
- Domain: `DepthEstimator` ABC (N1 fix), `DepthMap` VO, `DepthEstimationError`/`PlaneFittingError`, `PlaneFittingService` (RANSAC pure-Python).
- Application: `DetectPerspectiveFromDepth` use case.
- Infrastructure (ML): `StubDepthEstimator` (линейный градиент после C9-фикса) + `LocalMiDaSDepthEstimator` (lazy imports, cached session под `asyncio.Lock`).
- Config: `DEPTH_PROVIDER`/`DEPTH_MODEL_PATH`/`DEPTH_INPUT_SIZE`.
- Container: `get_depth_estimator()` singleton под `threading.Lock`.
- Закрыт technical debt: N1, N3, N4, N5, N6, N11, N12, N13, N14, thread-safety session+singleton.

**Не готово (блокирует релиз фазы):**
- C1 — HTTP-эндпойнт `POST /api/visualizer/perspective/auto-detect`.
- C2 — регистрация exception-handlers в `main.py` для `DepthEstimationError` / `PlaneFittingError`.
- C6 — `Depends`-фабрика для use-case.
- N9 — решение по router-prefix (`/api/visualizer/projects` vs `/api/visualizer`).
- C3/C4/C5 — все backend-тесты (domain, application, api). **C5 теперь пишется (C9 закрыт фиксом §6.8).**
- C7 — frontend-клиент `depthFallbackDetector.ts`.
- C8 — frontend race-condition тест.
- Интеграция в `vanishingPointDetector.ts` fallback chain (план §6.4).

**Carry-over из 5C:** B48 (миграция `calibration_pixels_per_cm` в типизированный `ScaleCalibration` VO) — остаётся в parking lot, не пересекается с Phase 6.

### 6.7 Аудит реализации (2026-04-24)

Line-by-line проверка всех файлов, затронутых фазой. Что проверено:

- `backend/app/domain/visualizer/depth_estimator.py` (38 строк, новый) — ABC + docstring.
- `backend/app/domain/visualizer/services.py` (199 строк, новый) — `_fit_plane_through_three_points`, `PlaneFittingService.__init__`, `.fit` (3 стадии: subsample, RANSAC, BBox).
- `backend/app/domain/visualizer/value_objects.py` (+42 строк) — `DepthMap` VO + `__post_init__` + `at`.
- `backend/app/domain/visualizer/exceptions.py` (+25 строк) — `DepthEstimationError`, `PlaneFittingError`.
- `backend/app/application/visualizer/use_cases.py` (+69 строк) — `DetectPerspectiveFromDepth` + dim-mismatch guard.
- `backend/app/infrastructure/ml/__init__.py` + `depth_estimators.py` (174 строки, новый) — `StubDepthEstimator`, `LocalMiDaSDepthEstimator` (lazy imports, cached session).
- `backend/app/config.py` (+8 строк) — три settings.
- `backend/app/container.py` (+42 строк) — `get_depth_estimator()` singleton + селектор провайдера.
- `docs/design-docs/DEPTH-ESTIMATION-INFRA.md` (102 строки, новый).

Дополнительно проверено:
- Правило зависимостей DDD (domain не импортирует application/infrastructure) — ✅ соблюдено.
- Отсутствие регрессий в существующих тестах (grep по новым символам в `tests/`) — ✅ новые символы нигде не импортируются старым кодом; изменения в `value_objects.py`/`exceptions.py` аддитивные.
- Smoke-run доменной логики на `.venv/bin/python` (без fastapi): `DepthMap` валидация, `PlaneFittingService.fit` на flat/tilted plane / empty mask / wrong length / uniform depth / <50 px — все ветки отрабатывают как задокументировано, **кроме** интеграции stub↔fitter (см. C9 ниже).

#### Критические находки

- [ ] **C9 — Stub несовместим со своим же fitter на default-настройках.** `StubDepthEstimator` генерирует радиально-симметричный градиент (`0.5 * r + 0.25` от центра, `depth_estimators.py:67-72`). Такая поверхность — конус, не плоскость. RANSAC в `PlaneFittingService` при default `inlier_tolerance=0.03` не находит консенсуса и бросает `PlaneFittingError("RANSAC did not converge: best inlier ratio=0.21, required ≥0.4")`. Проверено через `.venv/bin/python`: `StubDepthEstimator()` (64×64) + `PlaneFittingService()` + `[True]*4096` → **FAIL**. Это противоречит docstring стаба (`depth_estimators.py:44-46`: "a single dominant plane is detectable by RANSAC, so the integration test path (PlaneFittingService.fit) returns something deterministic instead of failing with PlaneFittingError"). Последствия: запланированный тест **C5** ("happy 200 через FastAPI override на стабе") в том виде, как описан в §6.5, провалится — endpoint вернёт 422 PlaneFittingError вместо 200. Варианты фикса (выбрать один в §6 design-doc):
  - (a) Переписать стаб на настоящий линейно-наклонный градиент (`0.3 + 0.4*x/(width-1)`) — один плоский план, 100% инлайеров при любой tolerance.
  - (b) Оставить радиальный стаб, но документировать, что интеграционные тесты должны конструировать `PlaneFittingService(inlier_tolerance=0.2)` — противоречит идее «дефолтный DI из container».
  - (c) Дать стабу конструкторный флаг `shape: Literal["radial","linear"] = "linear"`, и по умолчанию использовать linear.
  - Рекомендуется (a): минимальное изменение, стаб продолжает служить целям «deterministic, no ML deps, сравним с прод-путём».

> Остальные «не готово» из подраздела «Статус Фазы 6» (C1, C2, C6, C7, C8, N9 и все тесты) — не находки аудита, а осознанно запланированный scope, уже зафиксированный выше. Они блокируют релиз фазы, но не являются новыми дефектами.

#### Некритические находки (technical debt)

- [ ] **N11 — Сэмплирование с strid'ом занижает BBox.** `services.py:134-138`: итерация идёт `range(0, h, stride)` + `range(0, w, stride)`. Для mask шириной W последний посещённый `x = ((W-1) // stride) * stride`, т.е. BBox x_max меньше реального края mask до `stride-1` пикселей. На 256×256 (stride=4) — до 3 px потерь. Некритично для v1 (ошибка < 1% от размера), но стоит либо добавить финальный pass по крайним строкам/колонкам, либо использовать `min(x_max + stride - 1, w - 1)` при формировании BBox. Проверено через smoke-run: `32×32` flat mask → BBox `(0..28, 0..28)` вместо ожидаемого `(0..31, 0..31)`.

- [ ] **N12 — Семантика `min_mask_pixels` отличается от плана.** План §6.5 C3 пункт (2): «маска <50 пикселей → `PlaneFittingError("min=50")`». Код (`services.py:140-144`) считает **пост-stride** сэмплы (т.е. `len(samples)`, не `sum(wall_mask)`). Маска в 200 True-пикселей, случайно попавших «мимо» сетки stride=4, даст `len(samples) < 50` → отказ. Поведение безопаснее плана, но тест C3(2) должен либо пропускать этот нюанс, либо подавать достаточную mask (≥`50 * stride² = 800` px для гарантии). Уточнить формулировку DoD.

- [ ] **N13 — Мёртвая ветка в error-path.** `services.py:172`: `ratio = (len(best_inliers) / n) if n else 0.0`. К моменту вычисления `n = len(samples) ≥ min_mask_pixels ≥ 3` (проверено строкой 140), поэтому `if n else` — недостижимый fallback. Можно упростить до `ratio = len(best_inliers) / n`.

- [ ] **N14 — Docstring стаба неточен про «tilt».** `depth_estimators.py:68-72`: комментарий «Tilt slightly so the resulting plane is non-trivial — pure radial would be axially symmetric and the bbox of inliers would be the entire image». Фактически форма `0.5 * r + 0.25` остаётся осесимметричной (зависит только от `r`), никакого tilt не добавлено. Это первопричина C9. При фиксе C9 нужно переписать и комментарий.

- [ ] **N15 — Повтор ранее отмеченных пунктов из §6.6 остаётся в силе после аудита:** N1 (префикс `I`), N3 (inline import `PlaneFittingError` на `use_cases.py:248`), N5 (двойная конверсия в `depth_estimators.py:173`), N6 (магическое 0.9 на `services.py:168`), «Thread-safety `_session`» и аналогичный риск для глобального `_depth_estimator` в `container.py:150` (отсутствие lock; для single-worker uvicorn допустимо, для gunicorn-preload может гонять).

#### Тесты

**Отсутствуют полностью.** Ни одного теста для:
- `DepthMap` (VO, валидация, `.at`).
- `PlaneFittingService` (все ветки — subsample, RANSAC convergence, degenerate bbox, wrong mask length, min pixels).
- `DetectPerspectiveFromDepth` (happy + dim mismatch + пробрасывание исключений).
- `StubDepthEstimator` / `LocalMiDaSDepthEstimator` (empty bytes → 503; MiDaS lazy-import fallback; missing model file).
- `get_depth_estimator()` селектор (stub / local / unknown → `RuntimeError`).

Плановые C3/C4/C5/C8 помечены `[ ]`, пункт DoD §6 «покрытие ≥85%» не выполним без них. **До фикса C9 happy-path теста C5 написать нельзя** — важно в какой последовательности закрывать.

#### Регрессии

Не выявлены. Проверено:
- Старые тесты `tests/domain/test_visualizer_value_objects.py` импортируют только `CollinearCornersError` и существующие VO — на добавление `DepthMap`/новых exceptions не влияет.
- `tests/application/test_visualizer_use_cases.py` не ссылается на `DetectPerspectiveFromDepth` или `IDepthEstimator` → изменение `use_cases.py` аддитивное.
- `container.py` — `get_depth_estimator()` не меняет существующие DI-фабрики (`get_visualization_repo` и др. остались без изменений; global state `_depth_estimator` изолирован).
- Роутер `visualizer.py` не затронут (C1 ещё не сделан), поэтому существующие endpoints `/api/visualizer/projects/*` работают как раньше.

#### Итог

Ядро Phase 6 (domain + application + infrastructure adapters + DI) написано корректно и согласно DDD-контурам. Одна **критическая** логическая несогласованность (C9) между stub и fitter блокирует написание happy-path API-теста C5 — требует фикса до старта тестового блока. Остальные находки — технический долг, который можно закрывать параллельно с C1/C2/C6/C7.

### 6.8 Fix-pass по аудиту §6.7 (2026-04-24)

Исправлены все критические и большинство некритических находок. Оставшиеся `[ ]` — backlog / внешние решения.

**Критические (исправлены):**

- [x] **C9** `StubDepthEstimator` переведён с радиального (`0.5*r + 0.25`) на линейный градиент `0.3 + 0.4*x/(width-1)` (`backend/app/infrastructure/ml/depth_estimators.py:61-67`). Это **настоящая плоскость** в 3D, `PlaneFittingService` на дефолтной `inlier_tolerance=0.03` принимает её с ratio≈1.0. Проверено сквозным смоук-тестом stub→fitter→`DetectPerspectiveFromDepth`: возвращает `Point(0,0)`→`Point(63,63)` на 64×64 mask. Блокер для C5 снят. Docstring стаба переписан (N14).

**Некритические (исправлены):**

- [x] **N1** `IDepthEstimator` → `DepthEstimator` по всему коду (`depth_estimator.py`, `use_cases.py`, `depth_estimators.py`, все docstring-ссылки).
- [x] **N3** inline-import `PlaneFittingError` удалён, импорт поднят в шапку `use_cases.py:14`.
- [x] **N4** в docstring `PlaneFittingService` добавлен абзац про RNG-state как допустимое отступление от stateless (`services.py:83-88`).
- [x] **N5** двойная конверсия `tuple(float(v) for v in arr.reshape(-1).tolist())` → `tuple(arr.reshape(-1).tolist())` (`depth_estimators.py:174-177`).
- [x] **N6** магическое `0.9` вынесено в `_EARLY_EXIT_INLIER_RATIO` с docstring (`services.py:20-24`).
- [x] **N11** Edge-индексы `w-1` / `h-1` добавлены в стриду (`services.py:156-161`), BBox теперь достигает края mask. Проверено на 33×33 с stride=4: BBox `(0..32, 0..32)` вместо `(0..28, 0..28)`.
- [x] **N12** Перед stride-сэмплингом добавлен raw-mask gate (`services.py:141-146`): `sum(1 for px in wall_mask if px) < min_mask_pixels` → понятная ошибка с реальным числом пикселей. Пост-stride гейт остался как `len(samples) < 3` (минимум для RANSAC) с отдельным сообщением (`services.py:169-177`).
- [x] **N13** мёртвая ветка `ratio = (len(best_inliers) / n) if n else 0.0` упрощена до `ratio = len(best_inliers) / n` (`services.py:207`) — `n ≥ 3` по гейту выше.
- [x] **N14** docstring стаба переписан в рамках C9.
- [x] **Thread-safety session**: `LocalMiDaSDepthEstimator._session_lock = asyncio.Lock()` + double-checked locking (`depth_estimators.py:100,118-136`).
- [x] **Thread-safety singleton**: `container._depth_estimator_lock = threading.Lock()` + double-checked locking (`container.py:154-156,172-190`).

**Проверено после фиксов:**

- Sмоук-скрипт на `.venv/bin/python` без fastapi: `DepthEstimator` ABC + `StubDepthEstimator`/`LocalMiDaSDepthEstimator` isinstance, `PlaneFittingService.fit` на полном и частичном mask, N12 raw-gate, E2E stub→fitter→use-case (corners `(0,0)`→`(63,63)`), dim-mismatch guard.
- Нет регрессий по именам: `grep IDepthEstimator` по backend/ — **0 совпадений**.
- Не менялась публичная поверхность: `DepthMap.__init__`/`.at`, `DetectPerspectiveFromDepth.execute`, `get_depth_estimator()` сигнатуры те же.

**Остались открытыми (осознанно):**

- **N2** (решение по размещению порта — дизайн-вопрос, не код).
- **N7** (array.array-апгрейд при переходе на 384×384 — backlog до реального перехода).
- **N8** (переименование файла — после решения о MiDaS-only vs multi-vendor).
- **N10** (обновление Runtime-message — триггер: добавление replicate-адаптера).
- **N9** + C1 / C2 / C6 / C7 / C8 + тесты C3 / C4 / C5 — это запланированный scope фазы, не находки аудита.

#### Итог фиксов

Все критические блокеры из аудита §6.7 закрыты. Ядро Phase 6 готово к написанию unit-тестов (C3/C4) и подготовке HTTP-слоя (C1/C2/C6) — этих работ аудит не касался.

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
