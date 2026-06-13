# ServerCore — описание для портфолио

## One-liner

**ServerCore** — Discord management platform на Node.js: бот, web-панель, роли доступа, тикеты, экономика, модерация, SQLite, Docker и production diagnostics.

## Короткое описание

Разработал платформу для управления Discord-сообществом. Проект объединяет Discord-бота на `discord.js v14`, Express web-панель, SQLite-хранилище, Docker-запуск, систему ролей доступа, пользовательский личный кабинет, тикеты, заявки, onboarding, экономику, магазин, достижения, модерацию, backup/export и диагностику хостинга.

Основной фокус проекта — не просто набор slash-команд, а полноценный пользовательский путь: участник может управлять профилем, ролями, тикетами, темами, Daily, магазином и личным кабинетом через кнопки, select-menu и web-интерфейс.

## Что я делал

- Спроектировал модульную структуру проекта: `commands`, `services`, `web`, `tools`, `config`.
- Реализовал Discord-интерфейс: slash-команды, context-menu, кнопки, select-menu, modal forms и forum-thread сценарии.
- Реализовал web-панель администратора и пользователя на Express.
- Добавил хранение данных в SQLite с fallback на JSON для ограниченных хостингов.
- Настроил Docker-сборку и docker-compose запуск.
- Добавил backup/export, audit log, health-check, hosting-check и network diagnostics.
- Настроил централизованную модель доступа для пользователей, helper, moderator, admin и owner.
- Проработал UX: Smart User Center, динамические кнопки, onboarding, подсказки “что дальше?”.
- Решал production-проблемы: Discord interaction timeout, voice/UDP диагностика, Node.js 20 compatibility, установка native-зависимостей.

## Технический стек

- **Backend:** Node.js 20, JavaScript, CommonJS.
- **Discord:** discord.js v14, slash commands, components, modals, forum channels, voice.
- **Web:** Express.
- **Storage:** SQLite, better-sqlite3, JSON fallback.
- **Infrastructure:** Docker, docker-compose, PM2 config, GitHub Actions.
- **Operations:** health-check, hosting-check, network-check, production-check, backup/export.

## Какие задачи решает проект

- Упрощает управление Discord-сервером.
- Снижает нагрузку на администрацию за счет тикетов, заявок, AutoMod и панелей.
- Улучшает вовлеченность участников через XP, Daily, магазин, достижения, квесты и onboarding.
- Дает администрации web-интерфейс для контроля пользователей, модулей, логов, бэкапов и диагностики.
- Показывает production-подход к pet-проекту: Docker, CI/CD, миграции, документация, диагностика, безопасность `.env`.

## Что показать на собеседовании

1. **README** — как продукт упакован и запускается.
2. **Архитектуру** — `docs/ARCHITECTURE.md`.
3. **Список модулей** — `docs/MODULES.md`.
4. **Docker и CI/CD** — `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`.
5. **Базу данных** — `src/services/dataStore.js`, `docs/DATABASE_AND_MIGRATIONS.md`.
6. **Роли доступа** — `src/services/accessControlService.js`, `docs/ROLES_ACCESS.md`.
7. **Проблемы, которые решались** — `docs/PROBLEMS_SOLVED.md`.
8. **Скриншоты** — `docs/SCREENSHOTS.md` и `docs/assets/screenshots/`.

## Вариант описания в резюме

> ServerCore — Discord management platform на Node.js. Реализовал Discord-бота и Express web-панель для управления сервером: роли доступа, тикеты, заявки, профили, XP, экономика, магазин, достижения, onboarding, модерация, backup/export, SQLite migration, Docker и CI/CD. Проектировал UX-flow через Discord buttons/select-menu и личный кабинет, решал production-проблемы хостинга, Discord interactions, voice diagnostics и безопасной конфигурации окружения.

## Вариант описания в GitHub About

```text
Discord management platform: Node.js + discord.js v14 + Express + SQLite + Docker. Includes web panel, tickets, roles, moderation, economy, achievements, onboarding, backups and production diagnostics.
```
