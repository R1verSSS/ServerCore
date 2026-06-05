const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createTournament, joinTournament, leaveTournament, closeTournament, getTournament, listTournaments, buildBracket } = require('../services/tournamentService');

module.exports = {
  data: new SlashCommandBuilder().setName('tournament').setDescription('Турниры')
    .addSubcommand(s=>s.setName('create').setDescription('Создать турнир').addStringOption(o=>o.setName('title').setDescription('Название').setRequired(true)).addIntegerOption(o=>o.setName('max').setDescription('Максимум участников').setMinValue(2).setMaxValue(64)).addStringOption(o=>o.setName('description').setDescription('Описание')))
    .addSubcommand(s=>s.setName('list').setDescription('Список турниров'))
    .addSubcommand(s=>s.setName('join').setDescription('Записаться').addIntegerOption(o=>o.setName('id').setDescription('ID').setRequired(true)))
    .addSubcommand(s=>s.setName('leave').setDescription('Выйти').addIntegerOption(o=>o.setName('id').setDescription('ID').setRequired(true)))
    .addSubcommand(s=>s.setName('bracket').setDescription('Сетка').addIntegerOption(o=>o.setName('id').setDescription('ID').setRequired(true)))
    .addSubcommand(s=>s.setName('cancel').setDescription('Закрыть турнир').addIntegerOption(o=>o.setName('id').setDescription('ID').setRequired(true))),
  async execute(interaction){
    await safeDefer(interaction,{flags:MessageFlags.Ephemeral});
    const sub=interaction.options.getSubcommand();
    if(sub==='create'){
      const t=createTournament(interaction.user.id, interaction.user.username, interaction.options.getString('title'), interaction.options.getInteger('max')||16, interaction.options.getString('description')||'');
      return safeEdit(interaction,{embeds:[new EmbedBuilder().setColor(0x57F287).setTitle(`🏆 Турнир #${t.id} создан`).setDescription(`${t.title}\nМакс. участников: ${t.maxMembers}`)]});
    }
    if(sub==='list'){
      const text=listTournaments('open').map(t=>`#${t.id} — **${t.title}** — ${(t.participants||[]).length}/${t.maxMembers}`).join('\n')||'Открытых турниров нет.';
      return safeEdit(interaction,{embeds:[new EmbedBuilder().setColor(0xFEE75C).setTitle('🏆 Турниры').setDescription(text)]});
    }
    if(sub==='join'){
      const r=joinTournament(interaction.user.id, interaction.user.username, interaction.options.getInteger('id'));
      return safeEdit(interaction,{content:r.ok?`✅ Ты записался на турнир #${r.tournament.id}.`:`❌ ${r.reason}`});
    }
    if(sub==='leave'){
      const r=leaveTournament(interaction.user.id, interaction.options.getInteger('id'));
      return safeEdit(interaction,{content:r.ok?`✅ Ты вышел из турнира #${r.tournament.id}.`:`❌ ${r.reason}`});
    }
    if(sub==='cancel'){
      if(!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return safeEdit(interaction,{content:'❌ Нужно право Manage Server.'});
      const r=closeTournament(interaction.options.getInteger('id'),'cancelled');
      return safeEdit(interaction,{content:r.ok?`✅ Турнир #${r.tournament.id} закрыт.`:'❌ Турнир не найден.'});
    }
    const t=getTournament(interaction.options.getInteger('id'));
    if(!t) return safeEdit(interaction,{content:'❌ Турнир не найден.'});
    return safeEdit(interaction,{embeds:[new EmbedBuilder().setColor(0x5865F2).setTitle(`🏆 Сетка: ${t.title}`).setDescription(buildBracket(t))]});
  }
};
