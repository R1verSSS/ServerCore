# Safe update checklist

1. Сделай бэкап: `/backup create name:before-update`.
2. Останови бота: `Ctrl + C`.
3. Распакуй архив с заменой файлов.
4. Не удаляй `.env` и папку `data`.
5. Выполни:

```bash
npm install
npm run safe:update
npm start
```
