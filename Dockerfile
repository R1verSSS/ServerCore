FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

COPY package*.json ./

# Bothost can fail on npm install/npm ci with "Exit handler never called".
# Use pnpm via Corepack and verify that dependencies were really installed.
RUN corepack enable \
    && corepack prepare pnpm@9.15.4 --activate \
    && pnpm install --prod --no-frozen-lockfile --config.node-linker=hoisted --config.shamefully-hoist=true \
    && test -f node_modules/dotenv/package.json \
    && test -f node_modules/discord.js/package.json \
    && test -f node_modules/express/package.json \
    && test -f node_modules/@discordjs/voice/package.json \
    && test -f node_modules/play-dl/package.json \
    && test -f node_modules/libsodium-wrappers/package.json \
    && test -f node_modules/better-sqlite3/package.json

COPY . .

RUN mkdir -p data data/backups data/exports logs

EXPOSE 3000

CMD ["node", "http-wrapper.js"]
