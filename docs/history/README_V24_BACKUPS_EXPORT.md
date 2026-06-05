# v24 Backups & Export

## Новые команды

- `/backup create name:<название> attach:<true/false>` — создать резервную копию базы.
- `/backup list` — показать список бэкапов.
- `/backup restore name:<файл> confirm:true` — восстановить базу из бэкапа.
- `/backup delete name:<файл>` — удалить бэкап.
- `/export type:<users|economy|warnings|all> format:<json|csv>` — экспорт данных.

## Веб-панель

Открой:

```text
http://localhost:3000/backups
```

В разделе можно:

- создать бэкап;
- скачать бэкап;
- восстановить базу;
- удалить бэкап;
- экспортировать пользователей, экономику, предупреждения или все данные.

## Автобэкапы

По умолчанию автобэкап включен и запускается раз в 24 часа.

Дополнительные переменные `.env`:

```env
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_INTERVAL_HOURS=24
AUTO_BACKUP_KEEP=14
```

Бэкапы хранятся в:

```text
data/backups
```

Экспортированные файлы временно хранятся в:

```text
data/exports
```

## Важно для хостинга

Если бот размещен на Railway/Render/Fly/VPS, убедись, что `data/database.sqlite` и папка `data/backups` находятся в постоянном хранилище. Иначе после пересборки проекта данные могут быть потеряны.
