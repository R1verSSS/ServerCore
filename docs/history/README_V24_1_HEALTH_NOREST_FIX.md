# v24.1 Health No-REST Fix

Исправление для `/dbstatus` и `/health`: health-check больше не делает REST-запрос `guild.members.fetchMe()` к Discord API.

Причина исправления: на некоторых сетях Node.js получает `ConnectTimeoutError` при попытке обратиться к Discord API, хотя бот уже запущен и работает через gateway. Теперь диагностика использует кэш Discord.js и не должна падать из-за сетевого timeout.

## Обновление

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

Проверка:

```text
/dbstatus
````

Веб-панель:

```text
http://localhost:3000/health
```
