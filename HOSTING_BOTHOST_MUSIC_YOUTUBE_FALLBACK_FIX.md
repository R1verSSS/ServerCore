# ServerCore v24.1.42 — Music YouTube fallback fix

## Что исправлено

Ошибка вида:

```text
[Music] Не удалось открыть аудиопоток: error: Invalid URL
```

чаще всего означает, что пользовательская YouTube-ссылка корректная, но библиотека `play-dl` не смогла получить прямой audio stream URL. Это может быть связано с изменениями YouTube, bot-check или ограничением IP-ноды хостинга.

В v24.1.42 добавлен безопасный fallback:

1. `@distube/ytdl-core` — основной новый провайдер для YouTube video audio stream.
2. `play.stream(url)` — быстрый старый путь.
3. `play.video_info(url) -> play.stream_from_info(info)` — прежний fallback.

Если `@distube/ytdl-core` не установится на ограниченном хостинге, бот не упадет при запуске: зависимость подключается optional-режимом через `try/catch`, а воспроизведение продолжит пытаться работать через `play-dl`.

## Новые переменные ENV

```env
MUSIC_USE_DISTUBE_YTDL=true
MUSIC_YOUTUBE_COOKIE=
```

`MUSIC_USE_DISTUBE_YTDL=false` можно поставить, если нужно временно отключить новый fallback.

`MUSIC_YOUTUBE_COOKIE` не заполняй без необходимости. Если понадобится для YouTube bot-check, добавляй cookie только как секретную переменную окружения на хостинге и не коммить в Git.

## Новая диагностика

```bash
npm run music:youtube:diagnose -- https://www.youtube.com/watch?v=Jqn1XNc_094
```

Скрипт отдельно проверяет:

- доступность `play-dl`;
- доступность `@distube/ytdl-core`;
- получение title;
- возможность открыть audio stream.

## Рекомендуемый деплой на Bothost

Так как проект уже использует Dockerfile и `pnpm --no-frozen-lockfile`, достаточно сделать обычный redeploy/rebuild контейнера.

После деплоя проверь:

```bash
node -v
npm run check
npm run voice:diagnose
npm run music:youtube:diagnose -- https://www.youtube.com/watch?v=Jqn1XNc_094
```

Ожидаемо:

```text
Node.js: v20.x
[OK] Node module @distube/ytdl-core
[OK] @distube/ytdl-core title: ...
[OK] @distube/ytdl-core stream: readable=true
```

Если оба YouTube-провайдера падают с ошибками `Sign in to confirm you’re not a bot`, `bot verification`, `forbidden`, `no playable formats`, проблема скорее всего на IP/ASN ноды хостинга. В этом случае нужно просить поддержку перенести контейнер на другую ноду/IP или рассмотреть VPS/Lavalink.
