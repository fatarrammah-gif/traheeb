/**
 * POST /api/whatsapp/start-bot
 * Starts (or returns) the SYSTEM bot session used for custom guest messages.
 * Call this once after running connect-bot.js if the server was already running.
 */
import { authenticate } from '../../utils/auth.js';
import { getOrStartSession, isConnected } from '../../../../services/whatsapp/SessionManager.js';

const SYSTEM_ID = process.env.WHATSAPP_BOT_USER_ID || 'SYSTEM';
const SYSTEM_PHONE = process.env.WHATSAPP_BOT_PHONE || '+966538384048';

export async function POST(request) {
  try {
    await authenticate(request);

    if (isConnected(SYSTEM_ID)) {
      return Response.json({ connected: true, message: 'البوت متصل بالفعل' });
    }

    // Fire and forget — Puppeteer takes ~30s to restore from saved credentials
    getOrStartSession(SYSTEM_ID, SYSTEM_PHONE).catch((err) =>
      console.error('[start-bot] error:', err.message)
    );

    return Response.json({ connected: false, message: 'جارٍ تشغيل البوت... أعد المحاولة بعد 30 ثانية' });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    await authenticate(request);
    return Response.json({ connected: isConnected(SYSTEM_ID) });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
