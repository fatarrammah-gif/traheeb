/**
 * WhatsApp session manager using whatsapp-web.js + Puppeteer.
 *
 * Linking flow (QR code):
 *   1. POST /api/whatsapp/connect  →  returns { qrDataUrl }
 *   2. User scans QR in WhatsApp → Linked Devices → Link a Device
 *   3. GET /api/whatsapp/status polls until { connected: true }
 *
 * Sessions persist via LocalAuth (.wwebjs_auth/<userId>/).
 * On Railway: mount a Volume at /app/apps/web/.wwebjs_auth to survive redeploys.
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;

import QRCode from 'qrcode';
import crypto from 'crypto';
import sql from '../../app/api/utils/sql.js';
import { handleIncomingMessage } from './messageHandler.js';

// Map<userId, SessionEntry>
// SessionEntry: { client, status, qrDataUrl }
// status: 'initializing' | 'qr_ready' | 'connected' | 'disconnected'
//
// Stored on globalThis so Vite HMR module reloads don't wipe in-memory sessions.
if (!globalThis.__wwebjs_sessions) globalThis.__wwebjs_sessions = new Map();
if (!globalThis.__wwebjs_pending) globalThis.__wwebjs_pending = new Map();
const sessions = globalThis.__wwebjs_sessions;
const pendingStarts = globalThis.__wwebjs_pending;

// Puppeteer launch args tuned for Railway's Docker environment.
// --no-zygote removed: it prevents Chrome from spawning proper renderer processes,
// causing frame detachments when pages reload (e.g. WhatsApp Web version update).
const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',          // use /tmp instead of /dev/shm (limited in Docker)
  '--disable-gpu',
  '--no-first-run',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--metrics-recording-only',
];

// ── Build / start a session ──────────────────────────────────────────────────

async function startSession(userId, phone) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: {
      headless: true,
      args: PUPPETEER_ARGS,
      protocolTimeout: 60000,
    },
  });

  const entry = { client, status: 'initializing', qrDataUrl: null };
  sessions.set(userId, entry);

  client.on('qr', async (qr) => {
    entry.qrDataUrl = await QRCode.toDataURL(qr, { width: 512, margin: 2 });
    entry.status = 'qr_ready';
    console.log(`[WhatsApp] QR ready for userId=${userId}`);
  });

  client.on('ready', async () => {
    console.log(`[WhatsApp] Connected userId=${userId}`);
    entry.status = 'connected';
    entry.qrDataUrl = null;
    await sql`
      INSERT INTO traheeb_whatsapp_sessions (user_id, creds, keys, connected, updated_at)
      VALUES (${userId}, '{}', '{}', true, now())
      ON CONFLICT (user_id) DO UPDATE SET connected = true, updated_at = now()
    `.catch(() => {});

    // Monitor Puppeteer page for crashes / frame detachments
    try {
      client.pupPage?.on('error', (err) => {
        console.error(`[WhatsApp] Puppeteer page error userId=${userId}: ${err.message} — restarting in 5s`);
        markSessionDead(userId);
        setTimeout(() => startSession(userId, phone), 5000);
      });
      client.pupPage?.on('close', () => {
        console.log(`[WhatsApp] Puppeteer page closed userId=${userId} — restarting in 5s`);
        markSessionDead(userId);
        setTimeout(() => startSession(userId, phone), 5000);
      });
    } catch {}
  });

  // 'message' = incoming from others; 'message_create' = all messages (belt + suspenders)
  // whatsapp-web.js v1.34 sometimes only fires message_create for received messages.
  const onMsg = (msg) => {
    if (msg.fromMe) return; // skip messages we sent
    handleIncomingMessage(msg, userId, client).catch((err) =>
      console.error(`[WhatsApp] message handler error userId=${userId}:`, err.message)
    );
  };
  client.on('message', onMsg);
  client.on('message_create', onMsg);

  client.on('auth_failure', (msg) => {
    console.error(`[WhatsApp] Auth failure userId=${userId}: ${msg}`);
    entry.status = 'disconnected';
    sessions.delete(userId);
  });

  client.on('disconnected', async (reason) => {
    console.log(`[WhatsApp] Disconnected userId=${userId} reason=${reason}`);
    entry.status = 'disconnected';
    sessions.delete(userId);
    await sql`
      UPDATE traheeb_whatsapp_sessions SET connected = false WHERE user_id = ${userId}
    `.catch(() => {});

    // Auto-reconnect unless the user explicitly logged out
    if (reason !== 'LOGOUT' && phone) {
      console.log(`[WhatsApp] Reconnecting userId=${userId} in 10s...`);
      setTimeout(() => startSession(userId, phone), 10000);
    }
  });

  console.log(`[WhatsApp] Initializing session for userId=${userId}...`);
  client.initialize().catch((err) => {
    console.error(`[WhatsApp] Init error for userId=${userId}: ${err.message}`);
    entry.status = 'disconnected';
    sessions.delete(userId);
  });

  return entry;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Start or return an existing session.
 * Concurrent calls for the same userId wait on the same promise.
 */
