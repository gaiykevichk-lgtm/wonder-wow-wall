# Panel Warp Renderer — design doc

**Status:** approved (24.04.2026) — implemented in Phase 1B v1
**Bounded Context:** frontend / `domains/visualizer/lib/`
**Related:** [PERSPECTIVE-AUDIT.md](./PERSPECTIVE-AUDIT.md), [PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO.md](../exec-plans/active/PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO.md)

## Контекст

В Фазе 1A (commit 830ee07) мы закрыли критическую регрессию R1 — теперь дизайн виден внутри quad-области через `clipFunc`. Но это `clip` без warp: текстура внутри отрисовывается прямоугольником, а не «лежит на стене» в перспективе. Чтобы превратить визуализацию в честный preview, нужен полноценный perspective warp.

## Требования

- **Корректность.** Текстура panel должна выглядеть так, будто она лежит на плоскости стены, наблюдаемой под углом из камеры.
- **Производительность.** Сцена 50 панелей на ноуте средней мощности должна перерисовываться без видимых лагов (≥30 fps при пане/zoom; статика — без перерисовки благодаря кэшу).
- **Никаких новых зависимостей.** В Фазе 1A решено остаться на Konva + native canvas. Мы не подтягиваем PixiJS/regl/three.js на эту задачу.
- **Тестируемость.** Math-часть должна быть unit-testable без `<canvas>` (которое в jsdom не работает).

## Рассмотренные варианты

### (a) Konva native + skew/transform

`Konva.Image` поддерживает `scaleX/scaleY/skewX/skewY/rotation` — это **аффинное преобразование (6-DOF)**, не perspective (8-DOF). При перекосе квад получается параллелограммом, а не настоящей трапецией. Не подходит для крайних случаев (камера сильно сбоку).

❌ Отклонено: 6-DOF недостаточно.

### (b) Offscreen canvas + mesh-warp по триангуляции

Делим source rect (плоскую область панели) на сетку NxN ячеек (по умолчанию N=8 → 64 ячейки → 128 треугольников). Для каждого треугольника считаем **аффинный** transform из 3 пар точек (src→dst), где dst-точки получаются через готовый `transformPoint(perspectiveTransform, ...)` из `perspectiveEngine.ts`.

Каждый треугольник рисуем через `clip + setTransform + drawImage`. На канвасе получается кусочно-аффинная аппроксимация perspective warp. При N=8 разница с честным homography-сэмплингом неотличима глазом для панели 30–60 см.

✅ Выбрано:
- Никаких новых зависимостей.
- 128 операций `drawImage` per panel — ~1ms на современном GPU-canvas.
- Кэшируется по `(designUrl, quadHash, opacity, colorTint)` → пересчёт только при изменении dst-quad или яркости.
- Math-часть (компиляция треугольников + аффинная матрица из 3 точек) — чистые функции, легко тестировать.

### (c) WebGL/PixiJS sprite с projection matrix

Идеальный вариант по качеству и FPS, но требует новой зависимости (`pixi.js` ~400KB) и переписывания части canvas-pipeline. На MVP-объёме (≤50 панелей) выгода в FPS не оправдывает рост bundle и сложности. Откладывается до момента, когда (a) появятся реальные метрики тормозов или (b) понадобятся эффекты освещения/нормал-мап.

⏸ Отложено: вернуться, если профайлер покажет тормоза или появятся требования к эффектам.

## Архитектура

```
domains/visualizer/lib/
├── perspectiveEngine.ts        # уже есть — homography math (createPerspective, transformPoint, transformRect)
└── panelWarpRenderer.ts        # NEW — mesh warp + cache
```

### `panelWarpRenderer.ts` API

