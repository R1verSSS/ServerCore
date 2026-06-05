# v24.1 Production Polish

Это обновление улучшает текущую v24.1 без перехода на v25.

## Что добавлено

- `/setup-wizard` — мастер диагностики настройки сервера.
- `/me` — личный центр участника.
- `/maintenance` — режим обслуживания.
- `/backup test` — проверка целостности бэкапа.
- Веб-страницы `/docs`, `/audit`, `/maintenance`.
- Startup self-check в консоли при запуске.
- Журнал действий администраторов.
- Дополнительная диагностика health-check.
- Документация по безопасному обновлению, хостингу, intents и правам бота.

## Обновление

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

Перед обновлением рекомендуется выполнить:

```text
/backup create name:before-production-polish
```

## Проверка

```text
/setup-wizard
/me
/maintenance status
/dbstatus
/backup test name:<имя-файла>
```

Веб-панель:

```text
http://localhost:3000/health
http://localhost:3000/docs
http://localhost:3000/audit
http://localhost:3000/maintenance
```
