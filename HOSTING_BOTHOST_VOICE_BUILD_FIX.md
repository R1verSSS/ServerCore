# Bothost Discord Voice build fix

Если сборка падает на `@discordjs/opus` с ошибкой `Could not find any Python installation to use`,
нужно собирать образ через собственный Dockerfile.

В Dockerfile добавлены:

- `ffmpeg`
- `libsodium23`
- `libsodium-dev`
- `libopus-dev`
- `python3`
- `make`
- `g++`
- `pkg-config`

После загрузки на GitHub на Bothost нужно выполнить Rebuild/Redeploy, не просто Restart.
