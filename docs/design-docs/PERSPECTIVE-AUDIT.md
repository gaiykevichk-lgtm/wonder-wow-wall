# PERSPECTIVE-AUDIT — Фаза 0 плана `PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO`

> Отчёт по фактическому состоянию кода визуализатора на ветке `vadim-dev`.
> **Аудит выполнен: 24.04.2026.**
> Связанный план: [`docs/exec-plans/active/PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO.md`](../exec-plans/active/PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO.md).
> Цель аудита — закрыть открытые пункты Фазы 0 и зафиксировать корректировки плана.
> **Код в этой фазе не правился** (per Definition of Done Фазы 0).

---

## TL;DR

- **R1 подтверждён**: в перспективной ветке рендеринга нет текстуры дизайна — только заливка цветом.
- **R3 подтверждён**: drag отключён в перспективе.
- **Пункт 9 плана устарел**: backend **уже полностью** сохраняет `calibration_pixels_per_cm` и `perspective_corners` (entity, ORM, API DTO). Регрессионный риск Фазы 5 переформулирован — см. ниже.
- **Новый критичный риск C1**: таблица `visualization_projects` существует как ORM-модель, но **не создана ни одной Alembic-миграцией**. В Фазе 5 нужна не «добавить колонки», а «создать таблицу с нуля + бэкфил» (либо проверить, существует ли она в проде через `Base.metadata.create_all`).
- **T6 переоценён**: на странице одновременно работает **один** canvas (toggle `useKonva ? KonvaCanvas : WallCanvas`).
- **T8 подтверждён**: EXIF orientation **не учитывается** в `imageProcessing.createImageFromFile` — используется `new Image()` без `imageOrientation: 'from-image'`.
- **Покрытие тестами warp-ветки = 0**: 14 unit-тестов в `perspectiveEngine.test.ts` тестируют только math; рендер `<Line closed>` без текстуры не покрыт.

---

## 1. R1 — рендеринг панели в перспективе без текстуры дизайна

**Файл:** `frontend/src/domains/visualizer/ui/KonvaCanvas.tsx:554–578`

```tsx
// With perspective: render as quadrilateral via <Line closed>
if (perspectiveTransform) {
  const quad = transformRect(perspectiveTransform, { ... });
  const flatPts = quadToFlatPoints(quad);
  return (
    <Group key={panel.id}>
      <Line
        points={flatPts}
        closed
        fill={panel.color || '#CCCCCC'}      // ← только цвет, нет KonvaImage
        opacity={0.85 + brightnessAdj}
        stroke={strokeColor}
        ...
      />
    </Group>
  );
}
```

**Сравнение:** в ветке без перспективы (стр. 582–615) рендерится `<KonvaImage image={designImg} />` поверх + `<Rect fill={panel.color} opacity={0.25}>` как color tint.

**Вывод:** в перспективе панель — сплошной цветной четырёхугольник без текстуры. Это и есть R1, готовый кейс для Фазы 1A (hot-fix).

**Воспроизведение:** загрузить любое фото → войти в режим перспективы → расставить углы → добавить панель с дизайном (например, «Кирпич») → видим зелёный/серый четырёхугольник без узора.

---

## 2. R3 — drag отключён в перспективе

**Файл:** `KonvaCanvas.tsx:600, 630`

```tsx
draggable={placementMode === 'manual' && !maskTool && !perspectiveCorners}
```

Условие `!perspectiveCorners` отключает draggable, как только включена перспектива. Логика, видимо, защитная (drag в pre-warp координатах, при активной перспективе пользователь ожидает drag в quad-координатах). Решение в Фазе 1B: при drag вычислять `inverseTransformPoint(perspectiveTransform, dropPoint)` → image coords; включить draggable обратно.

---

## 3. Пункт 9 плана УСТАРЕЛ — backend уже сохраняет калибровку и перспективу

| Слой | Файл | Поля |
|---|---|---|
| Domain entity | `backend/app/domain/visualizer/entities.py:31, 33` | `calibration_pixels_per_cm: float = 5.0`, `perspective_corners: list[dict] \| None = None` |
| Pydantic DTO Create | `backend/app/infrastructure/api/visualizer.py:44, 46` | те же |
| Pydantic DTO Update | `visualizer.py:56, 58` | те же |
| Pydantic DTO Response | `visualizer.py:69, 71` | те же |
| Mapper schema → entity | `visualizer.py:90–110` | corners сериализуются как `[{"x", "y"}, ...]` |
| Mapper entity → response | `visualizer.py:113–139` | симметрично |
| ORM model | `backend/app/infrastructure/persistence/models.py:183, 185` | `calibration_pixels_per_cm: Mapped[float] = mapped_column(Float, default=5.0)`, `perspective_corners: Mapped[dict \| None] = mapped_column(JSON, nullable=True, default=None)` |

