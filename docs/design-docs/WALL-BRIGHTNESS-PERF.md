# Производительность расчёта яркости стены и ре-рендеров редактора

**Статус:** draft
**Область:** Визуализатор · `computeWallBrightness` + Zustand-селекторы
**Связанные файлы:**
- `frontend/src/domains/visualizer/lib/perspectiveEngine.ts:192` — `computeWallBrightness`
- `frontend/src/domains/visualizer/ui/PhotoEditorPage.tsx:325` — вызов из `useEffect`
- `frontend/src/domains/visualizer/ui/PhotoEditorPage.tsx:47` — `useVisualizerStore()` без селектора
- `frontend/src/domains/visualizer/lib/cvWorkerHost.ts` — singleton-очередь для тяжёлых задач

---

## 1. Контекст

После готовности сегментации (`segmentationStatus === 'ready'`) `PhotoEditorPage` запускает
эффект, который:

1. создаёт `Image`, декодирует по `photo.url`;
2. рисует его в off-DOM `<canvas>` **в нативном разрешении**;
3. зовёт `ctx.getImageData(0, 0, img.width, img.height)` — полная RGBA-копия в JS-heap;
4. передаёт ImageData + `wallMask` в `computeWallBrightness`, которая **на главном потоке**
   проходит пиксели с шагом 4 и считает среднюю яркость по маске стены;
5. пишет результат в `store.setWallBrightness(...)`.

Параллельно `PhotoEditorPage` подписан на стор вызовом `useVisualizerStore()` без селектора
(см. TODO(X2) на строке 48) — любая мутация любого поля стора (undo-stack, cost, sync-статус,
в т.ч. сам `setWallBrightness`) вызывает ре-рендер страницы с Konva-сценой, ~114 точек чтения.

## 2. Симптомы и влияние

- **Лаг при загрузке фото.** Для типичного фото 4000×3000 (DSLR/iPhone):
  - `getImageData` аллоцирует ~48 МБ `Uint8ClampedArray` на главном потоке;
  - цикл `computeWallBrightness` проходит `3000/4 × 4000/4 = 750 000` позиций маски, каждая
    с чтением пикселя и маски. На среднем Android это уверенно перешагивает 100 ms, блокируя
    UI и вызывая jank у Konva-stage.
- **Каскад ре-рендеров.** `setWallBrightness` пишет в стор → любой слушатель (вся страница)
  ре-рендерится. Komментарий в коде утверждает, что это «не user-visible, т.к. рендер
  доминируется Konva», но сам Konva-stage и есть то, что пере-маунтится/перерисовывается;
  при тяжёлой сегментации поверх этого накатываются ре-рендеры от других мутаций
  (cost recompute, sync-in-flight, onboarding tooltips), что и делает лаг заметным.
- **Невозможность отмены.** Эффект не использует `AbortController`/флаг живости: если
  пользователь сменит фото до декодирования — `img.onload` всё равно досчитает и запишет
  устаревшее значение (race).

## 3. Рассматриваемые подходы

### A. Downsample до сэмплирования (дешево, большой выигрыш)

Перед `getImageData` масштабировать фото и маску до фиксированного target-side, например
`max(width, height) = 512`. Яркость — это среднее по большой области, ошибка от bilinear-
downsample пренебрежимо мала (порядок `< 1` из 255).

- **Плюсы:** минимум кода; работает на всех браузерах; объём работы падает в `(orig/512)^2` раз
  (для 4000×3000 — ≈60×); `getImageData` больше не аллоцирует десятки МБ.
- **Минусы:** маска и фото должны быть отмасштабированы согласованно (оба через один
  коэффициент и один и тот же способ ресэмплинга — NN для маски, bilinear для фото).
- **Открытый вопрос:** 512 vs 256. На 256 яркость нестабильна у мелких стен в углу кадра;
  512 — безопасный дефолт.

### B. Перенос в Web Worker через `defaultCvWorkerHost`

В репо уже есть `cvWorkerHost` — последовательная очередь, специально сделанная для
WASM-задач (OpenCV LSD, YOLO). Яркость — легковесная задача, но концептуально она из той же
серии: «работаем с ImageData большого фото». Два варианта:

1. **OffscreenCanvas в worker.** Передаём `photo.url` (или `ImageBitmap` после `createImageBitmap`)
   в worker, там `OffscreenCanvas.getContext('2d').drawImage(...).getImageData(...)` и цикл.
   Главный поток не видит ImageData вообще.
