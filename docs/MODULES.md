# Реализованные модули ServerCore

Проект состоит из Discord-команд, web-панели, сервисного слоя и эксплуатационных CLI-инструментов.

## Пользовательские модули

| Модуль | Что делает |
|---|---|
| Smart User Center | `/me`: профиль, баланс, Daily, тикеты, темы, заявки, быстрые действия |
| Profile / Profile Card | профиль пользователя, карточка, кастомизация, бейджи |
| XP / Levels | начисление XP, уровни, лидерборды |
| Achievements / Badges | достижения за действия и отображение бейджей |
| Reputation | система репутации между пользователями |
| Economy / Daily | монеты, ежедневная награда, история операций |
| Shop / Inventory | магазин, товар дня, покупки, инвентарь, использование предметов |
| Battle Pass / Season | сезонный прогресс и награды |
| Quests / Mini-games | игровые активности, квесты и статистика |
| Notifications | пользовательские уведомления и лог уведомлений |
| Web Account | вход в web-панель через пароль или одноразовый код |
| User Web Panel | личный кабинет, профиль, баланс, тикеты, темы, заявки, покупки |

## Community / Server Management

| Модуль | Что делает |
|---|---|
| Tickets | создание, обработка и архивирование обращений |
| Applications | заявки пользователей, включая forum-канал |
| Suggestions / Polls | предложения, голосования и обратная связь |
| Forum Threads | панели создания forum-тем, история “Мои темы” |
| LFG | поиск игроков / группы |
| Events | серверные события |
| Tournaments | турниры |
| Clans | кланы / группы пользователей |
| Roles Panel | выдача ролей через панели и select-menu |
| Onboarding | стартовый чеклист, награды и бейдж новичка |
| Temp Voice | временные голосовые комнаты и управление комнатой |
| Channel Rules | правила поведения и ограничения в каналах |
| Bot Quick Menu | закрепленное быстрое меню бота в Discord |

## Модерация и безопасность

| Модуль | Что делает |
|---|---|
| Moderation | warn, mute, unmute, kick, ban, clear |
| Cases | история модераторских кейсов |
| Notes / Appeals | заметки модерации и апелляции |
| AutoMod | правила автоматической модерации и логирование |
| Context-menu actions | быстрые действия по пользователю или сообщению |
| Access Control | единая проверка прав для команд, кнопок и web-действий |
| Protected Channels | защита информационных и панельных каналов от мусора |
| Audit | журнал административных действий |
| Maintenance | режим обслуживания |

## Web/Admin/Operations

| Модуль | Что делает |
|---|---|
| Admin Web Panel | web-интерфейс администратора |
| Commands Reference | справочник команд |
| Module Settings | включение/выключение модулей |
| Panels Center | публикация и обновление Discord-панелей |
| Backup / Export | резервные копии и экспорт данных |
| Health Check | проверка состояния проекта |
| Hosting Check | проверка хостинга и runtime-условий |
| Network Check | диагностика сети, DNS, UDP |
| Production Check | предрелизные проверки |
| Update Check / Safe Update | безопасные проверки перед обновлением |
| Doctor | комплексная диагностика проекта |
| Docs Page | встроенная web-документация |

## Music / Voice

| Модуль | Что делает |
|---|---|
| Music Command | управление проигрыванием музыки |
| Music Panel | Discord-панель для музыки |
| Discord Voice Diagnostics | проверка opus, sodium, UDP, ffmpeg |
| YouTube Fallback | попытка использовать альтернативный provider для YouTube |

## Реальные файлы команд

В проекте сейчас 83 command-файла в `src/commands/`.

```text
achievements, appeal, application, applications, apply, applypanel, automod,
backup, badges, balance, balance-history, ban, battlepass, buy, case, cases,
clan, clear, close, cosmetics, daily, dbstatus, event, export, game,
gamepanel, gift, help, hosting-check, integration, inventory, kick, lfg,
maintenance, me, menu, modpanel, music, musicpanel, mute, network-check,
note, notify, ping, poll, production-check, profile, profilecard,
profilecustomize, quest, rank, remind, rep, reputation, roles, season,
settings, setup-wizard, shop, shoppanel, suggest, suggestion, suggestions,
threadpanel, ticket, top, tournament, unmute, update-check, use, voice,
vps-check, warn, warnings, warnremove, webaccount, webpanel
```

## Реальные файлы сервисов

В проекте сейчас 58 service-файлов в `src/services/`.

```text
accessControlService, achievementService, adminOpsService, applicationService,
auditService, automodService, backupService, battlePassService,
botQuickMenuService, channelRulesService, clanService, commandReferenceService,
dataStore, docsService, economyService, eventService, fileLogService,
gamePanel, gameService, healthCheckService, hostingCheckService,
integrationService, inventoryService, lfgService, logService,
maintenanceService, managementUxService, moderationPanel, moderationService,
moduleService, musicService, networkCheckService, notificationService,
onboardingService, productionCheckService, profileCardService,
profileCustomizationService, protectedChannelService, questService,
reputationService, responseService, rolePanel, seasonService,
selfCheckService, settingsService, setupWizardService, shopPanel,
suggestionService, tempVoiceService, threadForumService, ticketService,
tournamentService, userActionService, userMenuService, uxFlowService,
webAccountService, webPanelMenuService, xpService
```
