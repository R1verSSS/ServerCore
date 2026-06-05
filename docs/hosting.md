# Хостинг

Рекомендуемые варианты:

- VPS + PM2 — лучший вариант для SQLite и бэкапов.
- Railway/Render — удобно, но нужно постоянное хранилище для `data/database.sqlite` и `data/backups`.

Перед переносом:

```bash
npm run safe:update
npm run hosting:check
```

На хостинге не загружай `.env` в публичный GitHub. Переменные добавляй через панель хостинга.
