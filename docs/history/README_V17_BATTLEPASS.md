# v17 — Seasons & Battle Pass

Версия v17 добавляет полноценный сезонный Battle Pass поверх существующей системы сезонов.

## Новые команды

```text
/battlepass info
/battlepass rewards
/battlepass claim track:free level:1
/battlepass claim track:premium level:1
/battlepass top
/battlepass premium user:@участник enabled:true
```

## Как работает прогресс

- Сезонный XP начисляется вместе с обычным XP.
- 1 уровень Battle Pass = 250 сезонного XP.
- Бесплатные награды доступны всем участникам.
- Премиум-награды доступны только участникам с включенным Premium Battle Pass.

## Награды

Бесплатная ветка содержит монеты, билеты, бусты, бейдж, титул и роль.

Премиум-ветка содержит дополнительные монеты, бусты, косметику профиля, заявку на кастомную роль и премиум-бейдж.

## Веб-панель

На странице `Сезон` добавлены:

- сезонный топ;
- уровень Battle Pass пользователя;
- статус Free/Premium;
- кнопка выдачи или снятия Premium Battle Pass.

## Обновление

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

`npm run setup` запускать не обязательно.
