# Design Doc: Архитектура фото-редактора стен

> **Статус:** draft
> **Дата:** 2026-03-20
> **Связанная спецификация:** [PHOTO-WALL-EDITOR.md](../product-specs/PHOTO-WALL-EDITOR.md)

---

## 1. Контекст

Текущий конструктор (`constructor` domain) работает на абстрактной сетке. Нужен движок, который позволяет загружать реальное фото стены, распознавать стену и объекты, и размещать панели с реалистичной визуализацией.

---

## 2. Решение: отдельный Bounded Context `visualizer`

### Рассмотренные варианты

| Вариант | Плюсы | Минусы |
|---------|-------|--------|
| **A. Расширить `constructor`** | Общий код (каталог панелей, расчёт цен) | Разная модель данных (сетка vs фото), нарушает SRP, раздувает домен |
| **B. Новый BC `visualizer`** ✅ | Чистое разделение, независимый жизненный цикл, свой язык | Дублирование связей с catalog/order/subscription |
| **C. Модуль в `shared`** | Доступен из любого домена | Нарушает DDD (shared = утилиты, не бизнес-логика) |

### Решение: Вариант B

`visualizer` — отдельный Bounded Context со своими entities, value objects, services. Связь с другими доменами — через типы (import type) и Anti-Corruption Layer.

---

## 3. Ключевые архитектурные решения

### 3.1 Сегментация: серверная (primary) + клиентский fallback

**Решение**: Гибридный подход.

- **Primary**: SAM 2 на Python backend (GPU), точность IoU ≥ 0.90
- **Fallback**: ONNX Runtime Web на клиенте (DeepLabV3+ MobileNet), точность IoU ~0.75
- **Логика**: клиент показывает грубый preview за 2–3 сек, сервер уточняет за 5–7 сек

**Почему**: чисто клиентское решение не даёт нужной точности для продакшена. Чисто серверное — медленно без preview. Гибрид даёт лучший UX.

### 3.2 Рендеринг: HTML5 Canvas 2D (MVP) → WebGL (Phase 2)

**Решение**: Начать с Canvas 2D, мигрировать на WebGL для перспективы.

- **MVP**: Canvas 2D — простое наложение текстур панелей на фото
- **Phase 2**: WebGL — шейдеры для перспективной трансформации и освещения

**Почему**: Canvas 2D проще и покрывает MVP. WebGL нужен только для реалистичной перспективы.

### 3.3 Хранение масок: backend (S3) + фронтенд кеш

**Решение**: Маски хранятся как PNG (1-канал, сжатие) в S3-compatible хранилище. На фронте — кешируются в IndexedDB.

- WallMask: grayscale PNG, 0 = не стена, 255 = стена
- ObjectMask: indexed PNG, каждый цвет = класс объекта

**Почему**: PNG эффективно сжимает бинарные маски. IndexedDB позволяет работать офлайн.

### 3.4 Layout Engine: клиентский (Canvas Worker)

**Решение**: Алгоритм размещения панелей выполняется на клиенте в Web Worker.

**Почему**: рендеринг и интерактивность требуют < 200 мс отклика. Серверный round-trip добавит 500+ мс. Web Worker не блокирует UI.

---

## 4. Data Flow

```
[User uploads photo]
        │
        ▼
[Frontend: EXIF correction, resize to 2048px]
        │
        ├──→ [Frontend: ONNX model → rough WallMask (2-3s)]
        │           └──→ [Show rough preview to user]
        │
        └──→ [Backend API: POST /api/visualizer/upload]
                    │
                    ▼
             [Backend: SAM 2 inference → precise WallMask + ObjectMask (5-7s)]
                    │
                    ▼
             [Store masks in S3, return mask URLs]
                    │
                    ▼
        [Frontend: replace rough mask with precise mask]
                    │
                    ▼
        [User selects design, size, color]
                    │
                    ▼
        [Frontend: Layout Engine (Web Worker) → PlacedPanel[]]
                    │
                    ▼
        [Frontend: Canvas renders panels on photo]
                    │
                    ▼
        [User adjusts / adds to cart / saves project]
```

---

## 5. Интеграция с существующими доменами

```
visualizer ──(import type)──→ catalog/model/types.ts    (PanelProduct)
visualizer ──(import type)──→ order/model/types.ts       (CartItem)
visualizer ──(call)────────→ order/model/cartStore.ts    (addItem)
visualizer ──(call)────────→ subscription/model/subscriptionStore.ts (hasSubscription, getOverlayDiscount)
visualizer ──(import)──────→ shared/config/constants.ts  (PANEL_SIZES, BASE_PANEL_PRICES)
```

### Anti-Corruption Layer

```typescript
// visualizer/model/adapters.ts
function placedPanelToCartItem(panel: PlacedPanel, product: PanelProduct): CartItem {
  return {
    id: generateId(),
    productId: product.id,
    name: product.name,
    image: product.image,
    price: panel.price,
    quantity: 1,
    area: (panel.panelSize.width * panel.panelSize.height) / 10000,
    color: panel.color.hex,
    colorName: panel.color.name,
    size: `${panel.panelSize.width}x${panel.panelSize.height}`,
  };
}
```

---

## 6. Безопасность

| Угроза | Митигация |
|--------|-----------|
| Загрузка вредоносного файла вместо фото | Валидация MIME-type + magic bytes на бэкенде, ресайз через Pillow (отсекает эксплойты) |
| DDoS через тяжёлый inference | Rate limiting: 5 фото/мин на пользователя, очередь задач (Celery/RQ) |
| XSS через EXIF-данные | Stripping EXIF при обработке (Pillow) |
| Утечка фото пользователей | TTL 24 часа в S3, шифрование at rest, доступ через signed URL |
| Произвольный path traversal | UUID-based имена файлов, whitelist расширений |

---

## 7. Tradeoffs

| Решение | Что получаем | Чем платим |
|---------|-------------|-----------|
| Отдельный BC `visualizer` | Чистота архитектуры, независимость | Небольшое дублирование интеграций с catalog/order |
| Гибридная сегментация | Быстрый preview + высокая точность | Две модели для поддержки, сложность |
| Canvas 2D на MVP | Быстрая реализация | Позже нужна миграция на WebGL |
| Web Worker для Layout Engine | Не блокирует UI | Сериализация данных между Worker и Main thread |
| SAM 2 на бэкенде | SOTA-точность сегментации | Требует GPU-сервер ($$$) |
