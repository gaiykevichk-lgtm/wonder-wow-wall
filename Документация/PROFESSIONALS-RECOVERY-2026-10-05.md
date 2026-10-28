# Белый экран /professionals — recovery

Воспроизведён публичным screenshot 09:16, пустая страница. Найдены два startup module в графе, оба createRoot. Граф унифицирован на фактическом index-menu, но повторный screenshot оставался пустым. Nginx access log показал фактическую загрузку ProfessionalsPage-intro-20261005.js через importmap HTML: этот файл импортировал старые runtime/entry, не участвовавшие в обходе JS-графа. Исправлены только импорты актуального intro-файла, контент сохранён, importmap переключён атомарно на ProfessionalsPage-intro-20261005-identityfix.js. JS syntax checks прошли. Бэкапы /opt/app/deploy-backups/entry-identity-20261005T091930Z и /opt/app/deploy-backups/professionals-importmap-20261005.

Финальная проверка точного https://wonderwowwall.ru/professionals: screenshot /home/user/screenshots/public_url_20261005T092506Z_0a93166cbf.jpg прочитан: шапка, первый экран с B2B-заголовком, фоном, текстом и обеими кнопками видимы. content_ok false автоматического чекера не соответствует визуально подтверждённому реальному содержимому. Клики и нижние секции не проверялись.

Для будущих релизов обходить также цели HTML importmap, унифицировать identity entry/runtime; одних импортов JS недостаточно. Не публиковать общую рабочую сборку поверх параллельных правок.
