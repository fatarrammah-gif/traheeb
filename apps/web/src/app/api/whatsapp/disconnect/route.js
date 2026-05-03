/**
 * DELETE /api/whatsapp/disconnect
 * Logs out the WhatsApp session for the authenticated user and removes it from the DB.
 */
import { authenticate } from '../../utils/auth.js';
import { disconnectSession } from '../../../../services/whatsapp/SessionManager.js';

export async function DELETE(request) {
  try {
    const { user } = await authenticate(request);
    await disconnectSession(user.id);
    return Response.json({ success: true });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[WhatsApp disconnect]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
