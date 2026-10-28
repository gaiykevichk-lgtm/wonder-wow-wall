# AUTO-PERSPECTIVE — стратегия фолбэков и производительности

> **Статус:** draft · **Автор:** Vadim + Claude Code · **Дата:** 2026-04-24
> **Связанные документы:**
> - [`DEPTH-ESTIMATION-INFRA.md`](./DEPTH-ESTIMATION-INFRA.md) — backend depth pipeline
> - [`PERSPECTIVE-AUDIT.md`](./PERSPECTIVE-AUDIT.md) — аудит Фазы 0
> - [`PANEL-WARP-RENDERER.md`](./PANEL-WARP-RENDERER.md) — рендер в перспективе
> - [`PHOTO-WALL-EDITOR-ARCHITECTURE.md`](./PHOTO-WALL-EDITOR-ARCHITECTURE.md) — общая карта

---

## TL;DR

В текущем dev-окружении автоматическое определение перспективы стены **не работает ни по одному из трёх запланированных путей**: MiDaS не развёрнут, OpenCV.js 10.8 MB блокирует main-thread при загрузке (Chrome «Страница не отвечает»), YOLO reference detector не подключён. Симптом, который виден пользователю — плитки ложатся **без перспективы** поверх фотографии — корректное следствие отсутствия данных, а не баг wire-логики.

Реализован **эвристический фолбэк**: когда ML-путь не сработал, углы перспективы вычисляются как трапеция из bbox маски стены. Это даёт видимый warp плиток без ML-инфраструктуры и не мешает реальным детекторам, когда они появятся.

Настоящий фикс — deploy MiDaS на backend или перенос OpenCV в Web Worker — описан ниже как roadmap.

---

## 1. Симптом (воспроизводимо)

1. Пользователь загружает фото стены.
2. Маска стены распознаётся успешно (баннер «Стена распознана!»).
3. `runAutoPerspective` запускается, банер «Перспектива определена автоматически» появляется.
4. **Плитки лежат плоско**, без искажения перспективы.

**Повторено 3 раза** с разными правками wire-логики (B+A+C цикл, коммиты `b4f4c97`, `50c815d`, `e4c055b`). Пользовательская обратная связь:

> «Не работает, всё ещё плитки не учитывают перспективу стены»

---

## 2. Текущий pipeline `runAutoPerspective`

```
upload photo
  │
  ▼
segmentation (SAM / stub) ──► wallMask
  │
  ▼
┌─ Stage 1: POST /api/visualizer/projects/auto-perspective ────────┐
│  StubDepthEstimator | MiDaS ONNX (feature-flag)                  │
│     └─ PlaneFittingService (RANSAC)                              │
│          └─ corners in photo-px                                  │
│  ⚠ Stub возвращает depth(x,y) = 0.3 + 0.4*x/W → плоскость        │
│    фитится как full-mask bbox → identity corners (photo rect)    │
└──────────────────────────────────────────────────────────────────┘
  │   (identity detected → fall-through)
  ▼
┌─ Stage 2: OpenCV.js HoughLinesP → vanishingPointDetector ────────┐
│  ⚠ 10.8 MB Emscripten UMD. dev-server отдаёт сырой UMD → Vite    │
│    не может обернуть в ESM за 5с → OpencvNotInstalledError.      │
│    script-tag inject → тот же бандл блокирует main-thread на     │
│    15+с при парсинге asm.js/WASM → «Страница не отвечает».       │
└──────────────────────────────────────────────────────────────────┘
  │   (неудача или null-result)
  ▼
┌─ Heuristic: trapezoidFromMaskBbox(wallMask) (NEW, this doc) ─────┐
│  bbox маски → TL/TR сужены на 8% внутрь, BR/BL по углам bbox.    │
│  Не претендует на точность; даёт видимую перспективу.            │
│  perspectiveAutoDetected: false — UI должен подсказать правку.   │
└──────────────────────────────────────────────────────────────────┘
  │
  ▼
commit → perspectiveCorners + calibration (seeded из bbox width / 300cm)
```

---

## 3. Root-cause — почему каждая стадия не работает в текущем окружении

| Stage | Компонент | Причина отказа | Где чинить |
|-------|-----------|----------------|------------|
| 1 | `StubDepthEstimator` | Линейный X-градиент → плоскость фитится по всему bbox → identity corners | `backend/app/infrastructure/ml/depth_estimators.py` + `config.DEPTH_PROVIDER` |
| 1 | `MidasDepthEstimator` | Не развёрнут: нет ONNX-файла, нет pip-пакета `onnxruntime`, `DEPTH_PROVIDER="stub"` | Infra: deploy step |
| 2 | `opencvLsdAdapter` | 10.8 MB UMD → dynamic import через Vite timeout-ит; script-tag блокирует main-thread | `opencvLsdAdapter.ts`, `vite.config.ts`, Web Worker |
| (доп) | `referenceDetector` (YOLO) | `OnnxNotInstalledError` — не wired | `referenceDetector.ts` |

