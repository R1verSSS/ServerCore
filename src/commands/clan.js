const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createClan, joinClan, leaveClan, depositClan, getClan, getClanTop } = require('../services/clanService');
const { getOrCreateUser } = require('../services/dataStore');

module.exports = {
  data: new SlashCommandBuilder().setName('clan').setDescription('Кланы сервера')
    .addSubcommand(s=>s.setName('create').setDescription('Создать клан').addStringOption(o=>o.setName('name').setDescription('Название').setRequired(true)))
    .addSubcommand(s=>s.setName('join').setDescription('Вступить в клан').addIntegerOption(o=>o.setName('id').setDescription('ID клана').setRequired(true)))
    .addSubcommand(s=>s.setName('leave').setDescription('Покинуть клан'))
    .addSubcommand(s=>s.setName('profile').setDescription('Профиль клана').addIntegerOption(o=>o.setName('id').setDescription('ID клана')))
    .addSubcommand(s=>s.setName('top').setDescription('Топ кланов'))
    .addSubcommand(s=>s.setName('deposit').setDescription('Пополнить банк клана').addIntegerOption(o=>o.setName('amount').setDescription('Сумма').setRequired(true).setMinValue(1))),
  async execute(interaction){
    await safeDefer(interaction,{flags:MessageFlags.Ephemeral});
    const sub=interaction.options.getSubcommand();
    let result;
    if(sub==='create') result=createClan(interaction.user.id, interaction.user.username, interaction.options.getString('name'));
    if(sub==='join') result=joinClan(interaction.user.id, interaction.user.username, interaction.options.getInteger('id'));
    if(sub==='leave') result=leaveClan(interaction.user.id, interaction.user.username);
    if(sub==='deposit') result=depositClan(interaction.user.id, interaction.user.username, interaction.options.getInteger('amount'));
    if(['create','join','leave','deposit'].includes(sub)) {
      if(!result.ok) return safeEdit(interaction,{content:`❌ Действие не выполнено: ${result.reason}`});
      return safeEdit(interaction,{content:`✅ Готово. ${result.clan ? `Клан: **${result.clan.name}**` : ''}`});
    }
    if(sub==='profile'){
      const user=getOrCreateUser(interaction.user.id, interaction.user.username);
      const clan=getClan(interaction.options.getInteger('id') || user.clanId);
      if(!clan) return safeEdit(interaction,{content:'❌ Клан не найден.'});
      const embed=new EmbedBuilder().setColor(0x5865F2).setTitle(`🏰 Клан #${clan.id}: ${clan.name}`).setDescription(`Участников: **${(clan.members||[]).length}**\nБанк: **${clan.bank||0} монет**\nXP: **${clan.xp||0}**\nВладелец: <@${clan.ownerId}>`);
      return safeEdit(interaction,{embeds:[embed]});
    }
    const top=getClanTop(10).map((c,i)=>`**${i+1}.** #${c.id} ${c.name} — ${(c.members||[]).length} уч., банк ${c.bank||0}`).join('\n') || 'Кланов пока нет.';
    return safeEdit(interaction,{embeds:[new EmbedBuilder().setColor(0xFEE75C).setTitle('🏆 Топ кланов').setDescription(top)]});
  }
};
