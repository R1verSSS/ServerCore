const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { setUserPassword, generateLoginCode, getAccount, disableAccount } = require('../services/webAccountService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webaccount')
    .setDescription('Управление пользовательским входом в веб-панель')
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Проверить статус веб-аккаунта'))
    .addSubcommand(sub => sub
      .setName('password')
      .setDescription('Создать или изменить пароль для пользовательской веб-панели')
      .addStringOption(option => option
        .setName('value')
        .setDescription('Новый пароль, минимум 6 символов')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('login-code')
      .setDescription('Получить одноразовый код входа в пользовательскую веб-панель'))
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Отключить свой пользовательский веб-аккаунт')),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const user = interaction.user;

    if (sub === 'password') {
      const password = interaction.options.getString('value');
      const result = setUserPassword(user.id, user.username, password);
      if (!result.ok && result.reason === 'short_password') {
        await safeEdit(interaction, { content: '❌ Пароль должен быть не короче 6 символов.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, {
        content: `✅ Пароль пользовательской веб-панели создан/обновлен.\n\nЛогин для сайта: \`${user.id}\`\nПароль: тот, который ты указал в команде.\n\nОткрывай веб-панель и выбирай режим **Пользователь**.`,
        embeds: [],
        components: []
      });
      return;
    }

    if (sub === 'login-code') {
      const result = generateLoginCode(user.id, user.username);
      await safeEdit(interaction, {
        content: `🔐 Одноразовый код входа: **${result.code}**\n\nЛогин: \`${user.id}\`\nКод действует примерно **${result.minutes} минут**. После успешного входа код будет сброшен.`,
        embeds: [],
        components: []
      });
      return;
    }

    if (sub === 'disable') {
      const result = disableAccount(user.id);
      await safeEdit(interaction, { content: result.ok ? '✅ Пользовательский веб-аккаунт отключен.' : 'ℹ️ Активный веб-аккаунт не найден.', embeds: [], components: [] });
      return;
    }

    const account = getAccount(user.id);
    const embed = new EmbedBuilder()
      .setColor(account?.enabled ? 0x57F287 : 0xFEE75C)
      .setTitle('🌐 Пользовательская веб-панель')
      .setDescription(account ? 'Веб-аккаунт найден.' : 'Веб-аккаунт еще не создан.')
      .addFields(
        { name: 'Логин', value: `\`${user.id}\``, inline: false },
        { name: 'Пароль', value: account?.hasPassword ? '✅ задан' : '❌ не задан', inline: true },
        { name: 'Статус', value: account?.enabled ? '✅ включен' : '⚠️ не создан/отключен', inline: true },
        { name: 'Вход через код', value: account?.hasActiveCode ? `✅ активен до ${account.loginCodeExpiresAt}` : '—', inline: false }
      )
      .setFooter({ text: 'Команды: /webaccount password, /webaccount login-code' });
    await safeEdit(interaction, { embeds: [embed] });
  }
};
