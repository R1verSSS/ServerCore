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
    && pnpm install --prod --no-frozen-lockfile \
    && test -d node_modules/dotenv \
    && test -d node_modules/discord.js \
    && test -d node_modules/express

COPY . .

RUN mkdir -p data data/backups data/exports logs

EXPOSE 3000

CMD ["node", "http-wrapper.js"]