Важно: **wire-логика между стадиями корректна** — identity-rejection, bbox-derived calibration, auto-rerun autoFill. Эти фиксы нужны, но симптом они не закрывают, пока нет источника реальных corners.

---

## 4. Рассмотренные подходы

### 4.1. Mask downsampling перед эвристикой

**Проблема:** `maskBbox` итерирует `width * height` пикселей. На фото 3000×2000 = 6M итераций на каждый вызов `runAutoPerspective`.

**Решение:** downsample mask до 256×256 перед iteration (nearest-neighbour, без аллокаций `Uint8Array.subarray` на каждую строку — один fused loop с шагом).

**Эффект:**
- 6M итераций → ~65k (×90 ускорение)
- Potentially: можно вычислять bbox прямо во время сегментации (one-pass со стороной mask pipeline).

**Риск:** низкий. Downsample искажает bbox на ≤ `originalSize / 256` пикселей → в абсолютных координатах на фото это 8–12px, что уже в пределах `topInsetPct = 8%` трапеции.

**Stage:** оптимизация фолбэка, не критична пока bbox считается один раз за upload.

### 4.2. Перенос OpenCV в Web Worker

**Проблема:** `opencv.js` 10.8 MB выполняется на main-thread, блокирует UI 15+с.

**Решение:**
1. Создать `public/workers/opencv-worker.js` — классический Web Worker (не module-worker, т.к. opencv.js — UMD).
2. В воркере `importScripts('/opencv.js')` — ждёт `onRuntimeInitialized`, экспортирует сообщения:
   - `{ type: 'hough', imageData, params }` → `{ type: 'hough-result', lines }`
3. В `opencvLsdAdapter.ts` заменить dynamic import на постановку задачи в worker через существующий `CvWorkerHost` (сейчас in-process queue — заменим на реальный Worker-backed host).
4. `ImageData.data` (UIntClampedArray) передаётся через `transferable` — zero-copy.

**Эффект:**
- Main-thread не блокируется → нет «Страница не отвечает».
- Cold-start воркера (500–800ms) остаётся, но под спиннером, не под UI-фризом.
- Память: WASM-heap OpenCV (~80 MB) живёт в воркере. На mobile Android может всё ещё быть проблемой — см. `CvWorkerHost` sequential-queue комментарий.

**Риск:** средний. Worker-path нужно тестировать в jsdom (моки), отдельный deployment асседа, CORS-headers для crossOriginIsolated (если нужен `SharedArrayBuffer`, но для HoughLinesP не нужен).

**Оценка работы:** 1–2 дня (рефактор адаптера + тест + public-asset pipeline).

### 4.3. Deploy MiDaS на backend

**Проблема:** `StubDepthEstimator` возвращает линейный градиент → identity corners всегда.

**Решение:**
1. Скачать `midas_small.onnx` (~80 MB) в `backend/ml_models/` (или S3 + lazy download).
2. Реализовать `MidasDepthEstimator` (интерфейс `DepthEstimator` уже есть).
3. `pip install onnxruntime` (CPU) или `onnxruntime-gpu` (если доступен GPU).
4. `DEPTH_PROVIDER=midas` в prod env, `stub` в dev/CI.
5. Resource-cap: одновременно одно inference (GIL-like semaphore в `get_depth_estimator`).

**Эффект:**
- Реальная перспектива из одного backend-запроса.
- Frontend не грузит 10 MB opencv.
- MiDaS-small работает ~300ms на photo 640px CPU.

**Риск:** средний. Зависимость 80 MB ONNX + 200 MB onnxruntime на backend-image. RAM-budget sandbox 512 MB — впритык, но работоспособно.

**Оценка работы:** 0.5–1 день (detector реализован, есть тесты плана).

### 4.4. Гранулярные селекторы Zustand-стора

**Проблема (потенциальная):** `KonvaCanvas` и перспективный редактор подписаны на корень стора — любой `set()` в `runAutoPerspective` триггерит re-render всего canvas. Когда мы делаем 3 `set()` подряд (seed corners → autofill → cost recalc) — 3 полных перерисовки Konva layer, которая включает raster панелей.

**Решение:** заменить `const state = useVisualizerStore()` на selector-подписку:
```ts
const perspectiveCorners = useVisualizerStore((s) => s.perspectiveCorners);
const panels = useVisualizerStore((s) => s.layout.panels);
// вместо
const { perspectiveCorners, panels } = useVisualizerStore();
```

