# Типовые ошибки

## TokenInvalid
В `.env` указан не Bot Token. Возьми токен в Discord Developer Portal → Bot.

## Used disallowed intents
Включи нужные Privileged Gateway Intents: Message Content Intent и Server Members Intent.

## ConnectTimeoutError
Проблема маршрута Node.js до Discord API. Помогает системный VPN, Node.js LTS или хостинг/VPS.

## Missing Permissions
Роль бота ниже нужной роли или не хватает прав Manage Channels / Manage Messages / Moderate Members.

## Cannot GET /health
Не применился актуальный архив или старый `src/web/server.js` не заменен.
