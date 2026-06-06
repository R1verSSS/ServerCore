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


## v24.1.10 — Channel Cleanup & Music Panel

Добавлено:

- автоудаление обычных сообщений в информационных/панельных каналах;
- канал `🎵・музыка` теперь получает музыкальную панель через `npm run setup`;
- команды `/music` и `/musicpanel`;
- поддержка YouTube video/playlist через voice-каналы;
- новые зависимости `@discordjs/voice`, `play-dl`, `libsodium-wrappers`;
- настройка `PROTECTED_TEXT_CHANNELS` для дополнительных защищенных каналов.

После обновления выполните:

```bash
npm run deploy
npm run setup
```

Подробнее: `docs/music-and-channel-cleanup.md`.


## v24.1 Server Management UX Upgrade

Добавлены onboarding-чеклист, шаблоны тикетов, история экономики, товар дня, центр панелей 2.0, страница ролей и улучшения управления сервером.


## v24.1.16 User Web Panel & Auth Upgrade

Добавлена пользовательская веб-панель: вход по Discord ID через `/webaccount password` или одноразовый код `/webaccount login-code`. Админская панель доступна через логин `Admin` и `WEB_PASSWORD`.

## v24.1.17 Web Panel Menu Upgrade

Добавлено удобное Discord-меню для веб-панели:

- `/webpanel open` — открыть меню веб-панели для себя.
- `/webpanel post` — опубликовать меню в канал.
- В `/menu open` добавлен раздел `🌐 Веб-панель`.
- `npm run setup` публикует меню веб-панели в `🧭・навигация`.
- Ссылка на вход задается через `WEB_PANEL_URL`.

Рекомендуемое значение для Bothost:

```env
WEB_PANEL_URL=https://bot-1780694887-7211-r1vers.bothost.tech/login
```
