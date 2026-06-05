# ServerCore v24.1 Stability & Production Polish

Это доработка текущей ветки v24.1 без перехода на v25.

## Главное

- Добавлена централизованная конфигурация `src/config/serverConfig.js`.
- Добавлены проверки проекта: `npm run check`, `npm run env:check`, `npm run hosting:check`.
- Добавлен безопасный сценарий обновления: `npm run safe:update`.
- Добавлены файловые логи в `logs/bot.log`, `logs/error.log`, `logs/audit.log`.
- Добавлены docs в папке `docs/` и страница `/docs` в веб-панели.
- Добавлена команда `/hosting-check` и страница `/hosting`.
- Добавлены примеры production-конфига: `.env.production.example`, `ecosystem.config.js`, `docker-compose.yml`.
- Добавлена очистка старых файлов: `npm run cleanup`.

## Рекомендуемый запуск после обновления

```bash
npm install
npm run safe:update
npm run deploy
npm start
```

## Проверка

```bash
npm run check
npm run env:check
npm run hosting:check
```

В Discord:

```text
/hosting-check
/dbstatus
/help
/menu open
```

В веб-панели:

```text
http://localhost:3000/project
http://localhost:3000/hosting
http://localhost:3000/docs
http://localhost:3000/health
```
