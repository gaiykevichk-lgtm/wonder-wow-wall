# Пошаговый конструктор панелей — Panel Creator Wizard

> **Админка Wonder Wow Wall** — новая функциональность для массового создания изображений комбинаций дизайн+текстура+цвет (ранее: вкладка «Изображения комбинаций»).

## Контекст и цель

Ранее изображения комбинаций (Design × Texture × Color) создавались по одной штуке через вкладку «Изображения комбинаций»:
1. Выбор дизайна
2. Выбор текстуры
3. Ручной клик на каждую цветовую карточку
4. Загрузка фото

**Проблема**: масштабирование невозможно — 10 дизайнов × 5 текстур × 4 цвета = 200 операций.

**Решение**: пошаговый wizard «Panel Creator», который:
- Выбирает **один дизайн** (паркль/форма)
- Выбирает **несколько текстур** (все или конкретные)
- Выбирает **несколько размеров панелей** (30×30 / 30×60 / 60×60)
- Генерирует **сетку загрузки** для всех комбинаций текстура × цвет
- Позволяет **выбрать цвет через Color Picker** для каждой панели (вместо/вместе с hex)
- Сохраняет **VariantImage** для каждой комбинации

---

## Иерархия данных

```
Design (форма/паркль)
  └── Texture (материал: бетон, дерево, мрамор...)
        └── TextureColor (цвет: серый, белый...)
              └── VariantImage (фото конкретной комбинации)
                    └── size_key (30x30, 30x60, 60x60) — ДОБАВЛЯЕТСЯ
```

> **Изменение модели**: `VariantImage` получает новое поле `size_key` (nullable), что позволяет иметь разные фото для разных размеров панели.

---

## Структура Wizard-а

### Шаг 1: Выбор дизайна (паркли)

**UI**: Grid карточек дизайнов (существующие дизайны из каталога).

**Компоненты**:
- Поиск / фильтр по категории
- Grid карточек 3-4 колонки
- Каждая карточка: изображение + название + галочка при выборе
- Обязательно выбрать ровно 1 дизайн

**Навигация**:
- Кнопка «Далее» активна только при выбранном дизайне
- Кнопка «Назад» отсутствует (первый шаг)

**Состояние**:
```typescript
interface WizardState {
  step: 1;
  selectedDesign: ApiAdminDesign | null;
  selectedTextures: string[];      // IDs текстур
  selectedSizes: PanelSizeKey[];   // ['30x30', '30x60', '60x60']
  variants: VariantEntry[];        // заполняется на шаге 4
}

interface VariantEntry {
  textureId: string;
  colorId: string;
  sizeKey: PanelSizeKey;
  imagePath: string | null;
  hex: string;                     // цвет панели (из picker или из color.hex)
  uploading: boolean;
}
```

---

### Шаг 2: Выбор текстур

**UI**: Grid чекбоксов текстур (все доступные текстуры из базы).

**По умолчанию**: все текстуры выбраны (CheckAll).

**Компоненты**:
- Заголовок с счётчиком: «Выбрано: 5 из 7»
- Checkbox «Выбрать все» / «Снять все»
- Grid текстур с swatch-превью
- Каждая текстура: swatch + название

**Навигация**:
- «Назад» → Шаг 1
- «Далее» → Шаг 3 (активна если ≥1 текстура выбрана)

**Состояние**:
```typescript
selectedTextures: string[]; // IDs выбранных текстур
```

---

### Шаг 3: Выбор размеров панелей

**UI**: Горизонтальный набор карточек размеров.

**Размеры** (из `PANEL_SIZES`):
- 30×30 см (small-square)
- 30×60 см (small-rect)
- 60×60 см (large-square)

**По умолчанию**: все размеры выбраны.

**UI-детали**:
- Карточка с иконкой размера (квадрат/прямоугольник)
- Подпись размера
- Чекбокс
- CheckAll / UncheckAll в заголовке

**Навигация**:
- «Назад» → Шаг 2
- «Далее» → Шаг 4 (активна если ≥1 размер выбран)

**Состояние**:
```typescript
selectedSizes: PanelSizeKey[];
```

---

### Шаг 4: Загрузка изображений

**UI**: Сетка панелей для загрузки.

**Генерация комбинаций**:
Для каждой выбранной текстуры:
1. Получить все цвета этой текстуры
2. Для каждого цвета × каждого размера = одна карточка

