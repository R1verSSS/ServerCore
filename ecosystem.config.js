module.exports = {
  apps: [
    {
      name: 'servercore-discord-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--dns-result-order=ipv4first'
      }
    }
  ]
};
