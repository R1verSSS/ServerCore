# v24.1.37 — Music diagnose slash command

Добавлена подкоманда Discord:

```text
/music diagnose
```

Также сохранены исправления Dockerfile для Bothost voice-сборки:

- `python3`
- `make`
- `g++`
- `pkg-config`
- `libopus-dev`
- `libsodium-dev`
- `ffmpeg`

После загрузки на GitHub нужно выполнить Rebuild/Redeploy и затем:

```bash
npm run deploy
```

После этого `/music diagnose` должен появиться в Discord.
