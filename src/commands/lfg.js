const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createLfg, getOpenLfgList, getLfg, joinLfg, leaveLfg, closeLfg, buildLfgEmbed, buildLfgButtons } = require('../services/lfgService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Поиск команды для игр')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Создать поиск команды')
      .addStringOption(opt => opt.setName('game').setDescription('Игра, например CS2, Minecraft, Valorant').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('Название поиска команды').setRequired(false))
      .addIntegerOption(opt => opt.setName('players').setDescription('Максимум участников').setRequired(false).setMinValue(2).setMaxValue(99))
      .addStringOption(opt => opt.setName('description').setDescription('Описание, требования, время игры').setRequired(false))
      .addBooleanOption(opt => opt.setName('voice').setDescription('Создать голосовую комнату').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Показать активные поиски команды'))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Показать LFG по ID')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID LFG').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('join')
      .setDescription('Присоединиться к поиску команды')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID LFG').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('leave')
      .setDescription('Выйти из поиска команды')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID LFG').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('close')
      .setDescription('Закрыть поиск команды')
      .addIntegerOption(opt => opt.setName('id').setDescription('ID LFG').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Причина закрытия').setRequired(false))),

  async execute(interaction) {
    await safeDefer(interaction, true);
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const lfg = await createLfg(interaction, {
        game: interaction.options.getString('game'),
        title: interaction.options.getString('title'),
        description: interaction.options.getString('description'),
        maxMembers: interaction.options.getInteger('players') || 5,
        createVoice: interaction.options.getBoolean('voice') || false
      });
      await safeEdit(interaction, {
        content: `✅ Поиск команды **#${lfg.id}** создан${lfg.channelId ? ' и опубликован в канале поиска команды' : ''}.`,
        embeds: [buildLfgEmbed(lfg)],
        components: buildLfgButtons(lfg)
      });
      return;
    }

    if (sub === 'list') {
      const list = getOpenLfgList(10);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎮 Активные поиски команды')
        .setDescription(list.length ? list.map(item => `**#${item.id}** · ${item.game} · ${item.title} · ${(item.members || []).length}/${item.maxMembers}`).join('\n') : 'Активных поисков команды пока нет.');
      await safeEdit(interaction, { embeds: [embed], components: [] });
      return;
    }

    const id = interaction.options.getInteger('id');

    if (sub === 'info') {
      const lfg = getLfg(id);
      if (!lfg) {
        await safeEdit(interaction, { content: '❌ LFG не найден.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, { embeds: [buildLfgEmbed(lfg)], components: buildLfgButtons(lfg) });
      return;
    }

    if (sub === 'join') {
      const result = await joinLfg(interaction, id);
      let text = result.ok ? `✅ Ты присоединился к LFG #${id}.` : '❌ Не удалось присоединиться.';
      if (!result.ok && result.reason === 'not_found') text = '❌ LFG не найден.';
      if (!result.ok && result.reason === 'closed') text = '⚠️ Этот LFG уже закрыт.';
      if (!result.ok && result.reason === 'already_joined') text = '⚠️ Ты уже участвуешь.';
      if (!result.ok && result.reason === 'full') text = '⚠️ Мест больше нет.';
      await safeEdit(interaction, { content: text, embeds: result.lfg ? [buildLfgEmbed(result.lfg)] : [], components: result.lfg ? buildLfgButtons(result.lfg) : [] });
      return;
    }

    if (sub === 'leave') {
      const result = await leaveLfg(interaction, id);
      let text = result.ok ? `✅ Ты вышел из LFG #${id}.` : '❌ Не удалось выйти.';
      if (!result.ok && result.reason === 'not_found') text = '❌ LFG не найден.';
      if (!result.ok && result.reason === 'not_joined') text = '⚠️ Ты не участвуешь в этом LFG.';
      if (!result.ok && result.reason === 'owner') text = '⚠️ Создатель не может выйти. Закрой LFG через `/lfg close`.';
      await safeEdit(interaction, { content: text, embeds: result.lfg ? [buildLfgEmbed(result.lfg)] : [], components: result.lfg ? buildLfgButtons(result.lfg) : [] });
      return;
    }

    if (sub === 'close') {
      const result = await closeLfg(interaction, id, interaction.options.getString('reason') || 'Закрыто через команду');
      let text = result.ok ? `🔒 LFG #${id} закрыт.` : '❌ Не удалось закрыть LFG.';
      if (!result.ok && result.reason === 'not_found') text = '❌ LFG не найден.';
      if (!result.ok && result.reason === 'no_permission') text = '❌ Закрыть LFG может его создатель или модератор.';
      await safeEdit(interaction, { content: text, embeds: result.lfg ? [buildLfgEmbed(result.lfg)] : [], components: result.lfg ? buildLfgButtons(result.lfg) : [] });
    }
  }
};
