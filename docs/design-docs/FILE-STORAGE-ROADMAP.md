# File Storage Roadmap

> **Статус:** draft
> **Область:** Backend · admin file uploads (Phase 6 → S3-compatible)
> **Связанные артефакты:** `app/domain/media/services.py` (ABC), `app/infrastructure/storage/local.py` (MVP-адаптер), `docs/exec-plans/active/PLAN-ADMIN-PANEL.md` (Фаза 6).

## Контекст

Фаза 6 админки ввела домен `media` с интерфейсом `FileStorage` и единственной реализацией `LocalFileStorage`. На MVP-этапе все админ-загрузки (превью дизайнов, фото панелей, баннеры) пишутся на локальный том `/var/uploads/`, а nginx раздаёт их через `location /uploads/`.

Это сознательный trade-off ради простоты деплоя — но он не масштабируется за один backend-инстанс и не выживает потерю volume. Этот документ фиксирует, что мы будем делать, когда (а не «если») это станет проблемой.

## Когда мигрировать — триггеры

Не раньше одного из:

1. **Multi-instance backend.** Появляется второй backend-под (HA, blue/green, autoscale) — локальный том становится single-point-of-failure / single-point-of-write.
2. **Бэкапы.** Бизнес требует point-in-time recovery для пользовательского контента (legal hold, восстановление случайно удалённых баннеров) — ручная rsync-копия volume не годится.
3. **>50 GB** загрузок суммарно — стоимость хранения на cloud-block-storage перестаёт быть пренебрежимой по сравнению с object-storage.
4. **CDN.** Маркетинг просит географически распределённую раздачу превью каталога.

Пока ни один не сработал — `LocalFileStorage` остаётся.

## Целевое состояние

`S3FileStorage(FileStorage)` рядом с `LocalFileStorage` в `app/infrastructure/storage/`. Domain-слой не меняется — ABC спроектирован именно с прицелом на смену backend без правки use case.

Адаптер должен:

- Сохранять под тем же layout `<purpose>/<uuid4>.<ext>` — миграция данных = `aws s3 cp /var/uploads/ s3://bucket/ --recursive`.
- Возвращать `url_for(path)` либо как public CloudFront URL (если объекты публичны), либо как presigned GET (если приватны и ttl приемлем для AntD `<img>`).
- Реализовать `delete` идемпотентно: S3 уже возвращает 204 на отсутствующий ключ — просто не падать на `NoSuchKey`.
- Подцепляться через `container.get_file_storage()` по флагу `STORAGE_PROVIDER` — `local` (default) / `s3`.

## Рассмотренные варианты

| Вариант | Плюсы | Минусы | Решение |
|---------|-------|--------|---------|
| AWS S3 | Стандарт, IAM, lifecycle policies | Vendor lock | **Целевой** для public cloud |
| Cloudflare R2 | S3 API, нет egress fee, CDN bundle | Меньше зрелости IAM | Хороший fallback, та же реализация |
| MinIO (self-host) | Та же S3 API, on-prem | Сами держим хранилище | Для on-prem-инсталляций |
| GCS / Azure Blob | Нативная интеграция в их облаках | Другой API, отдельный адаптер | Откладываем |
| Database BLOB | Один backend, простые бэкапы | PostgreSQL не для байтов; шейп раздачи мутный | Отказались — `MediaAsset.path` = указатель, не данные |

S3-compatible API — общий знаменатель первых трёх. Один адаптер `S3FileStorage` (через `boto3` или `aioboto3`) покрывает AWS / R2 / MinIO без отдельных классов.

## План миграции (когда триггер сработает)

1. **Параллельная запись.** Обернуть `LocalFileStorage.save` в `DualWriteStorage(local, s3)` — каждый upload пишется в оба хранилища. Старые файлы остаются только локально.
2. **Бэкфилл.** Скрипт `scripts/sync_uploads_to_s3.py` копирует существующие `<purpose>/<uuid>.*` в S3, идемпотентно (skip-if-exists).
3. **Переключение чтения.** `url_for` начинает возвращать S3-URL. Первая неделя — fallback на local, если S3 отдал 404 (страховка от пропусков бэкфилла).
4. **Отключение записи в local.** Через 2 недели после п.3 — оставляем только `S3FileStorage`. `DualWriteStorage` выпиливается.
5. **Снос volume.** Спустя месяц после п.4 — `docker volume rm uploads`. Том + nginx-`location` остаются в коде до этого момента.

Каждый шаг — отдельный PR. Откат в любой момент сводится к смене `STORAGE_PROVIDER`.

## Открытые вопросы (отложены до миграции)

- **Public vs presigned.** Превью каталога — public (нужны для SEO og:image), фото внутренних заказов — presigned. Решать на этапе п.3, не сейчас.
- **CDN.** CloudFront перед S3? Cache invalidation поверх UUID-имён не нужен (имена уникальны), но tariff/setup — отдельный разговор.
- **Удаление и legal hold.** S3 Object Lock — оверкилл сегодня; если бизнес попросит — добавляем `lock_until` в `MediaAsset` и пробрасываем в S3 Put Object.
- **Антивирус.** Phase 6 ограничилась magic-bytes-проверкой через Pillow `verify()`. На S3 проще навесить отдельный лямбда-сканер (`s3:ObjectCreated:*` → ClamAV); это аргумент в пользу миграции, но не блокер.

## Не делаем сейчас

- Не пишем `S3FileStorage` авансом — мёртвый код, который нужно будет тестировать против реального бакета или localstack.
- Не вводим `STORAGE_PROVIDER` enum, пока поставщик один.
- Не меняем `MediaAsset.path` — он уже storage-relative и переносится 1:1.

Триггер → этот документ переходит в `approved` и появляется отдельный exec-plan на миграцию.
