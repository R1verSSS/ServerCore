# v24.1 Login Fix

Исправление запуска для ситуаций, когда Node.js получает `UND_ERR_CONNECT_TIMEOUT` при подключении к Discord API.

Что изменено:

- включен `dns.setDefaultResultOrder('ipv4first')`;
- добавлен безопасный `loginWithRetry`;
- добавлены понятные сообщения при ошибке токена или сети;
- бот больше не падает мгновенно при временном timeout Discord API.

Если после 5 попыток ошибка остается, проверь:

```bash
node -e "fetch('https://discord.com/api/v10/gateway').then(r=>r.text()).then(console.log).catch(console.error)"
```

Если команда падает с timeout, проблема в доступе Node.js к Discord: VPN/Firewall/провайдер.

Можно увеличить число попыток в `.env`:

```env
DISCORD_LOGIN_MAX_RETRIES=10
```
