require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { permissionBitsForCommand, permissionBitsForContext } = require('./services/accessControlService');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID in .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  const json = command.data.toJSON();
  const isContext = json.type === 2 || json.type === 3;
  const bits = isContext ? permissionBitsForContext(json.name) : permissionBitsForCommand(json.name);
  if (bits) json.default_member_permissions = String(bits);
  commands.push(json);
}

const rest = new REST({ version: '10', timeout: Number(process.env.DISCORD_REST_TIMEOUT || 60000) }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application command(s).`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('Slash/context commands deployed successfully.');
  } catch (error) {
    console.error(error);
  }
})();
