# Категория «Назначение» для карточки «Пространств»

Дата: 2026-10-02.

## Задача
Во вкладке «Изображения» админки (`/admin/catalog?tab=texture-images`) добавить
поле с выпадающим списком «Назначение» (Для дома / Для бизнеса / Социальные объекты)
и уплотнить поля ввода формы «Новая карточка для „Пространств“» в 2 ряда.
Хранение назначения — внутри существующего JSON-поля `card` в
`texture_combination_images` (без миграции БД, отдельная колонка не нужна).

## Изменения

### Backend (`backend/app/infrastructure/api/`)
- `admin/textures.py`: добавлен список `SPACE_CARD_CATEGORIES = ('home','business','social')`,
  расширен `SpaceCardFields` полем `category` (default `'home'`), нормализация
  невалидных значений при обновлении/создании карточки.
- `api/spaces.py`: добавлен публичный endpoint-карточка `SpaceCard.category`
  (`Literal['home','business','social']`), читается из `card['category']` с
  fallback на `'home'` для старых строк.

### Frontend
- `frontend/src/domains/admin/api/textureCombinationsAdminApi.ts`:
  новый тип `SpaceCardCategory`, константа `SPACE_CARD_CATEGORIES`, поле
  `category` в `ApiSpaceCardFields`.
- `frontend/src/domains/content/model/spacesApi.ts`:
  `SpaceCardItem.category` — `optional`.
- `frontend/src/domains/admin/ui/AdminTextureCombinationsTab.tsx`:
  - новое состояние `cardCategory` + `normalizeCardCategory`,
    включено во все create/update payloads (`createCard`, `saveEditor`,
    обновление строки `RowCardEditor`),
    новый `Select «Назначение карточки»` в форме создания и в модалке редактирования;
  - поля ввода карточки перекомпонованы в компактную сетку
    `grid-template-columns: repeat(3, minmax(180px, 1fr))` × 2 ряда:
    ряд 1 — Название, Детали, Назначение; ряд 2 — Цена, Площадь.

### Тесты
- `AdminTextureCombinationsTab.test.tsx` — 7/7 passed;
  новый кейс «сохраняет назначение карточки для страницы „Пространства“»:
  выбор «Для бизнеса» через Select попадает в `createCard` payload как
  `card.category = 'business'`.
- `SpacesPage` (тесты публичной страницы) — без изменений, всё зелёное.
- Backend `tests/api/test_spaces_api.py` — 5 passed, 1 skipped.

## Локальная проверка
- `tsc` — без ошибок; `eslint` по touched-файлам — 0 ошибок;
- `npm run build` — успешно, 232 файла в `frontend/dist/`;
- `AdminCatalogPage-6lX7OCLb.js` содержит маркеры
  «Назначение карточки», «Для бизнеса», «Социальные объекты».

## Публикация
Коммит `31cc171 feat(admin): space-card category select, compact 2-row card form`.

### Backend
На прод уже залиты новые файлы и контейнер перезапущен (см. ниже):
- `ssh` `scp backend/app/infrastructure/api/admin/textures.py → /tmp/textures_new.py`
- `ssh` `scp backend/app/infrastructure/api/spaces.py → /tmp/spaces_new.py`
- `cp` оба файла в `/opt/app/backend/app/infrastructure/api/...`
- `docker compose restart backend`
- `/api/health` → 200; `/api/admin/...` без токена → 401 (как и ожидалось).

### Frontend
- Бэкап прежнего dist (233 файла, 66 MB) →
  `/opt/app/deploy-backups/pre-space-card-category-full-20261002/dist`
  (дополнительно, точечный бэкап index.html / AdminCatalogPage и backend
  файлов — в `/opt/app/deploy-backups/pre-space-card-category-20261002-1056/`).
- Полный архив локальной сборки `frontend/dist/` (232 файла, 61 MB) →
  `/tmp/full-dist-new.tgz`, распакован в `/tmp/dist-new/dist` и перемещён
  поверх `/opt/app/frontend/dist`.
- В прежнем `dist` остались ссылки на старый `dist.stale-pre-space-card-category`
  как временный страховочный каталог (можно удалить после стабилизации).

### Проверка на проде
Origin `http://72.56.37.191`:
- `/` → 200 (index.html ссылается на `assets/index-DZPON8Yw.js`).
- `/assets/index-DZPON8Yw.js` → 200 (новый index-чанк).
- `/assets/index-DZSolT7b.js` (старый) → 404.
- `/assets/AdminCatalogPage-6lX7OCLb.js` → 200.
- `/assets/AdminCatalogPage-Dk8kYevW.js` (старый) → 404.
- `/admin/catalog` → 200 (SPA fallback).
- `/api/health` → 200.

Публичный домен `https://wonderwowwall.ru/`:
- `/` → 200, `/admin/catalog` → 200.

Маркеры фичи в отдаваемом чанке:
- «Назначение карточки» = 1,
- «Социальные объекты» = 1,
- «Для бизнеса» = 1.

UI фичи не проверен визуально: публичный снимок показывает экран входа,
как и в предыдущих релизах; фактический вид новых полей в авторизованной
админке требует ручной проверки в браузере.

## Откат
1. Вернуть прежний dist:
   `mv /opt/app/frontend/dist /opt/app/frontend/dist.rejected && mv /opt/app/frontend/dist.stale-pre-space-card-category /opt/app/frontend/dist`
   либо
   `rm -rf /opt/app/frontend/dist && cp -a /opt/app/deploy-backups/pre-space-card-category-full-20261002/dist /opt/app/frontend/dist`.
2. Вернуть прежний backend:
   `cp /opt/app/deploy-backups/pre-space-card-category-20261002-1056/textures.py /opt/app/backend/app/infrastructure/api/admin/textures.py`,
   `cp /opt/app/deploy-backups/pre-space-card-category-20261002-1056/spaces.py /opt/app/backend/app/infrastructure/api/spaces.py`,
   `cd /opt/app && docker compose restart backend`.
