# v18 Application Forms

Добавлено:

- `/apply form` — открывает Discord Modal-форму заявки.
- `/apply quick` — быстрый вариант заявки одним текстом.
- `/applypanel` — отправляет публичную панель с кнопками заявок.
- Новые типы заявок: модератор, партнерство, кастомная роль, турнир, жалоба, идея.
- Администрация принимает или отклоняет заявки кнопками, slash-командой или через веб-панель.
- При решении бот пытается отправить пользователю уведомление в личные сообщения.
- Веб-панель `/applications` получила отправку панели заявок, комментарий к решению и понятные ответы.

## Проверка

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

В Discord:

```text
/apply form type:Идея
/applypanel
/applications status:open
/application accept id:1 comment:Принято, спасибо за заявку
```

В веб-панели:

```text
http://localhost:3000/applications
```
