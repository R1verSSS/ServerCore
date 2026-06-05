const dns = require('node:dns').promises;
const { performance } = require('node:perf_hooks');

function status(ok, label, hint = '', details = {}) {
  return { ok, label, hint, details };
}

function ms(value) {
  return `${Math.round(value)} ms`;
}

async function timedFetch(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ServerCore-Diagnostics/24.1' }
    });
    const text = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: performance.now() - started,
      bodyPreview: text.slice(0, 180)
    };
  } catch (error) {
    return {
      ok: false,
      errorName: error.name,
      errorCode: error.code || error.cause?.code || error.cause?.name || 'UNKNOWN',
      errorMessage: error.message,
      elapsedMs: performance.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}

async function buildNetworkReport(options = {}) {
  const timeoutMs = Number(options.timeoutMs || process.env.NETWORK_CHECK_TIMEOUT || 10000);
  const checks = [];

  let dnsAddresses = [];
  try {
    dnsAddresses = await dns.lookup('discord.com', { all: true });
    checks.push(status(true, 'DNS discord.com работает', `Найдено адресов: ${dnsAddresses.map(a => a.address).join(', ')}`, { addresses: dnsAddresses }));
  } catch (error) {
    checks.push(status(false, 'DNS discord.com не работает', `${error.code || error.name}: ${error.message}`));
  }

  const gateway = await timedFetch('https://discord.com/api/v10/gateway', timeoutMs);
  if (gateway.ok && gateway.bodyPreview.includes('gateway.discord.gg')) {
    checks.push(status(true, 'Discord Gateway API доступен из Node.js', `Ответ за ${ms(gateway.elapsedMs)}.`, gateway));
  } else {
    const hint = gateway.errorCode === 'UND_ERR_CONNECT_TIMEOUT' || String(gateway.errorMessage || '').includes('timeout')
      ? 'Node.js не получил ответ от Discord вовремя. Обычно помогает системный VPN, Firewall-разрешение для node.exe, Node.js LTS или хостинг/VPS.'
      : `HTTP/status: ${gateway.status || gateway.errorCode || gateway.errorName}. ${gateway.errorMessage || ''}`;
    checks.push(status(false, 'Discord Gateway API недоступен из Node.js', hint, gateway));
  }

  const apiRoot = await timedFetch('https://discord.com/api/v10', timeoutMs);
  if (apiRoot.ok || apiRoot.status === 200 || apiRoot.status === 404) {
    checks.push(status(true, 'Discord REST домен отвечает', `Ответ за ${ms(apiRoot.elapsedMs)}. HTTP ${apiRoot.status}.`, apiRoot));
  } else {
    checks.push(status(false, 'Discord REST домен не отвечает стабильно', `${apiRoot.errorCode || apiRoot.status || apiRoot.errorName}: ${apiRoot.errorMessage || 'нет ответа'}`, apiRoot));
  }

  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY']
    .map(name => [name, process.env[name] || process.env[name.toLowerCase()]])
    .filter(([, value]) => Boolean(value));
  if (proxyVars.length) {
    checks.push(status(false, 'В окружении заданы proxy-переменные', proxyVars.map(([name, value]) => `${name}=${value}`).join('; '), { proxyVars }));
  } else {
    checks.push(status(true, 'Proxy-переменные не заданы', 'Node.js идет напрямую или через системный VPN.'));
  }

  const okCount = checks.filter(c => c.ok).length;
  return {
    checks,
    okCount,
    total: checks.length,
    timeoutMs,
    generatedAt: new Date().toISOString(),
    advice: [
      'Если браузер открывает Discord, а Node.js нет — проверь, не используется ли VPN только как расширение браузера.',
      'Для локальной разработки можно использовать системный VPN: Cloudflare WARP, Proton VPN, Outline, Amnezia и аналоги.',
      'Для постоянной работы лучше VPS/Railway/Render: бот будет работать из другой сети 24/7.',
      'На Windows проверь разрешение для C:\\Program Files\\nodejs\\node.exe в Firewall.'
    ]
  };
}

function formatNetworkReport(report) {
  const lines = [];
  lines.push(`Network readiness: ${report.okCount}/${report.total}`);
  for (const item of report.checks) {
    lines.push(`${item.ok ? '✅' : '⚠️'} ${item.label}${item.hint ? ` — ${item.hint}` : ''}`);
  }
  return lines.join('\n');
}

module.exports = { buildNetworkReport, formatNetworkReport };