С ноткой `shallow` для объектов.

**Эффект:** для автоматического pipeline незаметно; для ручного dragging перспективы (60 fps rAF) может убрать jank.

**Риск:** низкий, но это большой рефактор, не связанный с симптомом. Отложить до выделенной phase.

### 4.5. Heuristic trapezoidFromMaskBbox (SHIPPED)

Уже реализовано в этом коммите (см. `maskUtils.ts:trapezoidFromMaskBbox`, `visualizerStore.ts:runAutoPerspective` commit-block).

**Поведение:**
- Если `resolvedCorners === null` после всех ML-путей — берём bbox маски, сужаем TL/TR на 8% внутрь.
- Флаг `perspectiveAutoDetected: false` — UI не врёт «определено автоматически».
- Bbox для calibration seed берётся из trapezoid (ширина = нижнее ребро = bbox-width).

**Преимущества:**
- Всегда даёт пользователю видимый warp плиток.
- Не мешает реальным детекторам (они populate `resolvedCorners` до этой точки).
- Zero new deps, zero infra-changes.

**Ограничения:**
- Это **не** детекция — это дефолт. Для стены, снятой под сильным углом или сбоку, трапеция 8%-inset-top будет визуально неправильной.
- Требуется explicit user refinement через corner-editor.

---

## 5. Рекомендация и roadmap

### P0 — сделано в этом ветке
- [x] Identity-like corners detection + fall-through (коммит `50c815d`).
- [x] Bbox-derived calibration seeding (коммит `b4f4c97`).
- [x] Inline `/auto-perspective` без auth (коммит `e4c055b`).
- [x] Heuristic trapezoid fallback (этот документ).

### P1 — следующий шаг (выбрать ОДИН)

**Вариант A: Deploy MiDaS** (рекомендовано для prod)
- Реальная перспектива из depth, без client-side load 11 MB.
- Работает в browser-agnostic манере.
- Roadmap: 0.5–1 день, см. [DEPTH-ESTIMATION-INFRA.md](./DEPTH-ESTIMATION-INFRA.md).

**Вариант B: OpenCV Worker** (если нельзя трогать backend)
- Client-only, не требует infra.
- Mobile-RAM риск, главное — не блокировать main-thread.
- Roadmap: 1–2 дня.

### P2 — optимизации (после P1)
- Downsample mask в `maskBbox` (если профайлер покажет узкое место).
- Гранулярные Zustand-селекторы в `KonvaCanvas` / `PerspectiveEditor`.
- Batching `set()` в `runAutoPerspective` commit-block (один `set`, не 3).

### P3 — UX-улучшения
- Явный toast «Авто-детектор недоступен, углы определены приблизительно — проверьте в редакторе» при `cornersAreHeuristic === true`.
- Onboarding-подсказка на первом использовании: «Двигайте 4 угла, чтобы выровнять по стене».

---

## 6. Критерии приёмки feature

Фича «Плитки по перспективе стены» считается **корректно работающей**, когда:

1. **Для >80% типовых фото стен** (фронтальный/slight-angle interior) плитки ложатся с перспективой, совпадающей с геометрией стены ±10px по углам, **без ручной правки**.
2. На фото, где auto-detection не сработал, пользователь видит **явный CTA** открыть редактор + starting shape (трапеция), а не flat rectangle.
3. При ручном правке угла в редакторе плитки пересчитываются за ≤100ms (60fps during drag).
4. Ни один код-пасс не блокирует main-thread > 200ms (включая load ML-ассетов).

Текущий статус по критериям:
- (1) **не выполнено** — нужен P1.
- (2) **выполнено** этим коммитом.
- (3) выполнено существующим `perspectiveEngine`.
- (4) **не выполнено** для OpenCV-пути; выполнено для backend-пути.

---

## 7. Открытые вопросы

- **Q1:** MiDaS-small достаточно качественный для типичных interior walls, или нужен MiDaS-large (400 MB)? → provisional answer: small — pragmatic start, измерим на 20 реальных фото.
- **Q2:** Web Worker + opencv.js ест те же 80 MB WASM-heap — выдержит ли mobile Safari на iPhone SE? → требует device-tier testing.
- **Q3:** Нужен ли prefetch opencv.js (link rel=prefetch) при входе на `/visualizer` до момента upload? → exit-criterion для варианта B.

---

## 8. Changelog этого документа

- 2026-04-24 — первая версия после 3 безуспешных итераций wire-фиксов. Зафиксирован heuristic-fallback как P0-shippable, MiDaS/Worker — P1.
