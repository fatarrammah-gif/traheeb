/**
 * Run this script once to link the WhatsApp bot number to Baileys.
 * Usage (from apps/web folder):
 *   node connect-bot.js
 *
 * A QR code will appear in the terminal — scan it with WhatsApp.
 */

import 'dotenv/config';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import qrcode from 'qrcode-terminal';
import { useDbAuthState } from './src/services/whatsapp/dbAuthState.js';
import sql from './src/app/api/utils/sql.js';

neonConfig.webSocketConstructor = ws;

const SYSTEM_USER_ID = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';

async function main() {
  console.log('\nStarting WhatsApp bot link via QR code...');
  console.log('A QR code will appear below — scan it with WhatsApp.\n');

  // Clear any broken previous session
  await sql`
    DELETE FROM traheeb_whatsapp_sessions WHERE user_id = ${SYSTEM_USER_ID}
  `;

  const { state, saveCreds } = await useDbAuthState(SYSTEM_USER_ID);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // we print it ourselves below
    logger: {
      level: 'silent',
      child: () => ({
        level: 'silent',
        trace: () => {}, debug: () => {}, info: () => {},
        warn: () => {}, error: () => {}, fatal: () => {},
        child: () => ({}),
      }),
      trace: () => {}, debug: () => {}, info: () => {},
      warn: () => {}, error: () => {}, fatal: () => {},
    },
    browser: ['Traheeb', 'Chrome', '3.0'],
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // New QR code available — print it
    if (qr) {
      console.clear();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  Scan this QR code with WhatsApp:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      qrcode.generate(qr, { small: true });
      console.log('\nOn the bot phone (+' + (process.env.WHATSAPP_BOT_PHONE || '') + '):');
      console.log('  1. Open WhatsApp');
      console.log('  2. Tap ⋮ (3 dots) → Linked Devices');
      console.log('  3. Tap "Link a Device"');
      console.log('  4. Point the camera at the QR code above\n');
      console.log('(QR refreshes every 20 seconds if not scanned)\n');
    }

    if (connection === 'open') {
      await sql`
        UPDATE traheeb_whatsapp_sessions
        SET connected = true, updated_at = now()
        WHERE user_id = ${SYSTEM_USER_ID}
      `;
      console.log('\n✅  WhatsApp bot linked and connected!');
      console.log('Session saved to Neon DB — server will auto-reconnect on startup.');
      console.log('Press Ctrl+C to exit.\n');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('\n❌  Logged out. Run this script again to re-link.\n');
        process.exit(0);
      } else {
        console.log(`\nConnection closed (code ${code}), retrying...\n`);
        setTimeout(main, 3000);
      }
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
