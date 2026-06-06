# ServerCore v24.1.33 — Bothost Discord Voice diagnostic fix

Патч не гарантирует обход Docker/NAT Discord Voice, но добавляет всё, что просит поддержка хостинга для диагностики:

- образ на `node:20-bookworm-slim`;
- системные пакеты `ffmpeg`, `libsodium23`, `dnsutils`, `netcat-openbsd`;
- Node-зависимости `@discordjs/voice`, `@discordjs/opus`, `opusscript`, `libsodium-wrappers`, `sodium-native`, `tweetnacl`;
- `GatewayIntentBits.GuildVoiceStates` уже включён в `src/index.js`;
- `/music diagnose` и `npm run voice:diagnose`;
- расширенные логи stateChange для voice connection;
- `forceIPv4` и увеличенный `MUSIC_CONNECT_TIMEOUT`.

Рекомендуемые переменные:

```env
MUSIC_ENABLED=true
MUSIC_CONNECT_TIMEOUT=45000
MUSIC_DEBUG=true
MUSIC_FORCE_IPV4=true
```

Проверка на Bothost:

```bash
ffmpeg -version
ls -la node_modules/@discordjs/opus
ls -la node_modules/sodium-native
npm run voice:diagnose
```

Если `/music play` всё равно зависает на `signalling`, отправь поддержке:

1. ID бота/ноды;
2. логи `[Music] Voice connection state`;
3. вывод `npm run voice:diagnose`;
4. Dockerfile и package.json.

Возможный итог: Docker bridge/NAT на конкретной ноде не проходит Discord UDP IP discovery. Тогда нужен перенос на другую ноду или внешний Lavalink/VPS.