```ts
interface WarpOptions {
  designUrl: string;            // часть cache-key
  designImage: HTMLImageElement;// текстура (загруженная вне рендерера)
  perspective: PerspectiveTransform;
  /** Прямоугольник в wall-space (плоская стена), который надо warp-нуть в quad на фото. */
  wallRect: { x: number; y: number; width: number; height: number };
  opacity: number;              // 0..1
  /** Цветовая полупрозрачная подложка (panel.color), накладывается ПОД текстуру. */
  colorTint?: string;
  /** Размер сетки. По умолчанию 8 → 8×8 квадов → 128 треугольников. */
  gridSize?: number;
}

interface WarpResult {
  /** Готовый канвас, размером с bounding box dst-quad'а на фото. */
  canvas: HTMLCanvasElement;
  /** Положение bounding box на фото — куда ставить <KonvaImage>. */
  bbox: { x: number; y: number; width: number; height: number };
}

/** Возвращает warped canvas (с учётом cache). */
export function renderPanelToQuad(opts: WarpOptions): WarpResult;

/** Чистая функция (testable без canvas): строит список треугольников. */
export function buildMeshTriangles(
  perspective: PerspectiveTransform,
  wallRect: { x: number; y: number; width: number; height: number },
  gridSize: number,
): MeshTriangle[];

/** Чистая функция: 3 пары точек → аффинная матрица 2×3 (a b c d e f). */
export function affineFromTriangles(src: Triangle, dst: Triangle): AffineMatrix;

/** Сбросить кэш warp'ов. Вызывается при смене perspective-corners. */
export function clearWarpCache(): void;
```

### Кэш

- Module-level `Map<string, HTMLCanvasElement>` с **LRU-eviction** (max 100 записей).
- Ключ: `${designUrl}|${quadHash}|${opacity.toFixed(3)}|${colorTint || ''}`
- `quadHash` = `dst.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('_')`
- **Inversion при смене перспективы:** `clearWarpCache()` вызывается из effect'а в KonvaCanvas, когда меняется `perspectiveCorners`. Без этого кэш засрётся старыми quad'ами после reposition.

### Интеграция с `KonvaCanvas.tsx`

Текущая ветка (Phase 1A):
```tsx
if (perspectiveTransform) {
  // ... <Group clipFunc> + <KonvaImage rect> + <Line backdrop>
}
```

После Phase 1B:
```tsx
if (perspectiveTransform && designImg) {
  const { canvas, bbox } = renderPanelToQuad({
    designUrl: panel.designImage,
    designImage: designImg,
    perspective: perspectiveTransform,
    wallRect: { x: panel.x, y: panel.y, width: panel.renderWidth, height: panel.renderHeight },
    opacity: 0.85 + brightnessAdj,
    colorTint: panel.color,
  });
  return (
    <Group key={panel.id}>
      <KonvaImage image={canvas} x={bbox.x} y={bbox.y} width={bbox.width} height={bbox.height} {...panelHandlers} />
      {/* Outline + shadow по quad — оставляем как в Phase 1A для crisp-границ */}
      <Line points={flatPts} closed stroke={...} shadowColor={...} listening={false} />
    </Group>
  );
}
// Если designImg ещё не загружен — fallback на Phase 1A clip-ветку
```

## Что НЕ входит в v1

- **wallSpace в `PlacedPanel`.** Сейчас `panel.x/y` — координаты в пиксельной системе фото. В v1 мы интерпретируем их как wall-space координаты, когда `perspectiveTransform != null`. Полноценная миграция (с отдельным полем `wallSpace`) — в v2.
- **Drag в перспективе.** Сейчас `draggable` блокируется при `perspectiveCorners`. В v1 поведение не меняем. Drag-in-wall-space — v2 (требует `inverseTransformPoint` из perspectiveEngine + clamp).
- **Бейдж режима + hover quad.** UI-полировка (Phase 1B.4) — отдельный коммит.
- **Brightness через canvas filter.** Пока используем opacity, как в Phase 1A. Полноценный filter — v2 (T7).

## Trade-offs

| Что | Приобрели | Заплатили |
|-----|-----------|-----------|
| Mesh warp | Никаких новых зависимостей; testable; быстро | Кусочно-аффинно вместо bilinear, при N=8 заметно только под микроскопом |
| Module-level кэш | Нет повторных warp'ов при пане/zoom | LRU надо ручно поддерживать, легко забыть `clearWarpCache()` при смене перспективы |
| Отложили wallSpace | Меньший diff, нет миграции локального стейта | В v2 придётся всё равно вводить — двойная работа в KonvaCanvas |

## Открытые вопросы

- **OQ-W1.** Размер сетки. Дефолт N=8 — взят с потолка. Если визуально окажется грубо на сильных углах, увеличиваем до 16. Замерять на реальных фото в QA-сессии.
- **OQ-W2.** LRU eviction. Сейчас планируется FIFO «самый старый». Если выяснится, что часто-перерисовываемые панели вытесняются — переходим на полноценный LRU с touch-on-hit.
