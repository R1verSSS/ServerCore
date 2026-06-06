# ServerCore v24.1 Server Management UX Upgrade

Пакет улучшает управление сервером без смены основной архитектуры.

## Что добавлено

1. Улучшенный onboarding новичков с чек-листом: правила, роли, меню, daily, профиль.
2. Шаблоны тикетов: тех. проблема, жалоба, вопрос, заявка, партнерство, другое.
3. История экономики: daily и покупки записываются в журнал. Discord: `/balance history:true`. Web: `/economy-history`.
4. Товар дня и скидки магазина. Настройки: `SHOP_DAILY_DEAL_ENABLED`, `SHOP_DAILY_DEAL_DISCOUNT`.
5. Центр управления Discord-панелями 2.0: `/panel-center`.
6. Расширенные правила каналов остаются в `/channel-rules`.
7. Улучшенная страница ролей и иерархии: `/roles`.
8. Страница контроля onboarding: `/onboarding`.

## После обновления

```bash
npm run check
npm run deploy
npm run setup
```

На хостинге Bothost после push в GitHub сделай Redeploy.
