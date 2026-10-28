# Видео в первом блоке страницы подписки

Цель: добавить за заголовком «Свобода обновления. Стены как сервис.» видео главного экрана без изменения остальных блоков страницы.

Реализация: `frontend/src/domains/subscription/ui/PricingPage.tsx` использует `/herovideo/IMG_6429.MP4` или `/herovideo/IMG_6431.MP4` по существующему `window.__heroIdx`. Видео без звука, автозапуск, повтор и `object-fit: cover`; градиентное затемнение сохраняет читаемость текста. Файлы уже находятся в `frontend/public/herovideo`, новые медиа не создаются.

Проверка: `cd frontend && npx vitest run src/domains/subscription/ui/__tests__/PricingPage.test.tsx`, `npx tsc --noEmit`, `npm run build`. Состояние визуальной проверки и публикации отражать отдельно.
