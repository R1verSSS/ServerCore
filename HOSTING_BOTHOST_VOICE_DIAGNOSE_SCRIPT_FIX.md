# Bothost Voice Diagnose Script Fix

Добавлена команда:

```bash
npm run voice:diagnose
```

Она проверяет:

- наличие voice-зависимостей Node.js;
- наличие ffmpeg/ffprobe;
- переменные MUSIC_*;
- базовый исходящий UDP-запрос к DNS.

Если зависимости и ffmpeg в порядке, но `/music play` зависает на `signalling`, проблема, вероятнее всего, в Docker/NAT UDP/IP discovery на ноде хостинга.