**Что хранится:** `perspective_corners` — `JSON` колонка со списком `{x, y}` точек в координатах фото. Без `wall_width_cm` / `wall_height_cm` (план это и так отмечал в пункте 8 — поля «опциональны и не используются»; **они вообще отсутствуют в entity/ORM/API**, не только в layout engine).

**Корректировка плана для Фазы 5:**
- Удалить из плана задачу «добавить поля `calibration_pixels_per_cm` и `perspective_corners` в entity/ORM/API» — уже сделано.
- Оставить задачу «добавить `wall_width_cm`, `wall_height_cm` в entity/ORM/API» — действительно отсутствуют.
- Оставить задачу «миграция» — но переформулировать (см. C1 ниже).

---

## 4. C1 — таблица `visualization_projects` НЕ в Alembic (новый риск)

**Файлы:** `backend/alembic/versions/001_initial_schema.py`, `002_add_installation_date.py`, `003_subscription_area_model.py`.

В миграции 001 создаются: `users`, `user_addresses`, `categories`, `designs`, `design_reviews`, `orders`, `order_items`, `subscriptions`, `projects` (старая legacy-модель `wall_cols/rows/wall_color`).

**Таблица `visualization_projects` отсутствует во всех трёх миграциях.**

**Возможные сценарии:**
1. Таблица создаётся в dev/test через `Base.metadata.create_all(engine)` (распространённая практика в FastAPI/SQLAlchemy для разработки).
2. На проде она либо не существует (POST `/api/visualizer/` упадёт с `relation does not exist`), либо была создана вручную / через side-script.

**Действие:** в Фазе 5 (где план планировал миграцию `add_calibration_perspective_to_visualization_projects`) теперь нужна полноценная миграция `create_visualization_projects` со ВСЕМИ колонками из ORM-модели + `add_wall_dimensions_cm` отдельным шагом для новых полей. Закрыть открытый вопрос со стейкхолдером: применялась ли таблица в проде вручную → нужен ли бэкфил данных или достаточно `CREATE TABLE IF NOT EXISTS`.

**Дополнительно**: в `/api/projects` (старый роутер `infrastructure/api/projects.py`) — legacy CRUD над `ProjectModel` (`wall_cols/rows/wall_color/panels JSON/total_price`). Не связан с visualizer и не относится к плану. Если в коде фронта он не используется — кандидат на отдельный план «удалить мёртвый код».

---

## 5. Покрытие тестами warp-ветки

**Файл:** `frontend/src/domains/visualizer/__tests__/perspectiveEngine.test.ts` — **14 it()/test()** (не 17, как предполагал план).

Покрытие:
- `createPerspective` × 3 (origin↔origin, center↔center, inverse round-trip).
- `transformPoint` / `transformRect` × 2 (corner mapping, forward+inverse round-trip).
- `quadToFlatPoints` × 1.
- `computeWallBrightness` × 4 (empty mask, white wall, black wall, etc.).
- `computeBrightnessAdjustment` × 5 (boundaries, dark, bright, range).

**Чего нет:**
- Ни одного теста, проверяющего рендер `KonvaCanvas` с/без текстуры в перспективе. R1 поэтому и не пойман.
- Нет тестов на drag в перспективе (R3).
- Нет integration-тестов «save → reload → перспектива на месте».

**Действие:** в Фазе 1A добавить snapshot/render-тест `KonvaCanvas.perspective.test.tsx` — гарантирует, что после фикса панель в перспективе содержит `KonvaImage` (mocked).

---

## 6. T6 — конкуренция canvas/WebGL — переоценена

**Файл:** `frontend/src/domains/visualizer/ui/PhotoEditorPage.tsx:521–569`

```tsx
{useKonva ? (
  <KonvaCanvas ... />     // вариант A
) : (
  <WallCanvas ... />      // вариант B (legacy)
)}
```

В каждый момент — **один** активный canvas. WallCanvas использует только `2d` контекст (`getContext('2d')`). KonvaCanvas — Konva Stage (по умолчанию 2d). `BeforeAfterSlider.tsx` — без `<canvas>` (CSS-эффект).

ML-инференс через `@huggingface/transformers` (`segmentationService.ts:79`) — отдельный backend (вероятно WebAssembly/ONNX-WASM/WebGPU), запускается **разово** при загрузке фото, не на каждый кадр.

**Корректировка плана:** T6 в плане можно опустить или сильно понизить приоритет. Реальный риск — конкуренция за CPU между segmentation-инференсом и рендером, не за WebGL-контексты.

---

## 7. T8 — EXIF orientation НЕ учитывается

**Файл:** `frontend/src/domains/visualizer/lib/imageProcessing.ts:43–50`

```ts
export function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();          // ← без imageOrientation: 'from-image'
    img.onload = () => { ... resolve(img); };
    img.src = url;
  });
}
```

