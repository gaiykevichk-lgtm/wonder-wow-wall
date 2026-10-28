# «Пространства» → фото из админской вкладки «Изображения» (2026-10-01)

## Задача

Публичная страница `/spaces` должна брать фотографии из админской вкладки
**Каталог → Изображения** (`/admin/catalog?tab=texture-images`,
`AdminTextureCombinationsTab`, таблица `texture_combination_images`), а не из
собственных картинок интерьера. Плюс привести страницу к стилю проекта:
кнопки не синие, карточки в рамке.

## Источник данных

- Новая публичная ручка: `GET /api/spaces/texture-images`
  (`backend/app/infrastructure/api/spaces.py`, `public_router`, только чтение).
- Ответ: `[{id, textureId1, textureId2, image}]`.
  - моно-запись: `textureId1 === textureId2`;
  - комбинация: пара разных `textureId`.
- Семейства фактур берутся из публичного `GET /api/textures` по названию:
  `Дерево → wood`, `Природный камень → stone`, `Кожа → leather`,
  `Металл → metal`, `Текстиль → textile` (`SPACES_TEXTURES`).

## Правила сопоставления (`frontend/src/domains/content/model/spaceTextureImages.ts`)

- **Моно-интерьер**: фото моно-записи, у которой семейство текстуры равно
  `interior.texture`.
- **Комбинированный интерьер**: фото пары, оба семейства которой входят в
  семейства фактур сцены (`interior.textures[].family`).
- **Нет совпадения** → показывается собственное изображение интерьера.
  Выдуманных подстановок нет.
- Пути прогоняются через `imageSrc`, поэтому storage-relative админские пути
  (`MISC/xxx.jpg`) открываются как `/uploads/MISC/xxx.jpg`.

Приоритет фото в модалке «Переодеть фактуры»: админское фото →
`interior.renders` → собственное изображение сцены.

## Стиль (`SpacesPage.css`)

- Карточка: `border:1px solid #e5e5e7`, `border-radius:20px`, белый фон,
  фото сверху без внутренних отступов.
- Синие акценты `#0071e3/#0077ed/#f0f7ff` заменены на палитру проекта:
  `#2d2d2d` (CTA), hover `#1a1a1a`, границы `#e5e7eb`, галочка выбранной
  фактуры `#4caf50`.

## Проверки

- Backend: `tests/api/test_spaces_api.py` — 4 passed.
- Frontend: `src/domains/content` — 88 passed (включая 3 новых сценария в
  `SpacesPage.textureImages.test.tsx`: фото карточки, фото в модалке,
  рамка/не-синие кнопки).
- ESLint затронутых файлов — без ошибок (`BlogPage.tsx` — предсуществующая
  ошибка, не трогали).
- Реальный прод-данные: 8 записей; 10 из 14 сцен получают админ-фото,
  4 комбинированные остаются со своим изображением (нет подходящей пары).

## Прод

- Backend: `spaces.py` скопирован в `/opt/app/backend/...`, контейнер
  `app-backend-1` перезапущен; `GET /api/spaces/texture-images` → 200, 8 строк.
- Frontend: сборка `index-DXnucnK2.js` + `SpacesPage-DurmldmH.js`.
- Бэкап: `/opt/app/deploy-backups/spaces-texture-images-20261001/`
  (`index.html`, `index-BLyWAriI.js`, `spaces.py.bak`).

### Откат

1. Frontend: вернуть `index.html` и `index-BLyWAriI.js` из бэкапа в
   `/opt/app/frontend/dist/`.
2. Backend: вернуть `spaces.py.bak` в `/opt/app/backend/app/infrastructure/api/spaces.py`
   и `docker restart app-backend-1`.

## Ограничение проверки

Фото внутри карточки не видно в серверном скриншоте: карточки ниже первого
экрана, а изображения ленивые (`loading="lazy"`). Проверены публичный
endpoint, правила сопоставления на реальных данных и компонентные сценарии;
визуально на проде подтверждены рамка карточек и тёмные (не синие) фильтры.

## Выкат на прод — 2026-10-01 ~22:04 UTC

Бэкап: `/opt/app/deploy-backups/spaces-cards-20261001T215523Z/` (spaces.py, textures.py, models.py, index.html, frontend-dist-prev/, оба tgz сборки).

Что выложено:
- backend: `spaces.py` (SpaceCard, `GET /api/spaces/cards`, `GET /api/spaces/texture-images`), `textures.py` (SpaceCardFields в create/update/response), `models.py` (`TextureCombinationImageModel.card JSON`), миграция `036_texture_combination_card.py` применена — `alembic current` = `036 (head)`.
- frontend: `index-DwmwAjjr.js`, `SpacesPage-Cc8eGipL.js`, `AdminCatalogPage-xrboB5Dd.js`; чанки `SpacesPage-*` и `AdminCatalogPage-*` отдаются nginx с 200; `SpacesPage-DbEXpKwd.css` сохранён.
- фикс сопоставления фото: `buildTextureFamilyIndex` теперь понимает варианты каталога («Орех американский» → wood и т.п.), иначе карточки показывали серые плейсхолдеры.

