# Bothost pnpm + SQLite fix

Если в runtime появляется ошибка `Cannot find module 'dotenv'`, а `node_modules/dotenv` пустой, значит pnpm установил зависимости в структуру, несовместимую с обычным `require()` в контейнере Bothost.

В проект добавлен `.npmrc`:

```ini
node-linker=hoisted
shamefully-hoist=true
public-hoist-pattern=*
```

Dockerfile также запускает pnpm install с `node-linker=hoisted` и проверяет наличие `package.json` у основных зависимостей.

Для SQLite на Bothost должны быть переменные окружения:

```env
DB_DRIVER=sqlite
SQLITE_PATH=/app/data/database.sqlite
APPLICATIONS_CHANNEL_ID=1512791242000564229
```

После деплоя:

```bash
npm run db:migrate
ls -la /app/data
```

Ожидаемый файл:

```text
database.sqlite
```
