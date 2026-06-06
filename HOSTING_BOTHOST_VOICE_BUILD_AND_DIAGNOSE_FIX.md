# v24.1.36 — Bothost Voice Build + Diagnose Fix

Этот патч объединяет два исправления:

1. Dockerfile устанавливает build tools для `@discordjs/opus`:
   - `python3`
   - `make`
   - `g++`
   - `pkg-config`
   - `libopus-dev`
   - `libsodium-dev`
   - `ffmpeg`

2. `package.json` содержит скрипт:

```bash
npm run voice:diagnose
```

После загрузки в GitHub на Bothost обязательно использовать собственный Dockerfile и сделать Rebuild/Redeploy, не Restart.
