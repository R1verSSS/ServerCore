
## v24.1.24 — UX Flow Smart Center Hotfix

- Исправлены кнопки под `/me`: `Магазин`, `Профиль`, `Достижения`, `Веб-панель`.
- Кнопки Smart Center переведены с `menu:quick:*` на `ux:quick:*`, чтобы не конфликтовать с публичным главным меню.
- Добавлен безопасный `safeDeferUpdate` для редактирования текущей ephemeral-панели без ошибки выполнения.


## v24.1 User Experience Flow Upgrade

- `/me` заменен на Smart User Center с динамическими Daily/Ticket/Shop действиями.
- Добавлены пользовательские списки: мои темы, мои тикеты, мои заявки.
- Forum-темы теперь сохраняются в базе и отображаются в Discord/Web.
- В пользовательской web-panel появился блок “Что дальше?” и web-Daily.
- Role panel переведена на select-menu с мультивыбором.
- Добавлены достижения за onboarding, первую forum-тему и выбор ролей.

Документация: `docs/user-experience-flow-upgrade.md`.

# Safe update checklist

1. Сделай бэкап: `/backup create name:before-update`.
2. Останови бота: `Ctrl + C`.
3. Распакуй архив с заменой файлов.
4. Не удаляй `.env` и папку `data`.
5. Выполни:

```bash
npm install
npm run safe:update
npm start
```

## v24.1.23 UX Flow Hotfix

Исправлены проблемы пользовательского потока:

- В веб-панели на странице **Мои темы** добавлена форма создания forum-темы: тип, название и описание. Покупка товаров для создания темы не требуется.
- В веб-панели на странице **Мои тикеты** добавлена полноценная форма тикета: тип обращения, приоритет, краткая тема и подробное описание.
- Discord-кнопки создания тикета теперь открывают форму, а не создают пустой тикет.
- Добавлена обработка кнопки `ticket:create` для опубликованных панелей поддержки.
- В блоке **Мои списки** добавлена кнопка **Создать тему**, которая открывает forum-панель.
- Добавлена обработка кнопки `threadpanel:open`, чтобы пользователь мог открыть создание forum-тем из `/me` без поиска отдельной панели.

После обновления рекомендуется выполнить `npm run deploy`, `npm run setup` и заново опубликовать панели `/threadpanel post`, `/menu post`, `/webpanel post`.



## v24.1.25 Smart Center Button Fix

Исправлена ошибка кнопок под `/me` для разделов **Магазин**, **Профиль**, **Достижения** и **Веб-панель**.
Причина была не в отсутствии панелей, а в том, что быстрые действия Smart Center вызывали `syncMemberLevelRoles`, который использовался в `userActionService`, но не экспортировался из `xpService`. Из-за этого обработчик падал до построения нужной панели.

После обновления заново запустите бота и вызовите новую команду `/me`. Старые уже отправленные сообщения можно удалить.

## v24.1.27 Hosting Self-check & Applications Forum Fix

- Исправлен self-check хранилища: если `DB_DRIVER=json`, JSON-хранилище считается штатным режимом для Bothost/Node 20, а не ошибкой SQLite.
- Если SQLite включен через `DB_DRIVER=sqlite`, но недоступен, self-check теперь показывает корректное предупреждение и причину fallback.
- Добавлена настройка `applicationsChannelId` / `APPLICATIONS_CHANNEL_ID` для канала заявок.
- Канал заявок теперь может быть не только текстовым каналом, но и Forum-каналом.
- Для текущего сервера добавлен ID Forum-канала заявок: `1512791242000564229`.
- Публикация заявок теперь сначала ищет канал по ID, затем по названию `📨・заявки`.

После обновления на хостинге рекомендуется указать в `.env`:

```env
DB_DRIVER=json
APPLICATIONS_CHANNEL_ID=1512791242000564229
```

Затем выполнить `npm install`, `npm run setup` и перезапустить бота.

## v24.1.28 — SQLite migration + Forum applications channel

- Добавлена поддержка SQLite на Node.js 20 через `better-sqlite3`.
- `DB_DRIVER=sqlite` теперь реально переводит сохраняемые данные из JSON в `data/database.sqlite`.
- Команда `npm run db:migrate` переносит текущее состояние из `data/database.json` в SQLite.
- Добавлена поддержка `APPLICATIONS_CHANNEL_ID=1512791242000564229` для Forum-канала заявок.
- Self-check теперь принимает Forum-канал заявок как корректный канал.

## v24.1.29 — Bothost pnpm hoisted dependency fix

- Добавлен `.npmrc` для hoisted-установки зависимостей через pnpm на Bothost.
- Dockerfile теперь принудительно использует `node-linker=hoisted`.
- Проверка зависимостей в Dockerfile усилена: проверяется наличие `package.json`, а не только пустой папки.
- Исправляет runtime-ошибку `Cannot find module 'dotenv'` при запуске `npm run db:migrate`.
- Реальный `.env` исключён из архива; используйте переменные окружения Bothost.

## v24.1.30 — Ticket Flow Upgrade

- Активные тикеты больше не создаются в категории модерации.
- Для активных тикетов используется отдельная категория `🎫 ПОДДЕРЖКА`.
- Канал `📨・заявки` остаётся только для заявок/анкет.
- Закрытые тикеты сохраняются в архивный канал или Forum `📁・тикеты`.
- Добавлены переменные `TICKET_ACTIVE_CATEGORY_*` и `TICKET_ARCHIVE_CHANNEL_*`.


## v24.1.32 — Application routing hotfix

- Исправлен экспорт `findApplicationsChannel`, из-за которого бот падал при запуске.
- Обновлена ссылка веб-панели: `https://bot-1780769817-2659-r1vers.bothost.tech/login`.
- Жалобы из панели заявок направляются в Forum `COMPLAINTS_CHANNEL_ID=1512791244965806170`.
- Остальные заявки направляются в Forum `APPLICATIONS_CHANNEL_ID=1512791242000564229`.

## v24.1.37 — Music diagnose slash command

- Добавлена Discord slash-подкоманда `/music diagnose`.
- Сохранён терминальный скрипт `npm run voice:diagnose`.
- Сохранены Dockerfile build tools для Bothost: `python3`, `make`, `g++`, `pkg-config`, `libopus-dev`, `libsodium-dev`, `ffmpeg`.

## v24.1.39 — Music modal play-dl validation fix

- Исправлен оставшийся вызов `play.yt_validate(...).catch(...)` в `musicService.js`.
- Проверка YouTube-ссылки теперь работает одинаково для slash-команды и modal-формы.
