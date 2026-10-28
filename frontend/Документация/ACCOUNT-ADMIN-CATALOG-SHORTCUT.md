# Переход из ЛК в админ-каталог

Brief: добавить небольшую ненавязчивую шестерёнку в блок профиля личного кабинета со скриншота; показывать только для авторизованного администратора с email `admin@wow.ru`. Открывать тот же маршрут каталога админ-панели в локальной dev-среде и на основном домене.

Стек: существующий React/TypeScript/Vite, React Router, Zustand, Ant Design. `src/domains/account/ui/AccountLayout.tsx` отображает кнопку у имени и переходит относительным для текущего origin маршрутом `/admin/catalog`. `src/domains/admin/ui/RequireAdmin.tsx` продолжает защищать маршрут по роли; серверные `/api/admin/*` защищаются backend. Email для видимости кнопки не является проверкой полномочий. Тесты: `src/domains/account/ui/AccountLayout.test.tsx`.

Запуск: `npm run dev -- --host 0.0.0.0 --port <свободный порт>`; проверки `npm run test -- src/domains/account/ui/AccountLayout.test.tsx` и `npm run build`. API dev-среды проксируется по `VITE_BACKEND_URL` (если не задан, локальный backend). Секретных значений нет.

Статус: локальное изменение; публикация отдельно не выполнялась.