Проверено на проде:
- `GET /api/spaces/cards` → 200 `[]` (оформленных карточек пока нет — корректный fallback).
- `GET /api/spaces` → 200, 14 сцен.
- `/spaces` → 200; скриншот: карточки с фото, битых картинок нет.
- CRUD-путь: добавление/редактирование/удаление строки во вкладке «Изображения» `/admin/catalog?tab=texture-images`; строка с названием публикуется в `/api/spaces/cards`, без названия скрыта, удалённая исчезает.
- тесты: backend `test_spaces_api.py` 5 passed; frontend 28 passed (SpacesPage.test, visual, textureImages, AdminTextureCombinationsTab, spaceTextureImages); ESLint чист; `vite build` ok.

Откат:
1. `cp /opt/app/deploy-backups/spaces-cards-20261001T215523Z/{spaces.py,textures.py,models.py} …` в соответствующие пути `/opt/app/backend/…`, удалить `/opt/app/backend/alembic/versions/036_texture_combination_card.py`.
2. `docker exec app-backend-1 alembic downgrade -1` (036 → 035), `docker restart app-backend-1`.
3. `rm -rf /opt/app/frontend/dist.new-rb; mkdir /opt/app/frontend/dist.new-rb; cp -a /opt/app/deploy-backups/spaces-cards-20261001T215523Z/frontend-dist-prev/. /opt/app/frontend/dist.new-rb/; mv /opt/app/frontend/dist /opt/app/frontend/dist.old-rb; mv /opt/app/frontend/dist.new-rb /opt/app/frontend/dist; rm -rf /opt/app/frontend/dist.old-rb`.
4. Проверить: `alembic current` → `035`, `/api/spaces/cards` → 404, `/spaces` → 200 со старым `index-DXnucnK2.js`.

## Инцидент и фикс — 2026-10-01 ~22:35 UTC

**Симптом:** «пропали базовые панели, текстуры и всё остальное» — каталог `/catalog` показывал «Ничего не найдено», фильтры размеров пустые.

**Причина:** при выкате карточек «Пространств» я перезаписал прод-файл `models.py` локальной версией, а локальная версия была **старше прода**: в ней отсутствовали 5 колонок панелей, добавленных миграцией `035_panel_specs.py` (`thickness_mm`, `execution`, `mounting_system`, `base_material`, `packaging`). В БД колонки есть, в ORM — нет → `AttributeError: 'PanelModel' object has no attribute 'thickness_mm'` → `GET /api/panels` и `GET /api/panel-variants` отдавали 500 → каталог пустой.

**Фикс:** вернул 5 колонок в `backend/app/infrastructure/persistence/models.py` (локально + на проде), перезапустил `app-backend-1`. Данные в БД не пострадали.

**Проверено после фикса:**
- `GET /api/panels?limit=100` → 200 (4 панели: Рейка, АРКА, ПИРАМИДА, КОЛОННА; фото и толщина на месте)
- `GET /api/panel-variants` → 200 (84 варианта, все активные)
- `GET /api/textures` → 200 (8 текстур)
- `GET /api/spaces`, `/api/spaces/cards` → 200
- nginx-лог: браузер при загрузке `/catalog` получает 200 на `/assets/*`, `/api/panels?limit=100`, `/api/panel-variants` и 5 фото `/uploads/PANEL_PHOTO/*.png`; 5xx за период нет
- также видно запросы пользователя с `https://wonderwowwall.ru/catalog` → 200

**Важно на будущее (риск регрессии):** локальный git-репозиторий отстаёт от прода. Прод-версии содержат правки, которых нет в локалке: `container.py`, `domain/catalog/panel.py`, `domain/media/value_objects.py`, `api/admin/panel_variants.py`, `api/catalog.py`, `api/orders.py`, `persistence/database.py`, `repositories/memory.py`, `repositories/sql.py`. Перед любым следующим выкатом этих файлов нужно сначала синхронизировать прод → локалка, иначе снова потеряются фичи.

## Доработка таблицы «Изображения» — 2026-10-01 ~22:47 UTC

Требование: все данные карточки редактируются прямо в таблице, фото видны в таблице; каждая строка = одна карточка «Пространств».

Что изменено (только frontend `AdminTextureCombinationsTab.tsx` + его тест, backend не трогали):
- Новая колонка «Фотография»: миниатюра 96px с предпросмотром «Увеличить» — фото строки видно прямо в таблице.
- Колонка «Карточка страницы» теперь не текст-строка, а 4 инпута в каждой строке: Название / Детали / Цена / Площадь. При изменении любого появляется кнопка «Сохранить тексты», которая PATCH-ит только карточку той же строки (текстуры и фото не трогает). Каждая строка — отдельная карточка `/spaces`.
- Модалка-карандаш оставлена для смены текстуры и замены фото.

Проверено: тест вкладки 5 passed (правка в строке → `updateMutate` с `card`, модалка сохранена), SpacesPage-набор 27 passed, ESLint чист, `vite build` ok.

