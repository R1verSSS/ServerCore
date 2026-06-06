# v24.1 Hosting Stability & Server Control

Этот патч добавляет управление модулями, production-check, расширенные правила каналов и безопасный режим музыки.

## Новые переменные

```env
MUSIC_ENABLED=false
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_INTERVAL_HOURS=24
AUTO_BACKUP_KEEP=14
NETWORK_CHECK_TIMEOUT=8000
```

Для Bothost рекомендуется оставить:

```env
DB_DRIVER=json
MUSIC_ENABLED=false
```

Если музыка нужна, лучше использовать VPS/Lavalink и включить:

```env
MUSIC_ENABLED=true
```

## Новые страницы веб-панели

- `/modules` — управление модулями.
- `/channel-rules` — правила для служебных каналов.
- `/production` — финальная проверка production-состояния.

## Новая команда Discord

```text
/production-check
```

Проверяет токен, базу, backup, веб-панель, test/demo режимы, модули и сеть.

## Новая npm-команда

```bash
npm run production:check
```

## Музыка

Если хостинг не поддерживает Discord Voice/UDP, поставь:

```env
MUSIC_ENABLED=false
```

Тогда музыкальные кнопки будут выключены, а `/music status` покажет причину и рекомендации.

## Правила каналов

Через `/channel-rules` можно настроить режимы:

- `free` — свободное общение.
- `panel_only` — только панели/бот.
- `commands_only` — только команды.
- `music_only` — только музыка/YouTube-ссылки.

Модераторы и админы обходят автоудаление.
