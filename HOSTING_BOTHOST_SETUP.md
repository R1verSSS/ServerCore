# ServerCore hosting setup for BotHost-like panels

## Recommended fields

- Platform: Discord
- Language: Node.js
- Location: Netherlands / Amsterdam
- Git URL: `https://github.com/R1verSSS/ServerCore.git`
- Branch: `main`
- Main file / entry point: `http-wrapper.js`
- Install command: `npm install`
- Start command: `npm start`
- Web/domain: enabled
- Web port: `3000`
- Custom Dockerfile: disabled for first deploy

If the host does not have separate command fields, keep `Main file` as `http-wrapper.js`. The project also supports `src/index.js`, but `http-wrapper.js` is safer on this hosting because some panels try to run `/app/http-wrapper.js` when web-domain support is enabled.

## Environment variables

Use a new token after Discord Developer Portal → Bot → Reset Token.

```env
DISCORD_TOKEN=NEW_BOT_TOKEN
CLIENT_ID=1512166108948598824
GUILD_ID=1512164522377478285

WEB_PANEL_ENABLED=true
WEB_PORT=3000
WEB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
WEB_SESSION_TOKEN=CHANGE_ME_LONG_RANDOM_SECRET

DB_DRIVER=json
SQLITE_PATH=./data/database.sqlite

NODE_ENV=production
TEST_MODE=false
DEMO_MODE=false

DISCORD_REST_TIMEOUT=60000
DISCORD_LOGIN_MAX_RETRIES=10

WEB_LOGIN_LIMIT=5
WEB_LOGIN_LOCK_MINUTES=30
```

## Why DB_DRIVER=json here?

The shown hosting logs use Node.js v20.20.2. This version does not provide the built-in `node:sqlite` module used by the project. JSON mode is the safest option for this hosting. On a VPS with Node.js 22+ you can switch to:

```env
DB_DRIVER=sqlite
```

## After first successful deploy

Run slash command deploy once if the hosting terminal allows it:

```bash
npm run deploy
```

If terminal commands are not available, redeploy after setting all environment variables. Then in Discord check:

```text
/ping
/dbstatus
/hosting-check
```

## Important

Do not upload `.env`, `node_modules`, logs, backups, or real database files to GitHub.
