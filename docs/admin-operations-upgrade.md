# ServerCore v24.1 Admin Operations Upgrade

Пакет добавляет инструменты эксплуатации проекта на хостинге.

## Новые Discord-команды

- `/update-check` — проверяет текущую версию, последний deploy slash-команд, наличие backup и состояние production-режима.

## Новые страницы веб-панели

- `/update-center` — центр обновлений: версия, последний `npm run deploy`, backup и проверки.
- `/changelog` — журнал изменений ServerCore.
- `/errors` — последние ошибки из `logs/error.log` с кнопкой очистки.
- `/scenarios` — безопасные сценарии администратора: predeploy backup, stable backup, post-update check.

## Новый npm script

```bash
npm run update:check
```

## Рекомендуемый порядок обновления

1. Создать backup через `/scenarios` или `/backups`.
2. Сделать `git push`.
3. Выполнить redeploy на хостинге.
4. Выполнить `npm run deploy`, если менялись slash-команды.
5. Проверить `/update-check`, `/production-check`, `/health`.
