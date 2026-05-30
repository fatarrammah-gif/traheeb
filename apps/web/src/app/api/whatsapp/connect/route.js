/**
 * POST /api/whatsapp/connect
 * Starts a whatsapp-web.js session and returns immediately.
 * The mobile app polls GET /api/whatsapp/status every 3 s for the QR data URL.
 */
import { authenticate } from '../../utils/auth.js';
import { getOrStartSession, isConnected } from '../../../../services/whatsapp/SessionManager.js';

export async function POST(request) {
  try {
    const { user } = await authenticate(request);

    if (isConnected(user.id)) {
      return Response.json({ connected: true });
    }

    // Fire-and-forget — Chrome takes 15-40 s to start on Railway.
    // The QR will appear in GET /api/whatsapp/status once ready.
    getOrStartSession(user.id, user.phone).catch((err) =>
      console.error(`[WhatsApp connect] session error userId=${user.id}:`, err.message)
    );

    return Response.json({ connected: false, starting: true });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[WhatsApp connect]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
