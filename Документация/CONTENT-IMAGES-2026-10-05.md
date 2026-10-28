# Доставка изображений блога и About — 2026-10-05

Причина: прямые URL images.unsplash.com недоступны из части клиентских окружений. Proxy с публичными DNS также испытывал SSL timeout к отдельным адресам Fastly, подтверждено nginx error log. Системный resolver VM 127.0.0.53 выбирает доступный upstream.

На production добавлен ограниченный маршрут /content-images/unsplash/photo-<digits>-<alphanumeric>, фиксированный upstream images.unsplash.com, resolver 127.0.0.53, bounded timeouts и proxy cache (100 MiB max, stale on upstream failure). Nginx работает вне systemd: применён штатный nginx -s reload после nginx -t. Картинки не скачивались в репозиторий и не заменялись другими.

В опубликованном графе JS заменён только префикс внешних изображений на first-party маршрут; новый suffix contentimages. Исходные TSX пока сохраняют старые URL: перед следующей полноценной сборкой необходимо перенести это решение в source/config production и обеспечить маршрут в соответствующем deployment template.

Бэкап HTML и nginx: /opt/app/deploy-backups/content-images-20261005. Cache config: /etc/nginx/conf.d/content-images-cache.conf.

Проверки: 9 URL Blog/About возвращают 200 image/jpeg; все 5 изображений блога загружены через публичный домен и декодированы PIL как JPEG 800x500. Публичный screenshot показывает изображения первых карточек; анимация остаётся на промежуточной opacity, content_ok=false. Полный UI-flow не подтверждён. Изменений API, БД или данных админки не было. Один публичный файл пространства проверен отдельно: 200 image/png, этого недостаточно для вывода об исправлении админки.
