
## v24.1 User Experience Flow Upgrade

- `/me` заменен на Smart User Center с динамическими Daily/Ticket/Shop действиями.
- Добавлены пользовательские списки: мои темы, мои тикеты, мои заявки.
- Forum-темы теперь сохраняются в базе и отображаются в Discord/Web.
- В пользовательской web-panel появился блок “Что дальше?” и web-Daily.
- Role panel переведена на select-menu с мультивыбором.
- Добавлены достижения за onboarding, первую forum-тему и выбор ролей.

Документация: `docs/user-experience-flow-upgrade.md`.

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
