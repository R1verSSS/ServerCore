# ServerCore Discord Bot v24.1 Hosting Ready

This is a clean hosting-ready build. Runtime files are intentionally excluded: `.env`, `node_modules`, `logs`, `data/database.*`, `data/backups`, and `data/exports`.

For BotHost-like hosting panels, use:

- Main file: `http-wrapper.js`
- Install command: `npm install`
- Start command: `npm start`
- Web port: `3000`

See `HOSTING_BOTHOST_SETUP.md` for the exact environment variables.

---

# ServerCore Discord Bot

Discord-сервер и бот с ролями, профилями, XP, экономикой, тикетами, ивентами, модерацией, мини-играми, Battle Pass, веб-панелью, бэкапами и production-polish улучшениями.

## Быстрый старт

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

## Проверки

```bash
npm run check
npm run env:check
npm run hosting:check
npm run safe:update
```

## Основные файлы

- `.env` — секреты и настройки запуска.
- `data/database.sqlite` — база данных.
- `data/backups/` — резервные копии.
- `logs/` — файловые логи.
- `docs/` — документация.
- `src/config/serverConfig.js` — основные названия каналов, ролей и дефолтные значения.

## Веб-панель

Обычно доступна по адресу:

```text
http://localhost:3000
```

Полезные страницы:

```text
/health
/hosting
/docs
/audit
/project
```

## Хостинг

Перед переносом выполни:

```bash
npm run safe:update
npm run hosting:check
```

Для VPS можно использовать `ecosystem.config.js` и PM2.

## Operator diagnostics

Для комплексной проверки проекта доступны команды:

```bash
npm run check
npm run env:check
npm run net:check
npm run doctor
```

В веб-панели доступна страница:

```text
http://localhost:3000/network
```


## Web Panel UX Upgrade

Последнее обновление v24.1 улучшает веб-панель: поиск и фильтры в таблицах, расширенную карточку пользователя, мастер публикации Discord-панелей, защиту входа, улучшенный audit и очищенную документацию. Подробнее: `docs/web-panel-ux.md`.

## v24.1 Access & Server Structure Upgrade

Добавлены централизованные права доступа, context-menu действия, новая роль 🧰 Helper, страница веб-панели `/access`, обновленные каналы справки команд и улучшенная структура магазина/модерации.

Подробнее: `docs/permissions.md`.