Комментарий в шапке (`Handles EXIF correction, resize, format validation`) — обещает, но реализация использует `new Image()` напрямую. Браузеры по умолчанию **не вращают** изображение по EXIF orientation для `<img src>` без CSS `image-orientation: from-image` или `createImageBitmap({ imageOrientation: 'from-image' })`.

**Следствие:** фото с iPhone (где EXIF orientation = 6 для портретной съёмки) грузятся как landscape. Авто-детекция углов стены (Фаза 1B) и калибровки (Фаза 3) на таких фото будет промахиваться.

**Действие:** в Фазе 1B обязательно либо (а) перейти на `createImageBitmap(file, { imageOrientation: 'from-image' })`, либо (б) использовать библиотеку `exifr` для чтения orientation и предварительный поворот в canvas. Проверить регрессию на 5 фото с разными orientation-значениями.

---

## 8. Подтверждённые мелкие находки

| Пункт плана | Файл / строка | Статус |
|---|---|---|
| `console.log('[autoFill]')` | `layoutEngine.ts:161` | Подтверждено, остался в коде. Удалить попутно в любой фазе, трогающей этот файл. |
| Drag отключён в перспективе | `KonvaCanvas.tsx:600, 630` | Подтверждено (R3). |
| `panelSizeInPixels` уже использует `calibration.pixelsPerCm ?? 5` | `layoutEngine.ts:48` (по плану) | Не перепроверял — план фиксирует это как уже верифицированное. |
| Прямоугольная сетка в `autoFillWall` | `layoutEngine.ts:183–184` (по плану) | Не перепроверял. |
| `wallCoverageInRect` для `canPlacePanel` | `layoutEngine.ts:99` (по плану) | Не перепроверял. |
| Глобальный `panelIdCounter` | `layoutEngine.ts:24` (по плану) | Не перепроверял. |

---

## 9. Сводные корректировки плана

| Пункт плана | Корректировка |
|---|---|
| Пункт 9 «Backend не сохраняет calibration и углы» | **Удалить** — backend уже сохраняет (entity/ORM/DTO/mappers). |
| Пункт 8 «`wallWidthCm/wallHeightCm` опциональны и не используются» | Уточнить: они **полностью отсутствуют** в backend (entity/ORM/API/migration), не только в layout engine. |
| Фаза 5 / задача «миграция» | Заменить на: (а) создать миграцию `create_visualization_projects` (т.к. таблицы нет в Alembic, см. C1); (б) `add_wall_dimensions_cm` отдельной миграцией. |
| T6 (WebGL контексты) | Понизить приоритет / опустить. На странице один canvas. |
| Тест-кейс в Фазе 0 «17 unit-тестов» | Заменить на 14. Все тесты — math; warp-render не покрыт. |
| Фаза 1A | Добавить задачу: snapshot/render-тест `KonvaCanvas.perspective.test.tsx` для R1-фикса. |
| Фаза 1B | Добавить обязательную задачу: EXIF-orientation handling в `createImageFromFile` (через `createImageBitmap` или `exifr`). |
| Новый риск C1 | Добавить в Risks & Mitigations: отсутствие `visualization_projects` в Alembic (фаза затронута: 5; митигация: создать миграцию + сверить с прод-БД до релиза). |

---

## 10. Открытые вопросы (до старта Фазы 1A)

- [ ] **OQ-A1** В проде таблица `visualization_projects` существует? Если да — каким образом создавалась (script / `create_all`)? От ответа зависит, нужен ли бэкфил в C1-миграции или достаточно `CREATE TABLE IF NOT EXISTS`.
- [ ] **OQ-A2** Старый `/api/projects` (legacy `wall_cols/rows`) ещё используется фронтом? `git grep` и поиск по фронту в Фазе 0 не делался; если нет — кандидат на удаление (отдельный план).
- [ ] **OQ-A3** Какие реальные размеры iPhone/Android фото грузятся юзерами? Не было доступа к продакшен-логам; план Фазы 1B на сжатии до `MAX_DIMENSION = 2048` (`imageProcessing.ts:15`) — оставить как есть.

---

## 11. Критерий завершения Фазы 0

- [x] Воспроизведена и зафиксирована регрессия R1 (см. п. 1 + код-листинг).
- [x] Подтверждено покрытие тестами warp-ветки: 0 (см. п. 5).
- [x] Сверены поля calibration/perspective_corners во всех слоях backend (см. п. 3).
- [x] Подтверждено наличие Alembic + найдено отсутствие миграции для `visualization_projects` (см. п. 4).
- [x] EXIF orientation handling — проверен, не работает (см. п. 7).
- [x] Подсчитано число одновременных canvas-контекстов на странице (см. п. 6).
- [x] Найден `console.log('[autoFill]')` в `layoutEngine.ts:161` (см. п. 8).
- [x] Зафиксированы корректировки плана (см. п. 9).

**Готовность к Фазе 1A:** ✅ — после применения корректировок п. 9 в основной план.
