require('dotenv').config();
const { buildMusicDiagnosticPayload } = require('../services/musicService');

(async () => {
  const payload = await buildMusicDiagnosticPayload();
  const embed = payload.embeds?.[0];
  console.log('==== ServerCore Voice Diagnostic ====');
  console.log(embed?.data?.title || 'Voice Diagnostic');
  console.log(embed?.data?.description || '');
  for (const field of embed?.data?.fields || []) {
    console.log(`\n[${field.name}]`);
    console.log(field.value);
  }
  console.log('=====================================');
})().catch(error => {
  console.error('Voice diagnostic failed:', error);
  process.exit(1);
});
