/**
 * GET  /api/events  — list all events for the authenticated user (with guest counts)
 * POST /api/events  — create a new event, send WhatsApp confirmation to creator
 */
import { authenticate } from '../utils/auth.js';
import sql from '../utils/sql.js';
import { isConnected } from '../../../services/whatsapp/SessionManager.js';
import { sendText } from '../../../services/whatsapp/sender.js';
import { eventCreatedMessage } from '../../../services/whatsapp/templates.js';

export async function GET(request) {
  try {
    const { user } = await authenticate(request);

    const events = await sql`
      SELECT
        e.id, e.user_id, e.name, e.date, e.time, e.category, e.capacity,
        e.venue, e.location, e.map_lat, e.map_lng,
        e.invitation_text, e.reminder,
        e.event_logo_url IS NOT NULL        AS has_logo,
        e.invitation_media_url IS NOT NULL  AS has_media,
        e.qr_background_url IS NOT NULL     AS has_qr_bg,
        e.created_at,
        COUNT(g.id)::int                                          AS total_guests,
        COUNT(g.id) FILTER (WHERE g.status = 'confirmed')::int    AS confirmed_count,
        COUNT(g.id) FILTER (WHERE g.status = 'attended')::int     AS attended_count
      FROM traheeb_events e
      LEFT JOIN traheeb_guests g ON g.event_id = e.id
      WHERE e.user_id = ${user.id}
      GROUP BY e.id
      ORDER BY e.date DESC, e.created_at DESC
    `;

    return Response.json({ events });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[GET /api/events]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    console.log('[events POST] start');
    const { user } = await authenticate(request);
    console.log('[events POST] auth ok userId=', user.id);
    const body = await request.json();
    console.log('[events POST] body parsed');

    const {
      name, date, time, category = 'أخرى', capacity = 100,
      venue, location, map_lat, map_lng,
      invitation_text, reminder = '24hours',
      event_logo_url: rawLogoUrl,
      invitation_media_url: rawMediaUrl,
      qr_background_url: rawQrBgUrl,
      qr_placement = 'card',
    } = body;

    if (!name || !date || !time || !venue) {
      return Response.json({ error: 'الاسم والتاريخ والوقت والمكان مطلوبة' }, { status: 400 });
    }

    // Mobile uploads images directly to ImgBB and sends URLs — no server-side upload needed
    const event_logo_url       = rawLogoUrl    ?? null;
    const invitation_media_url = rawMediaUrl   ?? null;
    const qr_background_url    = rawQrBgUrl    ?? null;

    console.log('[events POST] inserting...');
    const [event] = await sql`
      INSERT INTO traheeb_events (
        user_id, name, date, time, category, capacity,
        venue, location, map_lat, map_lng,
        invitation_text, reminder,
        event_logo_url, invitation_media_url, qr_background_url, qr_placement
      ) VALUES (
        ${user.id}, ${name}, ${date}, ${time}, ${category}, ${capacity},
        ${venue}, ${location ?? null}, ${map_lat ?? null}, ${map_lng ?? null},
        ${invitation_text ?? null}, ${reminder},
        ${event_logo_url}, ${invitation_media_url}, ${qr_background_url},
        ${['card','overlay'].includes(qr_placement) ? qr_placement : 'card'}
      )
      RETURNING *
    `;

    // Send WhatsApp confirmation to the organizer (non-blocking)
    if (isConnected(user.id)) {
      sendText(user.id, user.phone, eventCreatedMessage(event)).catch(err =>
        console.error('[event created WhatsApp]', err)
      );
    }

    return Response.json({ event }, { status: 201 });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST /api/events]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