export async function getOrStartSession(userId, phone) {
  if (sessions.has(userId)) {
    return sessions.get(userId);
  }
  if (pendingStarts.has(userId)) {
    return pendingStarts.get(userId);
  }
  const p = startSession(userId, phone).finally(() => pendingStarts.delete(userId));
  pendingStarts.set(userId, p);
  return p;
}

export function getSession(userId) {
  return sessions.get(userId) ?? null;
}

export function isConnected(userId) {
  return sessions.get(userId)?.status === 'connected';
}

/** Get the connected client or throw. */
export function getClient(userId) {
  const entry = sessions.get(userId);
  if (!entry || entry.status !== 'connected') {
    throw new Error(`No connected WhatsApp session for userId=${userId}`);
  }
  return entry.client;
}

export async function disconnectSession(userId) {
  const entry = sessions.get(userId);
  if (entry?.client) {
    try { await entry.client.logout(); } catch {}
    try { await entry.client.destroy(); } catch {}
  }
  sessions.delete(userId);
  await sql`
    UPDATE traheeb_whatsapp_sessions SET connected = false WHERE user_id = ${userId}
  `.catch(() => {});
}

/**
 * Mark a session as dead without attempting logout (used when frame detaches).
 * Cleans up in-memory state so isConnected() returns false immediately.
 */
export function markSessionDead(userId) {
  const entry = sessions.get(userId);
  if (entry) entry.status = 'disconnected';
  sessions.delete(userId);
  sql`UPDATE traheeb_whatsapp_sessions SET connected = false WHERE user_id = ${userId}`.catch(() => {});
}

/**
 * Called at server startup — re-initialise previously connected sessions.
 * whatsapp-web.js restores credentials from LocalAuth automatically.
 */
export async function initAllSessions() {
  // Always restore the SYSTEM bot session if its credentials are saved on disk
  try {
    const { existsSync } = await import('fs');
    const SYSTEM_ID = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';
    const SYSTEM_PHONE = process.env.WHATSAPP_BOT_PHONE || '+966538384048';
    if (existsSync(`.wwebjs_auth/session-${SYSTEM_ID}`)) {
      console.log(`[WhatsApp] Restoring SYSTEM bot session (${SYSTEM_PHONE})...`);
      startSession(SYSTEM_ID, SYSTEM_PHONE).catch((err) =>
        console.error(`[WhatsApp] SYSTEM session error: ${err.message}`)
      );
    }
  } catch (err) {
    console.error('[WhatsApp] SYSTEM session init error:', err.message);
  }

  // Restore organizer sessions that were connected before the last restart
  try {
    const rows = await sql`
      SELECT ws.user_id, u.phone
      FROM traheeb_whatsapp_sessions ws
      JOIN traheeb_users u ON u.id::text = ws.user_id::text
      WHERE ws.connected = true
    `;
    console.log(`[WhatsApp] Restoring ${rows.length} organizer session(s)...`);
    for (const row of rows) {
      startSession(row.user_id, row.phone).catch((err) =>
        console.error(`[WhatsApp] Init error for userId=${row.user_id}: ${err.message}`)
      );
    }
  } catch (err) {
    console.error('[WhatsApp] initAllSessions error:', err.message);
  }
}

// ── QR generation for confirmed guests (button-tap flow) ────────────────────

export async function generateAndSendQRs(userId, guest) {
  const { generateStyledQR } = await import('../qr/generator.js');
  const { qrConfirmationMessage } = await import('./templates.js');

  const client = getClient(userId);
  const jid = toWhatsAppJid(guest.phone);

  const labels = [
    'main',
    ...Array.from({ length: guest.companions }, (_, i) => `companion-${i + 1}`),
  ];

  let logoBuffer = null;
  if (guest.event_logo_url) {
    try {
      const r = await fetch(guest.event_logo_url);
      if (r.ok) logoBuffer = Buffer.from(await r.arrayBuffer());
    } catch {}
  }

  for (const label of labels) {
    const token = crypto.randomBytes(16).toString('hex');
    await sql`
      INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
      VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
    `.catch(() => {});

    const pngBuffer = await generateStyledQR(token, logoBuffer);
    const caption = qrConfirmationMessage({
      guestName: guest.name,
      eventName: guest.event_name,
      label,
    });

    const media = new MessageMedia('image/png', pngBuffer.toString('base64'));
    await client.sendMessage(jid, media, { caption });

    if (labels.length > 1) await new Promise((r) => setTimeout(r, 800));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise phone → whatsapp-web.js chat ID (E.164 digits + @c.us) */
export function toWhatsAppJid(phone) {
  let p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('00'))                              p = p.slice(2);
  else if (p.startsWith('+'))                          p = p.slice(1);
  else if (p.startsWith('05') && p.length === 10)      p = '966' + p.slice(1);
  else if (p.startsWith('5')  && p.length === 9)       p = '966' + p;
  p = p.replace(/[^0-9]/g, '');
  return `${p}@c.us`;
}
