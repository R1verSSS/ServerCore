FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        make \
        g++ \
        pkg-config \
        ffmpeg \
        libsodium23 \
        libsodium-dev \
        libopus-dev \
        dnsutils \
        netcat-openbsd \
        iputils-ping \
    && python3 --version \
    && ffmpeg -version >/dev/null \
    && rm -rf /var/lib/apt/lists/*

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
    && test -f node_modules/sodium-native/package.json \
    && test -f node_modules/@discordjs/opus/package.json \
    && test -f node_modules/opusscript/package.json \
    && test -f node_modules/tweetnacl/package.json \
    && test -f node_modules/better-sqlite3/package.json \
    && test -f node_modules/@discordjs/opus/prebuild/node-v115-napi-v3-linux-x64-glibc-2.36/opus.node || test -f node_modules/@discordjs/opus/build/Release/opus.node

COPY . .

RUN mkdir -p data data/backups data/exports logs

EXPOSE 3000

CMD ["node", "http-wrapper.js"]
