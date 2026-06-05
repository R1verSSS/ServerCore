FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false

COPY package*.json ./

# Bothost sometimes fails on `npm ci` with "Exit handler never called".
# Use plain npm install for a more stable Docker build on this hosting.
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p data data/backups data/exports logs

EXPOSE 3000

CMD ["npm", "start"]
