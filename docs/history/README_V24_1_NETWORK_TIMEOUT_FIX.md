# v24.1 Network Timeout Fix

Патч для нестабильного подключения Node.js к Discord API.

## Что исправлено

- `safeDefer`, `safeReply`, `safeEdit` больше не роняют команду при `UND_ERR_CONNECT_TIMEOUT`.
- `/clear` корректнее обрабатывает timeout при `bulkDelete` и не пытается повторно отправлять ошибку после истечения interaction.
- Логирование очистки сообщений теперь не ломает команду, если Discord API временно не ответил.
- REST timeout увеличен до 60 секунд по умолчанию.
- Можно настроить таймаут через `.env`:

```env
DISCORD_REST_TIMEOUT=60000
DISCORD_LOGIN_MAX_RETRIES=10
```

## Важно

Если Node.js не может стабильно подключиться к `discord.com`, команды могут выполняться с задержкой. Это сетевой вопрос: VPN, Firewall, маршрут до Cloudflare/Discord.

Проверка:

```bash
node -e "fetch('https://discord.com/api/v10/gateway').then(r=>r.text()).then(console.log).catch(console.error)"
```

Если команда дает `ConnectTimeoutError`, включи системный VPN или разреши `node.exe` в Firewall.
