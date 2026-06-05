function docsHtml(escapeHtml) {
  const sections = [
    ['Быстрый старт', 'npm install → npm run deploy → npm run db:migrate → npm start. Для проверки перед запуском используй npm run check и npm run env:check.'],
    ['Безопасное обновление', 'Перед заменой файлов сделай /backup create или npm run safe:update. Никогда не удаляй .env, data/database.sqlite и data/backups.'],
    ['Структура проекта', 'src — код бота, data — база и бэкапы, logs — файлы логов, docs — инструкции, .env — секреты.'],
    ['Intents Discord', 'Message Content Intent нужен для AutoMod. Server Members Intent нужен для приветствия новых участников и диагностики участников.'],
    ['Права бота', 'Роль бота должна быть выше выдаваемых ролей. Нужны Manage Channels, Manage Messages, Moderate Members, Move Members, Embed Links и Attach Files.'],
    ['Web Panel', 'WEB_PASSWORD не должен быть admin на хостинге. WEB_SESSION_TOKEN должен быть длинной случайной строкой.'],
    ['Бэкапы', 'Используй /backup create перед обновлением. В веб-панели раздел Бэкапы позволяет скачать, восстановить и удалить копии.'],
    ['Хостинг', 'Для VPS используй pm2 и постоянный диск. Для Railway/Render обязательно проверь persistent storage, иначе SQLite может потеряться после redeploy.'],
    ['Типовые ошибки', 'TokenInvalid — неверный Bot Token. Used disallowed intents — не включены intents. ConnectTimeoutError — проблема сети Node.js → Discord API.'],
    ['Диагностика сети', 'Открой /network в веб-панели или запусти npm run net:check. Это проверяет именно Node.js → Discord, а не браузер → Discord.'],
    ['Тестовый режим', 'TEST_MODE=true удобно для проверки. Перед production выключи его и проверь /hosting-check.'],
  ];
  return `<div class="grid-2">${sections.map(([title, text]) => `<div class="card"><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(text)}</p></div>`).join('')}</div>`;
}
module.exports = { docsHtml };
