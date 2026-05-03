/**
 * GET /api/whatsapp/status
 * Returns the WhatsApp connection status for the authenticated user.
 */
import { authenticate } from '../../utils/auth.js';
import { isConnected } from '../../../../services/whatsapp/SessionManager.js';

export async function GET(request) {
  try {
    const { user } = await authenticate(request);
    return Response.json({ connected: isConnected(user.id) });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[WhatsApp status]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
