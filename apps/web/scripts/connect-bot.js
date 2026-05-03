/**
 * One-time script to connect the system WhatsApp bot account via QR code.
 * Run with: node scripts/connect-bot.js
 *
 * Steps:
 *   1. Run this script — a QR code appears in the terminal
 *   2. On the bot phone (+966538384048):
 *      WhatsApp → Settings → Linked Devices → Link a Device → scan the QR
 *   3. Once connected, session is saved to DB automatically.
 */

import { readFileSync } from 'fs';

// Load .env manually
try {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
} catch {}

import pkg from 'pg';
import {
  default as makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import qrcode from 'qrcode-terminal';

const SYSTEM_USER_ID = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';
const SESSION_DIR = `/tmp/traheeb-bot-session-${SYSTEM_USER_ID}`;

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function saveSession(creds, keys, connected) {
  await pool.query(`
    INSERT INTO traheeb_whatsapp_sessions (user_id, creds, keys, connected, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (user_id) DO UPDATE
      SET creds = $2, keys = $3, connected = $4, updated_at = now()
  `, [SYSTEM_USER_ID, JSON.stringify(creds), JSON.stringify(keys), connected]);
}

console.log('\n🤖 Traheeb WhatsApp Bot — Connection Setup');
console.log('─'.repeat(45));
console.log('A QR code will appear below. Scan it with WhatsApp:\n');
console.log('👉 WhatsApp → Settings → Linked Devices → Link a Device → scan QR\n');

// Clear old session so we always get a fresh QR
fs.rmSync(SESSION_DIR, { recursive: true, force: true });
fs.mkdirSync(SESSION_DIR, { recursive: true });

const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
const { version } = await fetchLatestBaileysVersion();

const socket = makeWASocket({
  version,
  auth: state,
  printQRInTerminal: false, // we handle it ourselves for better formatting
  logger: {
    level: 'silent',
    child: () => ({ level: 'silent', info:()=>{}, warn:()=>{}, error:()=>{}, debug:()=>{}, trace:()=>{} }),
    info:()=>{}, warn:()=>{}, error:()=>{}, debug:()=>{}, trace:()=>{},
  },
});

socket.ev.on('creds.update', saveCreds);

socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
  // Show QR in terminal when received
  if (qr) {
    console.clear();
    console.log('\n🤖 Traheeb WhatsApp Bot — Scan this QR code:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n👉 WhatsApp → Settings → Linked Devices → Link a Device → scan above\n');
    console.log('(QR refreshes every 20 seconds if not scanned)\n');
  }

  if (connection === 'open') {
    console.clear();
    console.log('\n✅ Bot connected successfully!\n');

    try {
      await saveSession(state.creds, {}, true);
      console.log('💾 Session saved to database.');
      console.log('   Restart the web server — OTPs will now be sent via WhatsApp.\n');
    } catch (err) {
      console.error('⚠️  Failed to save to DB:', err.message);
    }

    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    await pool.end();
    process.exit(0);
  }

  if (connection === 'close') {
    const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
    if (code === DisconnectReason.loggedOut) {
      console.log('\n❌ Logged out. Run the script again.\n');
      await pool.end();
      process.exit(1);
    }
    // Any other disconnection — let Baileys handle it (it will emit a new QR)
  }
});
