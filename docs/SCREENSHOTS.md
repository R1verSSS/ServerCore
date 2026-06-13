# Скриншоты для портфолио

В этом репозитории подготовлена структура для скриншотов:

```text
docs/assets/screenshots/
```

Реальные скриншоты нужно сделать с твоего Discord-сервера и web-панели, потому что в архиве нет доступа к живому Discord UI и авторизованной панели.

## Рекомендуемый набор

| Файл | Что показать | Зачем |
|---|---|---|
| `01-discord-smart-center.png` | `/me` / Smart User Center | главный пользовательский сценарий |
| `02-discord-role-select.png` | `/roles` select-menu | удобный выбор ролей |
| `03-discord-ticket-modal.png` | форма создания тикета | UX без пустых тикетов |
| `04-discord-forum-thread.png` | создание forum-темы | работа с forum-каналами |
| `05-web-user-panel.png` | пользовательский личный кабинет | связь Discord и web |
| `06-web-admin-dashboard.png` | главная admin-панель | управление сервером |
| `07-web-access-matrix.png` | `/access` | роли доступа и RBAC |
| `08-web-health-hosting.png` | `/health` или `/hosting` | production diagnostics |
| `09-web-commands.png` | `/commands` | документация команд |
| `10-web-shop-deals.png` | магазин / товар дня | экономика и вовлечение |

## Как делать скриншоты

1. Запусти проект локально или на хостинге.
2. В Discord выполни команды `/me`, `/roles`, `/ticket`, `/threadpanel`.
3. Открой web-панель: `/login`, `/user-panel`, `/access`, `/health`, `/commands`.
4. Сделай скриншоты без приватных токенов, ID пользователей и лишних персональных данных.
5. Положи изображения в `docs/assets/screenshots/` с именами из таблицы выше.
6. После этого GitHub README можно дополнить блоком ниже.

## Готовый блок для README после добавления изображений

```md
## Screenshots

### Discord Smart User Center
![Discord Smart User Center](docs/assets/screenshots/01-discord-smart-center.png)

### User Web Panel
![User Web Panel](docs/assets/screenshots/05-web-user-panel.png)

### Admin Dashboard
![Admin Dashboard](docs/assets/screenshots/06-web-admin-dashboard.png)

### Health / Hosting Diagnostics
![Health / Hosting Diagnostics](docs/assets/screenshots/08-web-health-hosting.png)
```

## Что лучше скрыть на скриншотах

- токены и пароли;
- полный `.env`;
- приватные Discord ID;
- реальные сообщения пользователей;
- backup-файлы и экспорт персональных данных.
