# Music play-dl compatibility fix

Исправлена ошибка:

```text
TypeError: play.yt_validate(...).catch is not a function
```

Причина: в установленной версии `play-dl` функция `yt_validate()` возвращает значение синхронно, а старый код обрабатывал его как Promise.

После патча проверьте:

```bash
npm run deploy
```

Затем в Discord:

```text
/music play url:<YouTube URL>
```
