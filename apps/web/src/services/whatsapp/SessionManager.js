/**
 * WhatsApp session manager using whatsapp-web.js (Puppeteer/Chrome).
 * Each organizer gets one Client instance keyed by userId.
 *
 * Sessions are persisted to .wwebjs_auth/ (LocalAuth).
 * On Railway: mount a volume at /app/apps/web/.wwebjs_auth to persist across deploys.
 */
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import sql from '../../app/api/utils/sql.js';

// Map<userId, { client, status, qrDataUrl }>
// status: 'initializing' | 'qr_ready' | 'connected' | 'disconnected'
const sessions = new Map();

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

function buildClient(userId) {
  return new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: '.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      executablePath: CHROME_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });
}

/**
 * Start a session for userId (or return existing one).
 * Returns the session object { status, qrDataUrl }.
 */
export async function getOrStartSession(userId) {
  if (sessions.has(userId)) {
    return sessions.get(userId);
  }

  const session = { client: null, status: 'initializing', qrDataUrl: null };
  sessions.set(userId, session);

  const client = buildClient(userId);
  session.client = client;

  client.on('qr', async (qr) => {
    session.qrDataUrl = await QRCode.toDataURL(qr);
    session.status = 'qr_ready';
    console.log(`[WhatsApp] QR ready for userId=${userId}`);
  });

  client.on('ready', async () => {
    session.status = 'connected';
    session.qrDataUrl = null;
    console.log(`[WhatsApp] Connected for userId=${userId}`);
    await sql`
      INSERT INTO traheeb_whatsapp_sessions (user_id, creds, keys, connected, updated_at)
      VALUES (${userId}, '{}', '{}', true, now())
      ON CONFLICT (user_id) DO UPDATE SET connected = true, updated_at = now()
    `.catch(() => {});
  });

  client.on('disconnected', async (reason) => {
    console.log(`[WhatsApp] Disconnected for userId=${userId}: ${reason}`);
    session.status = 'disconnected';
    sessions.delete(userId);
    await sql`
      UPDATE traheeb_whatsapp_sessions SET connected = false WHERE user_id = ${userId}
    `.catch(() => {});
  });

  client.on('auth_failure', (msg) => {
    console.error(`[WhatsApp] Auth failure for userId=${userId}: ${msg}`);
    session.status = 'disconnected';
    sessions.delete(userId);
  });

  // Initialize in background — do not await
  client.initialize().catch((err) => {
    console.error(`[WhatsApp] Init error for userId=${userId}:`, err.message);
    sessions.delete(userId);
  });

  return session;
}

/** Get an existing session without starting a new one. */
export function getSession(userId) {
  return sessions.get(userId) ?? null;
}

/** True if the session is fully connected. */
export function isConnected(userId) {
  return sessions.get(userId)?.status === 'connected';
}

/** Get the connected client or throw. */
export function getClient(userId) {
  const session = sessions.get(userId);
  if (!session || session.status !== 'connected') {
    throw new Error(`No connected WhatsApp session for userId=${userId}`);
  }
  return session.client;
}

/** Disconnect and remove session. */
export async function disconnectSession(userId) {
  const session = sessions.get(userId);
  if (session?.client) {
    try { await session.client.destroy(); } catch {}
  }
  sessions.delete(userId);
  await sql`
    UPDATE traheeb_whatsapp_sessions SET connected = false WHERE user_id = ${userId}
  `.catch(() => {});
}

/**
 * Called at server startup.
 * whatsapp-web.js with LocalAuth auto-restores sessions from disk —
 * we just need to re-initialize clients for previously connected users.
 */
export async function initAllSessions() {
  try {
    const rows = await sql`
      SELECT user_id FROM traheeb_whatsapp_sessions WHERE connected = true
    `;
    for (const row of rows) {
      await getOrStartSession(row.user_id);
    }
    console.log(`[WhatsApp] Restoring ${rows.length} session(s)...`);
  } catch (err) {
    console.error('[WhatsApp] initAllSessions error:', err.message);
  }
}

export { MessageMedia };
