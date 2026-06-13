# База данных и миграции

ServerCore поддерживает два режима хранения данных:

1. **SQLite** — рекомендуемый production-режим.
2. **JSON fallback** — запасной режим для хостингов, где не удалось поднять SQLite/native-зависимости.

## ENV-настройки

```env
DB_DRIVER=sqlite
SQLITE_PATH=./data/database.sqlite
```

Для Docker/production чаще используется путь:

```env
SQLITE_PATH=/app/data/database.sqlite
```

## Как устроено хранилище

Основной файл: `src/services/dataStore.js`.

Логика:

- при запуске проект пытается подключить SQLite;
- сначала пробует `node:sqlite`;
- если он недоступен, пробует `better-sqlite3`;
- если SQLite недоступен, переключается на JSON fallback;
- структура данных нормализуется через `mergeDefaults`, чтобы старые базы не ломали новые версии проекта.

## SQLite-схема

Минимальная схема создается автоматически:

```sql
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  messages INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 0,
  season_xp INTEGER DEFAULT 0,
  clan_id TEXT,
  last_xp_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
```

Текущая модель использует гибридный подход:

- `app_state` хранит полное состояние приложения;
- `users` дает быстрый доступ к ключевым пользовательским полям;
- `audit_log` фиксирует записи операций с базой.

## Миграция с JSON на SQLite

```bash
npm run db:migrate
```

Команда читает старый `data/database.json` и переносит данные в SQLite. JSON-файл можно оставить как резервную копию, но его не нужно публиковать в GitHub.

## Backup

```bash
npm run db:backup
```

Резервные копии должны храниться в `data/backups/`. Реальные backup-файлы не коммитятся.

## Что не коммитить

```text
.env
data/database.sqlite
data/database.sqlite-shm
data/database.sqlite-wal
data/database.json
data/backups/*
data/exports/*
logs/*
```

Это уже отражено в `.gitignore`.

## Что можно улучшить дальше

- Перейти от `app_state` JSON blob к полноценным нормализованным таблицам для tickets, applications, shop, moderation cases.
- Добавить версионирование миграций, например `schema_migrations`.
- Добавить rollback-стратегию для крупных миграций.
- Добавить тестовую базу для unit/integration tests.
