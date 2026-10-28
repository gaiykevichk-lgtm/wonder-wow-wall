# Фото с главной в конфигуратор

Запрос: прямоугольная зона загрузки фото в третьей карточке «Ваш проект. В деталях.». После выбора и кнопки перейти /configurator с уже загруженным фото.

Использовать существующий createSession(file): фото выбирается локально с preview, после кнопки выполняется POST configurator/sessions. Передать результат через Router state (только id/photo_url). ConfiguratorAiPage принимает сессию, сбрасывает прежние ответы/предложения, переходит на шаг 2 без повторной загрузки. Ограничения как в конфигураторе: JPG/PNG/WebP до 20MB. Object URL очищается, ошибки и busy видимые; без нового backend, localStorage фото или сторонних библиотек. Файлы: HomeConfiguratorUpload.tsx, HomePage.tsx, projectDetails.css, ConfiguratorAiPage.tsx и тесты.

Статус: реализация; проверить unit и production flow загрузки без запуска генерации.

Проверено: 56/56 тестов (загрузка/валидация/ошибка/drag-drop, HomePage, конфигуратор и приём новой сессии без повторного POST), lint clean, build successful. На production выполнен полный flow: выбор test-wall.jpg (150504 bytes) на главной → WOW → /configurator → шаг «Диалог с ИИ-дизайнером», реальное загруженное фото отображается (скриншот просмотрен). Генерация вариантов не запускалась. Создана только тестовая сессия существующего конфигуратора; карточки каталога, backend и БД-схема не менялись. Entry index-DUH36GPB.js; backup /opt/app/frontend/backups/home-photo-20261002T234744Z/index.html; старые assets/CSS сохранены. Local frontend HTTP200, screenshot Preview service timeout — Preview marker не выдаётся.
