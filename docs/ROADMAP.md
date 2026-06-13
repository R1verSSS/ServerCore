# Roadmap ServerCore

## Done / текущее состояние

- Discord bot на `discord.js v14`.
- Express web-панель администратора и пользователя.
- Slash-команды, context-menu, кнопки, select-menu, modal forms.
- Smart User Center `/me`.
- XP, уровни, профили, карточки, достижения, бейджи.
- Экономика, Daily, магазин, товар дня, инвентарь, история покупок.
- Тикеты, заявки, жалобы, предложения, polls.
- Forum threads и пользовательские списки “Мои темы / тикеты / заявки”.
- Onboarding с наградой и бейджем.
- Роли и access-control.
- Модерация, AutoMod, cases, notes, appeals.
- Events, tournaments, clans, LFG.
- Temp voice rooms.
- Backup/export, audit, health, hosting/network diagnostics.
- SQLite + JSON fallback.
- Dockerfile и docker-compose.
- CI workflow.

## Next: Portfolio polish

- Добавить реальные скриншоты в `docs/assets/screenshots/`.
- Заполнить GitHub About и topics.
- Добавить короткое demo-video или GIF.
- Добавить badges в README: Node.js, Docker, CI, License.
- Проверить, что публичный репозиторий не содержит `.env`, runtime-базу и приватные данные.

## Next: Engineering quality

- Добавить unit tests для сервисов:
  - `dataStore`;
  - `accessControlService`;
  - `economyService`;
  - `ticketService`;
  - `uxFlowService`.
- Добавить integration tests для web routes.
- Ввести ESLint/Prettier.
- Разделить крупные web route handlers на controllers.
- Добавить typed config validation.

## Next: Database

- Добавить таблицу `schema_migrations`.
- Нормализовать таблицы для tickets, applications, moderation cases, shop, inventory.
- Добавить rollback-план для миграций.
- Добавить seed/demo mode без персональных данных.

## Next: Observability

- Structured JSON logs.
- Metrics endpoint.
- Uptime checks.
- Error dashboard в web-панели.
- Более детальный audit trail для web-действий.

## Next: Deployment

- Добавить publish Docker image в GitHub Container Registry.
- Подготовить VPS deploy guide с systemd/PM2.
- Добавить production `.env` checklist.
- Добавить backup restore guide.

## Next: Music

- Рассмотреть Lavalink как отдельный backend.
- Разделить music provider interface.
- Добавить graceful degradation: если YouTube недоступен, показывать понятное состояние модуля.
- Добавить отдельный статус music module в web-панель.

## Long-term

- Multi-guild режим.
- OAuth2 Discord login для web-панели.
- Расширенный dashboard с графиками активности.
- Marketplace шаблонов ролей, тикетов и onboarding.
- Plugin/module system для включения функций по конфигурации.
