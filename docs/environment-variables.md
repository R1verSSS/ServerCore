# Переменные окружения ServerCore

Основной шаблон находится в `.env.example`. Для production можно использовать идентичный файл `.env.production.example`.

## Быстрый старт

```bash
cp .env.example .env
npm run env:check
```

На Windows CMD:

```cmd
copy .env.example .env
npm run env:check
```

## Обязательные значения

Для первого запуска необходимо заполнить как минимум:

- `DISCORD_TOKEN`;
- `CLIENT_ID`;
- `GUILD_ID`;
- `WEB_PASSWORD`;
- `WEB_SESSION_TOKEN`;
- `WEB_PANEL_URL`.

## Секретность

Файл `.env` содержит токен Discord и пароль панели. Он должен оставаться только на локальном компьютере или в переменных окружения хостинга. В GitHub отправляются только `.env.example` и `.env.production.example`.

## Выбор базы

- `DB_DRIVER=sqlite` — основной режим для VPS и окружений с поддержкой `better-sqlite3`;
- `DB_DRIVER=json` — резервный режим для ограниченного хостинга.

## Музыка

На хостингах без Discord Voice/UDP установи:

```env
MUSIC_ENABLED=false
```

Для диагностики временно можно включить:

```env
MUSIC_DEBUG=true
MUSIC_FORCE_IPV4=true
MUSIC_CONNECT_TIMEOUT=45000
MUSIC_USE_DISTUBE_YTDL=true
# Только как секрет ENV, если YouTube просит bot-check/sign-in:
MUSIC_YOUTUBE_COOKIE=
```

## Проверка

После заполнения файла выполни:

```bash
npm run env:check
npm run production:check
```
