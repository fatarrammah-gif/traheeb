/**
 * Singleton WhatsApp session manager.
 * Maintains one Baileys WASocket per userId (or 'SYSTEM' for the bot account).
 *
 * Call initAllSessions() once at server startup to restore persisted sessions.
 */
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import sql from '../../app/api/utils/sql.js';
import { useDbAuthState } from './dbAuthState.js';

// Map<userId, { socket, pairingCodeResolve }>
const sessions = new Map();

// ── Internal: create/restore one session ─────────────────────────────────────
async function createSession(userId, { onPairingCode } = {}) {
  const { state, saveCreds } = await useDbAuthState(userId);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,   // we use pairing codes, not QR
    logger: { level: 'silent', child: () => ({ level: 'silent', child: () => {}, trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {} }), trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {} },
    generateHighQualityLinkPreview: false,
    browser: ['Traheeb', 'Chrome', '3.0'],
  });

  // Persist credentials on update
  socket.ev.on('creds.update', saveCreds);

  // Handle connection state changes
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'open') {
      // Mark as connected in DB
      await sql`
        UPDATE traheeb_whatsapp_sessions
        SET connected = true, updated_at = now()
        WHERE user_id = ${userId}
      `;
      console.log(`[WhatsApp] Session connected for userId=${userId}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error
        ? new Boom(lastDisconnect.error).output.statusCode
        : 0;

      // Mark as disconnected in DB
      await sql`
        UPDATE traheeb_whatsapp_sessions
        SET connected = false, updated_at = now()
        WHERE user_id = ${userId}
      `.catch(() => {});

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] Session closed for userId=${userId}, reconnect=${shouldReconnect}`);

      sessions.delete(userId);

      if (shouldReconnect) {
        // Back off then reconnect
        setTimeout(() => createSession(userId), 5000);
      }
    }
  });

  sessions.set(userId, { socket });
  return socket;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Restore all sessions that were previously connected.
 * Call once at server startup.
 */
export async function initAllSessions() {
  try {
    const rows = await sql`
      SELECT user_id FROM traheeb_whatsapp_sessions WHERE connected = true
    `;
    for (const row of rows) {
      try {
        await createSession(row.user_id);
      } catch (err) {
        console.error(`[WhatsApp] Failed to restore session for userId=${row.user_id}:`, err);
      }
    }

    // Always ensure the system bot account is initialized
    const systemId = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';
    if (!sessions.has(systemId)) {
      const existing = await sql`
        SELECT user_id FROM traheeb_whatsapp_sessions WHERE user_id = ${systemId}
      `;
      if (existing.length) {
        await createSession(systemId);
      }
    }

    console.log(`[WhatsApp] Initialized ${sessions.size} session(s)`);
  } catch (err) {
    console.error('[WhatsApp] initAllSessions error:', err);
  }
}

/**
 * Get an existing socket or start a new session for userId.
 * If new, returns a pairing code the user must enter in WhatsApp.
 * Returns { socket, pairingCode? }
 */
export async function getOrCreateSession(userId, phone) {
  if (sessions.has(userId)) {
    return { socket: sessions.get(userId).socket, pairingCode: null };
  }

  const socket = await createSession(userId);

  // Request pairing code (phone must be E.164 digits only)
  const digits = phone.replace(/[^0-9]/g, '');
  let pairingCode = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // let socket init
    pairingCode = await socket.requestPairingCode(digits);
  } catch (err) {
    console.error('[WhatsApp] Failed to get pairing code:', err);
  }

  return { socket, pairingCode };
}

/**
 * Return the active socket for userId.
 * Throws if the session is not connected.
 */
export function getSocket(userId) {
  const session = sessions.get(userId);
  if (!session) {
    throw new Error(`No active WhatsApp session for userId=${userId}`);
  }
  return session.socket;
}

/**
 * Check if a session is currently connected (in-memory).
 */
export function isConnected(userId) {
  return sessions.has(userId);
}

/**
 * Disconnect a session and remove it from DB.
 */
export async function disconnectSession(userId) {
  const session = sessions.get(userId);
  if (session) {
    try { await session.socket.logout(); } catch {}
    sessions.delete(userId);
  }
  await sql`
    DELETE FROM traheeb_whatsapp_sessions WHERE user_id = ${userId}
  `.catch(() => {});
}
