# Архитектура ServerCore

ServerCore построен как модульная Node.js-платформа: Discord-бот и Express web-панель используют общий service layer и единое хранилище данных.

## Общая схема

```mermaid
flowchart LR
    subgraph Discord[Discord]
        User[Участники сервера]
        Staff[Модераторы / админы]
        Channels[Каналы, forum, voice]
    end

    subgraph Runtime[Node.js runtime]
        Bot[Discord bot\ndiscord.js v14]
        Web[Express web panel]
        Commands[src/commands]
        Services[src/services]
        Tools[src/tools]
    end

    subgraph Storage[Storage]
        SQLite[(SQLite\napp_state + users + audit_log)]
        Json[(JSON fallback)]
        Files[(backups / exports / logs)]
    end

    subgraph Infrastructure[Infrastructure]
        Docker[Docker / docker-compose]
        Hosting[Bothost / VPS]
        CI[GitHub Actions]
    end

    User --> Channels --> Bot
    Staff --> Channels --> Bot
    Staff --> Web
    Bot --> Commands --> Services
    Web --> Services
    Tools --> Services
    Services --> SQLite
    Services --> Json
    Services --> Files
    Runtime --> Docker --> Hosting
    CI --> Runtime
```

## Основные слои

### 1. Discord Interface

Слой команд и интерактивных компонентов:

- slash-команды в `src/commands/`;
- кнопки, select-menu и modal forms;
- context-menu действия для модерации и профилей;
- forum-thread flow для заявок, вопросов и пользовательских тем;
- voice-flow для временных комнат и музыкального модуля.

### 2. Web Interface

Express web-панель в `src/web/server.js`:

- admin dashboard;
- user panel;
- health/hosting/network pages;
- users, profiles, economy, shop, tickets, applications;
- commands/docs/project pages;
- backups, audit, maintenance.

### 3. Service Layer

`src/services/` содержит бизнес-логику. Команды и web routes не должны напрямую реализовывать сложные сценарии — они вызывают сервисы.

Примеры сервисов:

- `userMenuService`, `uxFlowService` — пользовательский путь и “Мой центр”;
- `ticketService`, `applicationService`, `threadForumService` — обращения, заявки и forum-темы;
- `economyService`, `inventoryService`, `shopPanel` — монеты, покупки, инвентарь;
- `accessControlService` — централизованная проверка доступа;
- `dataStore` — слой хранения данных;
- `backupService`, `healthCheckService`, `hostingCheckService`, `networkCheckService` — эксплуатация и диагностика.

### 4. Storage Layer

Основное хранилище — SQLite. Для совместимости с ограниченными хостингами оставлен JSON fallback.

SQLite используется через:

- `node:sqlite`, если доступен;
- `better-sqlite3`, если `node:sqlite` недоступен;
- JSON fallback, если SQLite не поднялся.

### 5. Infrastructure Layer

Инфраструктурный слой:

- `Dockerfile` на `node:20-bookworm-slim`;
- `docker-compose.yml` с volume для `data` и `logs`;
- `.env.example` / `.env.production.example`;
- GitHub Actions workflow для CI;
- scripts в `package.json` для deploy, migration, backup и diagnostics.

## Поток пользовательского действия

Пример: пользователь нажимает Daily в “Мой центр”.

```mermaid
sequenceDiagram
    participant U as User
    participant D as Discord interaction
    participant B as Bot command/component
    participant UX as uxFlowService
    participant Eco as economyService
    participant DB as dataStore / SQLite

    U->>D: Нажимает кнопку Daily
    D->>B: component interaction
    B->>UX: обработать пользовательское действие
    UX->>Eco: проверить cooldown и начислить награду
    Eco->>DB: прочитать/обновить пользователя
    DB-->>Eco: актуальное состояние
    Eco-->>UX: результат Daily
    UX-->>B: embed + next actions
    B-->>D: обновить сообщение
    D-->>U: результат + кнопки “что дальше?”
```

## Почему такая архитектура подходит для портфолио

Проект демонстрирует несколько инженерных направлений одновременно:

- event-driven integration с Discord;
- backend API/web-panel на Express;
- хранение данных и миграции;
- доступы и модераторские роли;
- контейнеризация;
- production diagnostics;
- UX-проектирование пользовательского пути.

## Файл схемы

Для GitHub README можно использовать Mermaid-блок выше. Отдельный SVG-файл лежит здесь:

```text
docs/assets/architecture.svg
```
