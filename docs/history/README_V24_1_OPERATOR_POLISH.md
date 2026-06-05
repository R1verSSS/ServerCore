# v24.1 Operator Polish

Это доработка текущей ветки v24.1 без перехода на v25. Цель — упростить эксплуатацию проекта, диагностику сети и подготовку к хостингу.

## Новое

- `npm run net:check` — проверка доступа Node.js к Discord API.
- `npm run doctor` — комплексная диагностика: синтаксис, `.env`, hosting readiness и сеть.
- `/network-check` — Discord-команда для администраторов.
- `/network` — страница веб-панели с диагностикой сети.
- `docs/network.md` — инструкция по ошибкам `ConnectTimeoutError` и `UND_ERR_CONNECT_TIMEOUT`.

## Когда использовать

Если команды Discord иногда выполняются, но бот не успевает ответить, а в консоли есть `ConnectTimeoutError`, запусти:

```bash
npm run net:check
```

Если сеть Node.js до Discord нестабильна локально, проблему можно отложить до VPS/хостинга.
