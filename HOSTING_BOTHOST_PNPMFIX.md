# Bothost pnpm Docker fix

Если сборка на Bothost падает или проходит без установки зависимостей с ошибкой npm:

```text
npm error Exit handler never called!
Cannot find module 'dotenv'
```

используйте этот Dockerfile. Он устанавливает зависимости через pnpm/Corepack и дополнительно проверяет наличие `dotenv`, `discord.js` и `express`.

Настройки хостинга:

```text
Использовать собственный Dockerfile: включено
Главный файл: http-wrapper.js
Порт: 3000
Использовать домен: включено
```

Переменные окружения для Bothost:

```env
DB_DRIVER=json
WEB_PORT=3000
NODE_ENV=production
TEST_MODE=false
DEMO_MODE=false
```

После обновления репозитория сделайте Redeploy.
