# Безопасное обновление

Перед обновлением:

```bash
/backup create name:before-update
```

Или локально:

```bash
npm run safe:update
```

Не удаляй:

- `.env`
- `data/database.sqlite`
- `data/backups/`
- `logs/`, если нужны старые логи
