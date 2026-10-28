# ADMIN-PANELS-EMPTY-2XX-RETRY — 2026-10-06

## Проблема
В «Пространствах» / вкладке **«Текстуры — изображения»** админ-каталога
(`/admin/catalog?tab=texture-images`) выпадающий список **«Базовая панель»**
показывал `No data`, хотя в базе есть 4 активные формы (РЕЙКА, АРКА, ПИР��МИДА,
КОЛОННА).

## Корневая причина
Один запрос `GET /api/admin/panels?offset=0&limit=500&is_active=true` от
браузера попал в р��дкий, но реальный случай **HTTP 200 с пустым телом** —
backend отдал `200 OK` (uvicorn), но nginx зафиксировал `200 0` в access-логе.
Соседний запрос `texture-combination-images` на той же странице попал в ту же
аномалию, но **смог восстан��виться сам** (React Query по умолчанию делает
3 повтора). Спи��ок панелей использовал `retry: false` и после первого же
пустого ответа навсегда остава��ся в состоянии `error → пустые опции`.

Подтверждение в nginx access-логе (одна и та же админ-сессия 19:41):

```
19:41:06 GET /api/admin/panels?offset=0&limit=500&is_active=true HTTP/2.0 200 0
19:41:12 GET /api/admin/texture-combination-images                HTTP/2.0 200 0
19:41:19 GET /api/admin/texture-combination-images                HTTP/2.0 200 1558   ← авто-ретрай восстановил
```

Backend при этом отвечал `200 OK` (uvicorn log), то есть проблема
транспортная (HTTP/2 ↔ nginx ↔ uvicorn), а не в данных.

60/60 повторных запросов через nginx возвращают 3097 байт — данные и API
в порядке.

## Исправление
1. `frontend/src/shared/api/client.ts` — общий api-клиент. Теперь 2xx-ответ
   с пустым или невалидным телом бросает `ApiError(502, …)` вместо
   `SyntaxError: Unexpected end of JSON input`. Это даёт React Query
   однозначный ретриабельный сигнал и понятное сообщение в UI.
2. Тот же файл экспортирует `shouldRetryQuery(failureCount, error)` —
   ретраит transient-сбои (5xx, сеть, JSON-ошибки), не ретраит 4xx.
3. `frontend/src/domains/admin/api/panelsAdminApi.ts` — `usePanelsAdminList`
   и `usePanelDetail` используют `retry: shouldRetryQuery` вместо `retry: false`.

## Тесты
- `frontend/src/shared/api/__tests__/client.test.ts` — 3 новых кейса:
  пустое 2xx тело → ApiError(502), невалидный JSON → ApiError(502),
  политика `shouldRetryQuery` (ретраит 5xx/сеть, не ретраит 4xx,
  останавливается после 2 попыток).
- Прогон `vitest run` ��ля client + admin tabs:
  - client: 15/15 passed
  - admin: 80/80 passed (AdminTextureCombinationsTab, AdminPanelsPage,
    AdminUploadPage)

## Деплой (патч прод-чанков)
- Backup: `/var/uploads/backup-panels-retry-20261006/`
  - `index-configurator-admin-20261005.js.bak`
  - `AdminUploadPage-BhjrOYIk-tech-...-singleentry.js.bak`
- `index-configurator-admin-20261005.js` (главный entry):
  Jq (request) и upload теперь читают тело через `await res.text()` и бросают
  `ApiError(502, "Empty response body" / "Invalid response body")` для пустого
  или невалидного JSON. Размер 1 057 381 → 1 057 645 (+264 байта). Пр��верено
  acorn-парсером: `LIVE2_OK`.
- `AdminUploadPage-...-singleentry.js`: хук `E` (panels list) — `retry:!1` →
  `retry:2`. Размер 20 322 → 20 321. Проверено: `UP_OK`.

## Верификация на проде
- API:
  - `GET /api/panels` → 4 элемента (РЕЙКА, АРКА, ПИРАМИДА, КОЛОННА).
  - `GET /api/admin/panels?offset=0&limit=500&is_active=true` (с
    свежевыпущенным admin JWT) → total=4, те же 4 им��ни.
- Активные чанки отдаются CDN с правками:
  - `index-configurator-admin-20261005.js` — содержит
    `Empty response body` / `Invalid response body` (две вставки: Jq + upload).
  - `AdminUploadPage-...-singleentry.js` — `function E(…){…retry:2})}`.
- Главная (`/`) загружается, все ассеты 200, ошибок в nginx-логе нет
  (HeadlessChrome 144, IP 89.169.153.17).
- Визуальная проверка выпадающего списка в админке `/admin/catalog?tab=texture-images`
  требует активной admin-сессии — это нужно подтве��дить в браузере.

## Файлы изменены
- `frontend/src/shared/api/client.ts` — empty/invalid body → ApiError(502),
  экспорт `shouldRetryQuery`.
- `frontend/src/shared/api/index.ts` — реэкспорт `shouldRetryQuery`.
- `frontend/src/domains/admin/api/panelsAdminApi.ts` — `retry: shouldRetryQuery`.
- `frontend/src/shared/api/__tests__/client.test.ts` — `text` в mockResponse,
  3 новых теста.
