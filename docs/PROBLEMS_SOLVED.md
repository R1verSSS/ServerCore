# Какие проблемы решались в ServerCore

Этот документ нужен для портфолио: он показывает, что проект — не просто набор команд, а практическая работа с архитектурой, UX, инфраструктурой и production-ошибками.

## 1. Пользователи не должны помнить десятки команд

### Проблема

Когда функций много, участник не понимает, какую команду вводить: профиль, daily, магазин, тикет, роли, web-панель, заявки, темы.

### Решение

- Smart User Center через `/me`.
- Динамические кнопки Daily / Ticket / Shop.
- Подсказки “что дальше?” после действий.
- Единая панель `🤖 Быстрое меню бота`.
- Web user panel как личный кабинет.

### Польза

Пользователь действует через понятные кнопки и меню, а не изучает список команд.

## 2. Нужна единая web-панель для управления сервером

### Проблема

Администрировать сервер только через Discord-команды неудобно: сложно смотреть пользователей, логи, модули, настройки, бэкапы и диагностику.

### Решение

Добавлена Express web-панель:

- admin dashboard;
- users/profiles/economy/shop/tickets/applications;
- access matrix;
- commands/docs;
- audit/logs/backups;
- health/hosting/network diagnostics;
- user-panel для обычных участников.

## 3. JSON-хранилище стало ограничением

### Проблема

JSON удобен на старте, но плохо подходит для production: риск повреждения файла, сложнее делать выборки, нет нормальной миграционной модели.

### Решение

- Добавлен SQLite через `node:sqlite` / `better-sqlite3`.
- Оставлен JSON fallback для хостингов с ограничениями.
- Добавлена команда `npm run db:migrate`.
- Добавлен backup/export.

## 4. Нужно безопасно работать с `.env`

### Проблема

В `.env` хранятся токены Discord, пароли web-панели и session secrets. Такой файл нельзя публиковать.

### Решение

- `.env` добавлен в `.gitignore`.
- Созданы `.env.example` и `.env.production.example`.
- Подготовлен очищенный portfolio-архив без `.env`, `.git`, runtime-базы и backup-файлов.

## 5. Discord interactions могут истекать

### Проблема

Discord interaction имеет ограниченное время ответа. При долгих операциях появляются ошибки типа expired/unknown interaction.

### Решение

- Используются safe helpers для replies/edit/update.
- Для component-interactions добавлена безопасная обработка `deferUpdate`.
- UX-панели обновляют текущее сообщение, а не создают конфликтующие ответы.

## 6. Хостинг может отличаться от локального окружения

### Проблема

На хостинге могут отличаться Node.js, native dependencies, сеть, UDP, права файловой системы и package manager.

### Решение

- Dockerfile на Node.js 20.
- Системные зависимости для voice/music: ffmpeg, opus, sodium, build tools.
- PNPM/Corepack workaround для проблем установки.
- Скрипты `hosting:check`, `net:check`, `doctor`, `production:check`.

## 7. Discord Voice и YouTube audio нестабильны на shared hosting

### Проблема

Музыкальный модуль зависит от Discord Voice UDP, ffmpeg, opus/sodium и доступности YouTube audio. На shared hosting возможны ограничения IP или UDP.

### Решение

- Добавлены voice/music diagnostics.
- Добавлены env-параметры `MUSIC_ENABLED`, `MUSIC_DEBUG`, `MUSIC_FORCE_IPV4`, `MUSIC_CONNECT_TIMEOUT`.
- Добавлен fallback provider для YouTube.
- Подготовлены инструкции для обращения в поддержку хостинга.

## 8. Нужна модель прав доступа

### Проблема

Если команды и кнопки доступны всем, обычный участник может нажать старую админскую кнопку или вызвать действие не своего уровня.

### Решение

- Централизованный `accessControlService`.
- Уровни Member / VIP / Helper / Moderator / Admin / Owner.
- Проверка не только команд, но и кнопок, select-menu и web-действий.

## 9. Проект нужно показывать как продукт

### Проблема

Pet-проект без README, архитектуры, Docker, CI/CD и скриншотов выглядит как “набор файлов”, даже если внутри много работы.

### Решение

Добавлена упаковка для портфолио:

- новый product README;
- архитектурная схема;
- список модулей;
- Docker/CI/CD документация;
- database/migrations документация;
- роли доступа;
- roadmap;
- screenshot checklist;
- портфолио-описание.
