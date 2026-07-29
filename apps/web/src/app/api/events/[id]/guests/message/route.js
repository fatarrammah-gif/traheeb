/**
 * POST /api/events/[id]/guests/message
 * Send a custom WhatsApp message (text + optional image) to one or more guests
 * via the organizer's personal whatsapp-web.js session.
 *
 * Body:
 *   guestIds  — array of guest IDs, or the string "all"
 *   text      — message text (required)
 *   imageBase64?   — base64-encoded image data (without data URI prefix)
 *   imageMimeType? — e.g. "image/jpeg" (required when imageBase64 is present)
 */
import { authenticate } from '../../../../utils/auth.js';
import sql from '../../../../utils/sql.js';
import { sendText, sendMedia } from '../../../../../../services/whatsapp/sender.js';
import { isConnected } from '../../../../../../services/whatsapp/SessionManager.js';

async function getOwnedEvent(eventId, userId) {
  const rows = await sql`
    SELECT id, user_id FROM traheeb_events
    WHERE id = ${eventId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (!rows.length) {
    const err = new Error('الفعالية غير موجودة');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    if (!isConnected(user.id)) {
      return Response.json(
        { error: 'واتساب غير متصل. يرجى الاتصال أولاً.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { guestIds, text, imageBase64, imageMimeType } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return Response.json({ error: 'نص الرسالة مطلوب' }, { status: 400 });
    }

    // Fetch target guests
    let guests;
    if (guestIds === 'all') {
      guests = await sql`
        SELECT id, name, phone FROM traheeb_guests
        WHERE event_id = ${params.id}
        ORDER BY created_at
      `;
    } else if (Array.isArray(guestIds) && guestIds.length > 0) {
      guests = await sql`
        SELECT id, name, phone FROM traheeb_guests
        WHERE event_id = ${params.id}
          AND id = ANY(${guestIds})
        ORDER BY created_at
      `;
    } else {
      return Response.json({ error: 'guestIds مطلوب' }, { status: 400 });
    }

    if (!guests.length) {
      return Response.json({ error: 'لا يوجد ضيوف مطابقون' }, { status: 404 });
    }

    const hasImage = imageBase64 && imageMimeType;
    const mediaSource = hasImage
      ? `data:${imageMimeType};base64,${imageBase64}`
      : null;

    const sent = [];
    const failed = [];

    for (const guest of guests) {
      try {
        if (mediaSource) {
          await sendMedia(user.id, guest.phone, text.trim(), mediaSource);
        } else {
          await sendText(user.id, guest.phone, text.trim());
        }
        sent.push(guest.id);
      } catch (err) {
        console.error(`[message] Failed to send to guest ${guest.id}:`, err.message);
        failed.push({ id: guest.id, name: guest.name, error: err.message });
      }
    }

    return Response.json({ sent: sent.length, failed });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error('[POST /guests/message]', err);
    return Response.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
