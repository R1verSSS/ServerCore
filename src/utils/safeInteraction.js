const { MessageFlags } = require('discord.js');

function isInteractionExpired(error) {
  return error && (error.code === 10062 || error.code === 40060);
}

function isDiscordNetworkTimeout(error) {
  const message = String(error?.message || '');
  return error?.code === 'UND_ERR_CONNECT_TIMEOUT'
    || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
    || message.includes('Connect Timeout')
    || message.includes('UND_ERR_CONNECT_TIMEOUT');
}

function logSoftDiscordNetworkError(context, error) {
  const address = String(error?.message || '').match(/attempted addresses?: ([^,\n)]+)/i)?.[1];
  const suffix = address ? ` Адрес: ${address}` : '';
  console.warn(`[Discord REST timeout] ${context}.${suffix} Действие могло выполниться на стороне Discord, но ответ не пришел вовремя.`);
}

function normalizePayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;

  const { ephemeral, flags, ...rest } = payload;

  if (ephemeral || flags === MessageFlags.Ephemeral) {
    return {
      ...rest,
      flags: MessageFlags.Ephemeral,
    };
  }

  return payload;
}

function normalizeDeferOptions(options = true) {
  if (options === true) {
    return { flags: MessageFlags.Ephemeral };
  }

  if (options === false) {
    return {};
  }

  if (options && typeof options === 'object') {
    if (options.ephemeral || options.flags === MessageFlags.Ephemeral) {
      return { flags: MessageFlags.Ephemeral };
    }
    return options;
  }

  return { flags: MessageFlags.Ephemeral };
}

async function safeDefer(interaction, options = true) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(normalizeDeferOptions(options));
    }
    return true;
  } catch (error) {
    if (isInteractionExpired(error)) {
      console.warn('Interaction expired or was already acknowledged during defer. Ignored.');
      return false;
    }
    if (isDiscordNetworkTimeout(error)) {
      logSoftDiscordNetworkError('deferReply', error);
      return false;
    }
    throw error;
  }
}

async function safeDeferUpdate(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    return true;
  } catch (error) {
    if (isInteractionExpired(error)) {
      console.warn('Interaction expired or was already acknowledged during deferUpdate. Ignored.');
      return false;
    }
    if (isDiscordNetworkTimeout(error)) {
      logSoftDiscordNetworkError('deferUpdate', error);
      return false;
    }
    throw error;
  }
}

async function safeReply(interaction, payload) {
  const data = normalizePayload(payload);

  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(data);
    }
    return await interaction.reply(data);
  } catch (error) {
    if (isInteractionExpired(error)) {
      console.warn('Interaction expired or was already acknowledged. Ignored.');
      return null;
    }
    if (isDiscordNetworkTimeout(error)) {
      logSoftDiscordNetworkError('reply/editReply', error);
      return null;
    }
    throw error;
  }
}

async function safeEdit(interaction, payload) {
  return safeReply(interaction, payload);
}

module.exports = {
  safeReply,
  safeEdit,
  safeDefer,
  safeDeferUpdate,
  isInteractionExpired,
  isDiscordNetworkTimeout,
  logSoftDiscordNetworkError,
};
