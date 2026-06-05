# VPS deployment with PM2

```bash
sudo apt update
sudo apt install -y nodejs npm
npm install -g pm2
npm install
npm run deploy
npm run db:migrate
pm2 start src/index.js --name servercore
pm2 save
pm2 startup
```

Проверь `/hosting-check` после запуска.