**Формула**: `count(selectedTextures) × count(colors per texture) × count(selectedSizes)`

**Компонент карточки** (`VariantCard`):

```
┌─────────────────────────────────────┐
│ [Texture Name] — [Color Name]       │
│ [Size Label]                        │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   [IMAGE PREVIEW / DROP]    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Color: [████] #FF5500  [Picker]    │
│                                     │
│  [Статус: загружено ✓ / пусто]      │
└─────────────────────────────────────┘
```

**Детали карточки**:

1. **Загрузка изображения**:
   - Drag & Drop зона
   - Клик → открыть `AdminFileUpload`
   - Поддержка множественной загрузки (batch): загрузить одно фото → применить ко всем карточкам с такой же текстурой (один дизайн, один размер, разные цвета) — **опционально**

2. **Color Picker**:
   - Показывает текущий hex (из `TextureColor.hex` или переопределённый)
   - Кнопка «Изменить цвет» → Popover с `Ant Design ColorPicker`
   - После выбора цвета: обновляется hex и превью цвета карточки
   - Сохраняется в `VariantEntry.hex`

3. **Статусы**:
   - `empty` — нет фото, нет переопределённого цвета
   - `photo_only` — загружено фото, цвет берётся из `TextureColor`
   - `complete` — загружено фото И переопределён цвет
   - `uploading` — в процессе загрузки

**Batch-загрузка** (опционально, ключевая фича):
- При клике «Загрузить» на текстуру с несколькими цветами → модальное окно
- Загрузка ОДНОГО фото → автоматически применить ко ВСЕМ цветам этой текстуры (разные размеры = отдельные фото)
- После загрузки каждому цвету можно задать свой `hex`

**Индикатор прогресса**:
- Прогресс-бар: «Загружено: 12 / 45»
- Процент: 27%

**Навигация**:
- «Назад» → Шаг 3
- «Сохранить всё» → валидация + batch-мутация

---

### Валидация перед сохранением

**Обязательные поля**:
- `image_path` — должно быть загружено фото

**Опциональные поля**:
- `hex` — если не задан, используется `TextureColor.hex`

**Ошибки**:
- Если хотя бы одна комбинация без фото → предупреждение с возможностью:
  - «Сохранить только загруженные» (частичное сохранение)
  - «Отмена и дозагрузка»

---

### Сохранение

**Backend**: 
- `POST /api/admin/variant-images/batch` (новый endpoint)
- Принимает массив `VariantImageCreate` (design_id, texture_id, color_id, size_key, image_path, hex?)
- Валидирует каждую комбинацию
- Создаёт записи (или обновляет существующие — upsert по ключу `(design_id, texture_id, color_id, size_key)`)

**Frontend**:
- `useCreateVariantImageBatch` mutation
- Progress через optimistic updates
- После успеха: редирект на вкладку «Изображения комбинаций» или toast «Сохранено N комбинаций»

---

## API Changes

### Backend

**Новый endpoint**:
```python
@router.post("/variant-images/batch", response_model=list[VariantImageResponse], status_code=201)
async def create_variant_images_batch(
    body: VariantImageBatchCreate,
    _admin_id: str = Depends(get_current_admin_id),
    ...
):
```

**Schema**:
```python
class VariantImageBatchCreate(BaseModel):
    design_id: str
    variants: list[VariantImageBatchItem]

class VariantImageBatchItem(BaseModel):
    texture_id: str
    color_id: str
    size_key: str | None = None  # nullable для обратной совместимости
    image_path: str
    hex: str | None = None        # переопределённый цвет
```

**Изменение модели** `VariantImage`:
```python
class VariantImage(BaseModel):
    # существующие поля...
    size_key: str | None = None   # nullable: 30x30, 30x60, 60x60 или null (legacy)
    hex: str | None = None         # переопределённый цвет (nullable)
```

---

## UI-компоненты

### WizardLayout
- Шаги (Steps) вверху: 1 → 2 → 3 → 4
- Текущий шаг выделен
- Пройденные шаги отмечены галочкой
- Кнопки «Назад» / «Далее» / «Сохранить» внизу

### DesignCard
- Изображение дизайна
- Название
- Состояния: default / selected (бордер + галочка)

