# v24.1 Web Panel Menu Upgrade

Добавлено удобное Discord-меню для входа в веб-панель ServerCore.

## Команды

- `/webpanel open` — показать меню веб-панели только пользователю.
- `/webpanel post` — опубликовать меню веб-панели в выбранный канал. Требуется право `Manage Messages` или `Administrator`.
- `/webaccount status` — проверить пользовательский веб-аккаунт.
- `/webaccount password` — создать/изменить пароль пользователя.
- `/webaccount login-code` — получить одноразовый код входа.

## Ссылка

По умолчанию используется:

```text
https://bot-1780694887-7211-r1vers.bothost.tech/login
```

При необходимости можно изменить через переменную окружения:

```env
WEB_PANEL_URL=https://your-domain.example/login
```

## Setup

`npm run setup` публикует меню веб-панели в `🧭・навигация` и пытается закрепить сообщение.

