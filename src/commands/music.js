const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { enqueue, pause, resume, skip, stop, leave, buildQueuePayload, buildMusicStatusPayload, buildMusicDiagnosticPayload, isMusicEnabled } = require('../services/musicService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Музыка в voice-комнатах')
    .addSubcommand(sub => sub
      .setName('play')
      .setDescription('Добавить YouTube-ссылку в очередь')
      .addStringOption(option => option.setName('url').setDescription('Ссылка на YouTube video/playlist').setRequired(true)))
    .addSubcommand(sub => sub.setName('queue').setDescription('Показать текущую очередь'))
    .addSubcommand(sub => sub.setName('pause').setDescription('Поставить музыку на паузу'))
    .addSubcommand(sub => sub.setName('resume').setDescription('Продолжить воспроизведение'))
    .addSubcommand(sub => sub.setName('skip').setDescription('Пропустить текущий трек'))
    .addSubcommand(sub => sub.setName('stop').setDescription('Остановить музыку и очистить очередь'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Вывести бота из voice-канала'))
    .addSubcommand(sub => sub.setName('status').setDescription('Показать статус музыкального модуля'))
    .addSubcommand(sub => sub.setName('diagnose').setDescription('Диагностика Discord Voice/UDP/ffmpeg для хостинга')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    if (sub === 'status') return safeEdit(interaction, buildMusicStatusPayload(interaction.guildId));
    if (sub === 'diagnose') return safeEdit(interaction, await buildMusicDiagnosticPayload());

    if (!isMusicEnabled()) {
      await safeEdit(interaction, buildMusicStatusPayload(interaction.guildId));
      return;
    }

    if (sub === 'play') {
      const url = interaction.options.getString('url', true);
      const result = await enqueue(interaction, url);
      if (!result.ok) {
        let text = '❌ Не удалось добавить трек.';
        if (result.reason === 'not_in_voice') text = '❌ Сначала зайди в голосовой канал.';
        if (result.reason === 'only_youtube') text = '❌ Сейчас поддерживаются только ссылки YouTube.';
        if (result.reason === 'invalid_url') text = '❌ Не удалось распознать YouTube-ссылку.';
        if (result.reason === 'connection_failed') text = '❌ Не удалось подключиться к voice-каналу. Проверь права Connect/Speak.';
        await safeEdit(interaction, { content: text, embeds: [], components: [] });
        return;
      }
      const text = result.added.length === 1
        ? `✅ Добавлен трек: **${result.added[0].title}**`
        : `✅ Добавлено треков: **${result.added.length}**.`;
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (sub === 'queue') return safeEdit(interaction, buildQueuePayload(interaction.guildId));
    if (sub === 'pause') { pause(interaction.guildId); return safeEdit(interaction, { content: '⏸️ Пауза.', embeds: [], components: [] }); }
    if (sub === 'resume') { resume(interaction.guildId); return safeEdit(interaction, { content: '▶️ Продолжено.', embeds: [], components: [] }); }
    if (sub === 'skip') { skip(interaction.guildId); return safeEdit(interaction, { content: '⏭️ Пропущено.', embeds: [], components: [] }); }
    if (sub === 'stop') { stop(interaction.guildId); return safeEdit(interaction, { content: '⏹️ Остановлено, очередь очищена.', embeds: [], components: [] }); }
    if (sub === 'leave') { leave(interaction.guildId); return safeEdit(interaction, { content: '👋 Вышел из voice-канала.', embeds: [], components: [] }); }
  }
};
