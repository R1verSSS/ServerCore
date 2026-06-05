# v19 Suggestions & Polls

Добавлены предложения и голосования.

## Discord-команды

```text
/suggest idea:...
/suggestions status:open
/suggestion info id:1
/suggestion status id:1 status:accepted comment:Принято
/poll create question:... options:Да | Нет | Не знаю
/poll list
/poll info id:1
/poll close id:1
```

## Канал

При повторном `npm run setup` будет создан канал:

```text
💡・предложения
```

Если канал отсутствует, бот попытается создать его при работе веб-панели или сохранить данные в базе.

## Веб-панель

Добавлен раздел:

```text
http://localhost:3000/suggestions-panel
```

В нем можно создавать предложения и опросы, менять статусы, просматривать голоса.

## Статусы предложений

```text
open — на голосовании
review — на рассмотрении
accepted — принято
denied — отклонено
closed — закрыто
```
