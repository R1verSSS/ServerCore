# Переход ServerCore с JSON на SQLite

Начиная с v24.1.28 проект умеет работать с SQLite не только через `node:sqlite`, но и через пакет `better-sqlite3`. Это важно для хостингов на Node.js 20, где встроенного модуля `node:sqlite` ещё нет.

## Настройки `.env`

```env
DB_DRIVER=sqlite
SQLITE_PATH=./data/database.sqlite
APPLICATIONS_CHANNEL_ID=1512791242000564229
```

`APPLICATIONS_CHANNEL_ID` нужен, если канал заявок переведён в Forum. Бот будет искать канал по ID и создавать заявки отдельными темами.

## Команды после обновления

```bash
npm install
npm run db:migrate
npm run setup
```

`npm run db:migrate` читает текущий `data/database.json` и записывает его в `data/database.sqlite`. JSON-файл не удаляется и остаётся резервной копией.

## Проверка

```bash
npm run hosting:check
npm start
```

В self-check должно быть:

```text
[OK] База данных SQLite активна
[OK] Канал заявок: 📨・заявки
```

Если SQLite не включился, проверь лог `SQLite unavailable`. Чаще всего причина — не выполнен `npm install` или хостинг не смог установить `better-sqlite3`.
