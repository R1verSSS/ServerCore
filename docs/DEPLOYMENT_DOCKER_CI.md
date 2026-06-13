# Docker, запуск и CI/CD

## Локальный запуск

```bash
npm install
cp .env.example .env
npm run deploy
npm run db:migrate
npm start
```

## Docker-запуск

```bash
docker compose up -d --build
```

`docker-compose.yml` использует:

```yaml
services:
  servercore:
    build: .
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

## Dockerfile

Контейнер основан на `node:20-bookworm-slim` и устанавливает системные зависимости, которые нужны для Discord Voice и диагностики:

- `ffmpeg`;
- `libsodium23`, `libsodium-dev`;
- `libopus-dev`;
- `python3`, `make`, `g++`, `pkg-config`;
- `dnsutils`, `netcat-openbsd`, `iputils-ping`.

Зависимости устанавливаются через pnpm/Corepack, чтобы обходить проблемы некоторых hosting-панелей с `npm install`.

## Production scripts

```bash
npm run check             # синтаксическая проверка команд/сервисов
npm run env:check         # проверка переменных окружения
npm run hosting:check     # проверка условий хостинга
npm run net:check         # диагностика сети
npm run doctor            # комплексная диагностика
npm run production:check  # production-проверка
npm run db:migrate        # миграция в SQLite
npm run db:backup         # backup базы
```

## CI/CD

Workflow находится здесь:

```text
.github/workflows/ci.yml
```

Он выполняет:

1. установку зависимостей;
2. синтаксическую проверку;
3. env-check на example-конфигурации;
4. сборку Docker-образа.

## GitHub Actions workflow

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: cp .env.example .env
      - run: npm run env:check
      - run: docker build -t servercore-ci .
```

## Что не делать в CI

- Не запускать реального Discord-бота без тестового сервера.
- Не хранить `DISCORD_TOKEN` в репозитории.
- Не коммитить `.env`, runtime-базу, backup и logs.

## Что улучшить дальше

- Добавить тесты сервисов.
- Добавить отдельный deploy job для VPS.
- Добавить Docker image publish в GitHub Container Registry.
- Добавить scheduled workflow для проверки зависимостей.
