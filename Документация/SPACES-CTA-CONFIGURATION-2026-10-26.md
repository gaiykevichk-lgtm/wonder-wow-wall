# «Хочу такую панель!» — перенос конфигурации в каталог

## Brief
При переходе из карточки на `/spaces` в каталог нужно заранее выбрать именно связанное с текущей фотографией исполнение панели, а не просто открыть товар без выбранной фактуры и исполнения.

## Решение
Кнопка CTA использует конфигурацию активной фотографии из модалки и передаёт `executionVariantId`, `interiorId`, а также catalog binding (`finishGroupId`, `finishImage`) в URL карточки. Каталог разрешает binding по семейству базовой панели и texture ID, восстанавливая выбранную фактуру/исполнение.

## Затронутые файлы
- `frontend/src/domains/content/ui/SpacesPage.tsx`
- `frontend/src/domains/content/model/spacePresentation.ts`

## Проверки
- Frontend build и TypeScript.
- Целевые Vitest-наборы SpaceDetailModal, CatalogPanelPage и spaceProjects.
- Production `/spaces` и новый JS bundle; снят публичный screenshot `/spaces`.
- Production API health проверен.

## Публикация
Frontend выкладывается отдельно в `/opt/app/frontend/dist`; backend/API для этой правки не менялся. Перед заменой сохранена копия frontend в `/opt/app/deploy-backups/panel-status-predeploy-20261026T0553Z`.

## Статус
Код и собранный frontend выложены. Целевой переход из карточки до каталога в живой браузере отдельно не воспроизведён; проверены unit/integration tests, HTTP и скриншот страницы `/spaces`.