Выкат: только `frontend/dist` → `index-BB-aTxY1.js`, `AdminCatalogPage-N4aeSQy_.js` (в бандле есть «Сохранить тексты» и «Фотография», nginx отдаёт чанк с 200). Сборка сохранена в бэкапе `/opt/app/deploy-backups/spaces-cards-20261001T215523Z/frontend-dist-combo-table.tgz`. Backend и БД не менялись — откат: вернуть предыдущий `dist` из `frontend-dist-prev/`.

## Фикс вида таблицы «Изображения» — 2026-10-02 ~07:00 UTC

Жалобы: (1) в колонке «Карточка страницы» только статичный текст, полей не видно; (2) сверху над таблицей «непонятная надпись» «Название: Современная гостиная / Детали: … / Цена: … / Площадь: …» — убрать.

Причина: код построчных редакторов (RowCardEditor) и фото-колонки уже был выложен на прод (чанк содержит «Сохранить тексты», «Название карточки», «Фотография»), но поля выглядели как «непонятная надпись», потому что:
- все инпуты были голыми `<input>` без рамок;
- тексты-подсказки были в виде «Название: <пример>» в плейсхолдерах — точь-в-точь как жалоба.

Что изменено (только frontend `AdminTextureCombinationsTab.tsx`):
- Построчный редактор и редактор модалки переведены на `Input` из Ant Design с подписями «Название / Детали / Цена / Площадь» и плейсхолдерами «Например: …».
- Поля создания новой карточки упакованы в рамку «Новая карточка для „Пространств“» с пояснением, что строка станет карточкой на странице.

Проверено: тест вкладки 5 passed, ESLint чист, `vite build` ok.

Выкат: только `frontend/dist` → `index-BomIMLN5.js`, `AdminCatalogPage-BCamxj-g.js` (маркер «Новая карточка» в чанке, nginx 200). Сборка в бэкапе `frontend-dist-combo-table3.tgz`. Backend/БД не менялись.

Важно: `/api/spaces/cards` сейчас отдаёт `[]` — у всех 8 строк поле `card` пустое (`{}`). Пока в админке не заполнят тексты хотя бы одной строки, на `/spaces` показывается старый каталог интерьеров. После заполнения названия строка публикуется как карточка.

## Привязка к базовым панелям (вариант А, 2026-10-02)

Карточка вкладки `?tab=texture-images` теперь привязана и к текстурам, и к базовым панелям:
- Моно: одна текстура + одно семейство базовой формы.
- Комбо: две текстуры + два семейства базовых форм (пара неупорядоченная, хранится отсортированной).
- Размер не участвует: хранится только семейство формы — slug панели без суффикса размера (`arka` вместо `arka-300x300`).
- Уникальность карточки = пара текстур + пара семейств: та же пара текстур с другой панелью — отдельная карточка со своей галереей.

### Backend
- Миграция `038_texture_combination_panels.py`: колонки `panel_family_1/2` (NOT NULL, default `""`), check `panel_family_1 <= panel_family_2`.
- Старые строки получают пустые значения и продолжают работать: привязки нет, публикация и галерея без изменений.
- `create/update` нормализуют пару (`_normalize_panel_families`) и проверяют семейства по активным панелям (`_validate_panel_families`, 404 «Одна из базовых панелей не найдена»).
- `GET /api/admin/texture-combination-images` и `GET /api/spaces/cards` отдают `panelFamily1/2`.

### Frontend
- `AdminTextureCombinationsTab`: селекторы «Базовая панель» / «Первая/Вторая базовая панель» (семейства из `/admin/panels`), обязательны при создании карточки; в редакторе подставляются из строки и могут быть пустыми у старых карточек.
- Колонки «Панель» / «Панель 1/2» в таблице; у строк без привязки — «—».
- Страница «Пространства» не менялась: панели пока только хранятся и отдаются в API, отображение прежнее.

### Публикация и исправление отсутствующего селектора
2026-10-02: подтверждено, что production оставался на миграции 037 и frontend без полей панелей. Применена 038, точечно обновлены textures.py, spaces.py, models.py. Все текущие assets добавлены без удаления старых; entry index-9L50NUKE.js, существующий index.html сохранён кроме имени entry. Бэкап /var/uploads/backup-panel-binding-20261002-2124. Селекторы панелей помещены в один ряд с текстурами. В личном браузере на production проверены открытие списка форм, выбор в моно и наличие двух полей в комбо; screenshot проверен визуально. Пользовательские карточки при проверке не сохранялись и не изменялись. Тесты: frontend 7, backend 16. Полный сценарий сохранения новой карточки в production не выполнялся.

### Автоматические единицы цены и площади
2026-10-02: новая карточка, inline-редактор и модальное редактирование дописывают ₽/м² при потере фокуса; payload при сохранении тоже нормализуется. Пустые значения остаются пустыми, существующие единицы не дублируются, м2/м^2 нормализуются в м². Backend и существующие данные не менялись. Frontend опубликован с entry index-BSViv-iW.js, бэкап index.before-units.html. 8/8 frontend-тестов и Vite build успешны. На production в собственной авторизованной вкладке проверен ввод 196 460 → 196 460 ₽ и 8,4 → 8,4 м²; screenshot подтверждает отображение. Тестовую карточку не сохраняли.
