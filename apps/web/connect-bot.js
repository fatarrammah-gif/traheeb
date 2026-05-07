/**
 * Connect the Traheeb WhatsApp bot account using whatsapp-web.js.
 * Run once from apps/web:
 *   node connect-bot.js
 *
 * A QR code will appear — scan it with the bot phone (+966538384048) in WhatsApp.
 * The session is saved to .wwebjs_auth/ and auto-restores on server startup.
 */

import 'dotenv/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const SYSTEM_USER_ID = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';
const BOT_PHONE = process.env.WHATSAPP_BOT_PHONE || '+966538384048';

console.log(`\nStarting WhatsApp bot connection for ${BOT_PHONE}...`);
console.log('A QR code will appear — scan it with the bot phone in WhatsApp.\n');

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: SYSTEM_USER_ID,
    dataPath: '.wwebjs_auth',
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', (qr) => {
  console.clear();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Scan with WhatsApp on ${BOT_PHONE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  qrcode.generate(qr, { small: true });
  console.log('\nIn WhatsApp: ⋮ → Linked Devices → Link a Device → scan above\n');
  console.log('(QR refreshes every 20 seconds)\n');
});

client.on('ready', () => {
  console.log('\n✅  Bot connected! Session saved to .wwebjs_auth/');
  console.log('The server will auto-reconnect on startup.');
  console.log('Press Ctrl+C to exit.\n');
});

client.on('auth_failure', (msg) => {
  console.error('\n❌  Auth failed:', msg);
  console.log('Run the script again to retry.\n');
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.log(`\nDisconnected: ${reason}`);
  process.exit(0);
});

client.initialize().catch((err) => {
  console.error('\nFailed to start:', err.message);
  process.exit(1);
});
