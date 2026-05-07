/**
 * POST /api/whatsapp/connect
 * Starts a whatsapp-web.js session for the authenticated organizer.
 * Returns { connected: true } if already linked, or { qrDataUrl } for first-time linking.
 */
import { authenticate } from '../../utils/auth.js';
import { getOrStartSession, isConnected } from '../../../../services/whatsapp/SessionManager.js';

export async function POST(request) {
  try {
    const { user } = await authenticate(request);

    if (isConnected(user.id)) {
      return Response.json({ connected: true });
    }

    const session = await getOrStartSession(user.id);

    // Wait up to 8 seconds for QR to be generated
    const start = Date.now();
    while (session.status === 'initializing' && Date.now() - start < 8000) {
      await new Promise((r) => setTimeout(r, 500));
    }

    if (session.status === 'connected') {
      return Response.json({ connected: true });
    }

    if (session.qrDataUrl) {
      return Response.json({ connected: false, qrDataUrl: session.qrDataUrl });
    }

    return Response.json({ connected: false, status: session.status });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[WhatsApp connect]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