2. **Transferable ImageData.** Декодируем на главном, но `ctx.getImageData().data.buffer`
   переносим в worker через `postMessage(..., [buffer])` — обнуляет копирование.

Подход (1) чище (всё тяжёлое off-main). Для этого `computeWallBrightness` нужно обернуть
в `TaskRunner<Input, number>` и зарегистрировать через `defaultCvWorkerHost.enqueue`.

- **Плюсы:** главный поток свободен, Konva рендерится без заеданий; после (A) задача
  становится ~1–2 ms, но даже эти мс лучше держать вне главного.
- **Минусы:** `OffscreenCanvas` — не во всех старых Safari; нужен fallback на inline-runner
  (хост уже это поддерживает — он принимает любой `(input) => Promise<output>`).
- **Комбинирует ли с A:** да, **после** (A) worker получает маленькую ImageData — это делает
  `postMessage` дешёвым (512×384×4 ≈ 800 КБ vs 48 МБ).

### C. Гранулярные селекторы стора

Заменить `const store = useVisualizerStore()` на точечные подписки:

```ts
const wallBrightness = useVisualizerStore((s) => s.wallBrightness);
const setWallBrightness = useVisualizerStore((s) => s.setWallBrightness);
// и т.д. по 114 точкам чтения
```

TODO(X2) уже зафиксирован в коде (PhotoEditorPage.tsx:48). Миграция большая, но её можно
раскатывать точечно — начиная с самых часто-меняющихся полей:
`layout.panels`, `wallBrightness`, `syncStatus`, `undoStack`, `cost`.

- **Плюсы:** экстремально уменьшает каскад ре-рендеров — меняется только нужная ветка
  дерева; хорошо сочетается с `React.memo` на `KonvaCanvas`.
- **Минусы:** 114 точек — большая механическая работа; селекторы для массивов/объектов
  требуют `shallow`-equality (иначе каждая мутация массива панелей всё равно перерендерит).
- **Альтернатива:** вытащить из `PhotoEditorPage` «хуки-вьюхи» для логических групп полей
  (`useScene()`, `useLayoutState()`, `useToolbarState()`) — проще мигрировать пачками.

## 4. Рекомендованный план

Сделать в указанном порядке, каждое — отдельным PR:

1. **A (downsample)** — самая дешёвая правка с наибольшим эффектом. Не требует worker-а,
   не требует touching стора. Риск минимальный (точность яркости не страдает).
2. **Race-fix эффекта** — `AbortController` + флаг «эффект ещё активен» вокруг
   `img.onload`/`setWallBrightness`, чтобы смена фото/unmount не писала устаревшее значение.
   Мелочь, но без неё любое ускорение не решает race.
3. **B (worker)** — после (A), когда payload маленький. Регистрируем runner в
   `defaultCvWorkerHost`, даём fallback на inline-runner для Safari без OffscreenCanvas.
4. **C (селекторы)** — отдельным треком, по одной группе полей за итерацию. Обернуть
   `KonvaCanvas` в `React.memo` с явным списком пропсов; это мгновенно убирает часть
   ре-рендеров ещё до полной миграции.

## 5. Замеры, которые надо снять до/после

- Time-to-first-brightness: от `segmentationStatus === 'ready'` до `store.wallBrightness ≠ 128`.
- Main-thread long tasks (>50 ms) во время шага (Performance API, `PerformanceObserver`).
- Количество ре-рендеров `PhotoEditorPage` за типичный сценарий «загрузил фото → выбрал дизайн
  → подвинул панель» (React DevTools Profiler или `why-did-you-render`).
- Пиковая JS heap во время декодирования (Chrome DevTools Memory).

Таргеты (для dev-ноутбука throttled к 4× slowdown):
- time-to-first-brightness: < 100 ms (сейчас ~500–1500 ms на 12 MP фото);
- main-thread long tasks: 0 штук > 50 ms в этой фазе;
- ре-рендеры `PhotoEditorPage` на «подвинул панель»: ≤ 2 (сейчас ≥ 5).

## 6. Не в скоупе

- Пересчёт `wallBrightness` при редактировании маски (сейчас эффект перезапускается при
  смене `wallMask` reference — этого достаточно; отдельная дебаунс-логика — потом).
- Per-region яркость (для локальной подсветки панелей в тенях) — отдельный документ.
- Миграция `imageProcessing.ts` / `maskUtils.ts` в worker — та же архитектурная линия, но
  отдельное решение.
