# Hosting Discord Bot

## Required environment variables

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_server_id
DB_DRIVER=sqlite
SQLITE_PATH=./data/database.sqlite
WEB_PANEL_ENABLED=true
WEB_PORT=3000
WEB_PASSWORD=change_me
WEB_SESSION_TOKEN=long_random_secret
```

## Local commands

```bash
npm install
npm run deploy
npm run db:migrate
npm start
```

## Database backup

```bash
npm run db:backup
```

The backup file will be created in `data/backups/`.

## Important

For AutoMod enable **Message Content Intent** in Discord Developer Portal.
For member/role management enable **Server Members Intent**.
