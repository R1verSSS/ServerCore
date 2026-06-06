# v24.1.27 Hosting Self-check & Applications Forum Fix

## Что исправлено

### Хранилище данных

На Bothost используется Node.js 20, где встроенный модуль `node:sqlite` может быть недоступен. Поэтому для такого хостинга штатный режим — JSON-хранилище:

```env
DB_DRIVER=json
```

После исправления self-check больше не считает JSON fallback ошибкой, если он явно выбран через `DB_DRIVER=json`.

SQLite можно включать на VPS или хостинге с Node.js 22+:

```env
DB_DRIVER=sqlite
SQLITE_PATH=./data/database.sqlite
```

### Канал заявок

Заявки могут храниться в Forum-канале. Для текущего сервера используется ID:

```env
APPLICATIONS_CHANNEL_ID=1512791242000564229
```

Проверка каналов и публикация новых заявок теперь поддерживают типы:

- `GuildText`
- `GuildForum`

Если ID задан, бот ищет канал заявок по ID. Если ID не найден, используется поиск по названию `📨・заявки`.
