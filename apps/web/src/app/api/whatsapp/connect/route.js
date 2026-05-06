/**
 * POST /api/whatsapp/connect
 * Creates or restores a Baileys session for the authenticated user.
 * Returns { connected: true } if already connected, or { pairingCode } for new sessions.
 */
import { authenticate } from '../../utils/auth.js';
import { isConnected, getOrCreateSession } from '../../../../services/whatsapp/SessionManager.js';

export async function POST(request) {
  try {
    const { user } = await authenticate(request);

    if (isConnected(user.id)) {
      return Response.json({ connected: true });
    }

    const body = await request.json().catch(() => ({}));
    const phone = body.phone ?? user.phone;

    if (!phone) {
      return Response.json({ error: 'رقم الجوال مطلوب للربط' }, { status: 400 });
    }

    const { pairingCode } = await getOrCreateSession(user.id, phone);

    return Response.json({ pairingCode });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[WhatsApp connect]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
