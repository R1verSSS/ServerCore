# Установка ServerCore

1. Установи Node.js LTS 20/22.
2. Распакуй проект.
3. Скопируй `.env.example` в `.env`.
4. Заполни `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.
5. Выполни:

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

Перед запуском можно проверить проект:

```bash
npm run check
npm run env:check
```
