# Bothost Docker build fix

This build uses a Dockerfile optimized for Bothost:

- Node.js 20 Bookworm Slim
- `npm install --omit=dev --no-audit --no-fund` instead of `npm ci`
- creates runtime folders: `data`, `data/backups`, `data/exports`, `logs`
- starts via `npm start`, which runs `node http-wrapper.js`

Recommended Bothost settings:

- Platform: Discord
- Language: Node.js
- Use custom Dockerfile: enabled
- Main file: `http-wrapper.js`
- Port: `3000`
- Use domain: enabled
- Start command: `npm start` if requested

Recommended env for Bothost:

```env
DB_DRIVER=json
WEB_PANEL_ENABLED=true
WEB_PORT=3000
NODE_ENV=production
TEST_MODE=false
DEMO_MODE=false
```