### TextureCard
- Swatch-изображение
- Название
- Чекбокс
- Состояния: unchecked / checked / indeterminate (для будущего partial-select)

### SizeCard
- Иконка размера (aspect ratio визуально)
- Подпись «30×30 см»
- Чекбокс

### VariantCard
- Заголовок: текстура + цвет + размер
- Зона загрузки изображения (drop/click)
- Color picker
- Статус (иконка)

### ProgressBar
- Заполнено X из Y
- Процент
- Цвет: зелёный если всё загружено

---

## State Management

### Zustand Store (опционально) или React Context

```typescript
interface PanelCreatorState {
  currentStep: 1 | 2 | 3 | 4;
  design: ApiAdminDesign | null;
  selectedTextures: Set<string>;
  selectedSizes: Set<PanelSizeKey>;
  variants: Map<string, VariantEntry>; // key: `${textureId}:${colorId}:${sizeKey}`
  
  // Actions
  setDesign: (design: ApiAdminDesign) => void;
  toggleTexture: (textureId: string) => void;
  selectAllTextures: () => void;
  deselectAllTextures: () => void;
  toggleSize: (sizeKey: PanelSizeKey) => void;
  updateVariant: (key: string, patch: Partial<VariantEntry>) => void;
  setVariantImage: (key: string, imagePath: string) => void;
  setVariantColor: (key: string, hex: string) => void;
  reset: () => void;
}
```

---

## Файловая структура

```
frontend/src/domains/admin/
├── ui/
│   ├── AdminPanelCreatorPage.tsx      # главная страница wizard
│   ├── PanelCreator/
│   │   ├── WizardLayout.tsx          # обёртка с шагами и навигацией
│   │   ├── StepDesign.tsx            # Шаг 1: выбор дизайна
│   │   ├── StepTextures.tsx          # Шаг 2: выбор текстур
│   │   ├── StepSizes.tsx             # Шаг 3: выбор размеров
│   │   ├── StepUpload.tsx            # Шаг 4: загрузка
│   │   ├── DesignCard.tsx
│   │   ├── TextureCard.tsx
│   │   ├── SizeCard.tsx
│   │   ├── VariantCard.tsx
│   │   ├── ColorPickerPopover.tsx
│   │   └── index.ts
│   └── AdminTexturesPage.tsx         # существующая страница (не трогаем)
├── api/
│   └── panelCreatorAdminApi.ts       # batch endpoint bindings
└── model/
    └── panelCreatorStore.ts          # Zustand store (опционально)
```

---

## Backend файлы

```
backend/app/
├── domain/catalog/
│   └── variant_image.py             # добавить size_key, hex
├── application/catalog/
│   ├── variant_image_use_cases.py   # добавить CreateVariantImagesBatch
│   └── variant_image_dto.py         # batch DTO
└── infrastructure/api/admin/
    └── textures.py                   # добавить POST /variant-images/batch
```

---

## Migration

**Alembic**:
```python
# alembic/versions/019_add_size_key_and_hex_to_variant_images.py
op.add_column('variant_images', sa.Column('size_key', sa.String(20), nullable=True))
op.add_column('variant_images', sa.Column('hex', sa.String(7), nullable=True))
op.create_index('idx_variant_images_composite', 
    'variant_images', ['design_id', 'texture_id', 'color_id', 'size_key'])
```

---

## Приоритет реализации

### Phase 1 (MVP)
1. Backend: добавить `size_key` и `hex` в `VariantImage`
2. Backend: создать batch endpoint
3. Frontend: новый wizard с шагами 1-4
4. Frontend: базовая загрузка по одной карточке
5. Frontend: color picker на каждой карточке

### Phase 2 (Оптимизация)
1. Batch-загрузка для одной текстуры
2. Drag & drop множества файлов
3. Progress bar с детальным статусом
4. Undo / отмена изменений

---

## Вопросы к согласованию

1. **Upsert vs Create**: создавать новые записи или обновлять существующие при повторном запуске wizard для того же дизайна?
2. **Legacy size_key**: все существующие `VariantImage` имеют `size_key = null`. Какой размер показывать на сайте для старых записей?
3. **Цвет по умолчанию**: использовать `TextureColor.hex` если пользователь не задал свой, или всегда требовать выбор?
4. **Максимум комбинаций**: лимит на количество генерируемых карточек (например, 100)?
