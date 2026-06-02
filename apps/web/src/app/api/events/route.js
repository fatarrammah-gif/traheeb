/**
 * GET  /api/events  — list all events for the authenticated user (with guest counts)
 * POST /api/events  — create a new event, send WhatsApp confirmation to creator
 */
import { authenticate } from '../utils/auth.js';
import sql from '../utils/sql.js';
import { isConnected } from '../../../services/whatsapp/SessionManager.js';
import { sendText } from '../../../services/whatsapp/sender.js';
import { eventCreatedMessage } from '../../../services/whatsapp/templates.js';
import { uploadToUploadcare } from '../../../services/uploadcare.js';

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
    } = body;

    if (!name || !date || !time || !venue) {
      return Response.json({ error: 'الاسم والتاريخ والوقت والمكان مطلوبة' }, { status: 400 });
    }

    // Insert event immediately with no media URLs — respond fast to avoid mobile timeout
    console.log('[events POST] inserting...');
    const [event] = await sql`
      INSERT INTO traheeb_events (
        user_id, name, date, time, category, capacity,
        venue, location, map_lat, map_lng,
        invitation_text, reminder,
        event_logo_url, invitation_media_url, qr_background_url
      ) VALUES (
        ${user.id}, ${name}, ${date}, ${time}, ${category}, ${capacity},
        ${venue}, ${location ?? null}, ${map_lat ?? null}, ${map_lng ?? null},
        ${invitation_text ?? null}, ${reminder},
        ${null}, ${null}, ${null}
      )
      RETURNING *
    `;

    // Upload media in the background — update DB record when done
    if (rawLogoUrl || rawMediaUrl || rawQrBgUrl) {
      uploadMediaAndUpdate(event.id, rawLogoUrl, rawMediaUrl, rawQrBgUrl).catch(err =>
        console.error('[events POST] background upload error:', err.message)
      );
    }

    // Send WhatsApp confirmation to the organizer (non-blocking)
    if (isConnected(user.id)) {
      sendText(user.id, user.phone, eventCreatedMessage(event)).catch(err =>
        console.error('[event created WhatsApp]', err)
      );
    }

    return Response.json({
      event: {
        ...event,
        event_logo_url: undefined,
        invitation_media_url: undefined,
        qr_background_url: undefined,
        has_logo:  !!rawLogoUrl,
        has_media: !!rawMediaUrl,
        has_qr_bg: !!rawQrBgUrl,
      },
    }, { status: 201 });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST /api/events]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

async function uploadMediaAndUpdate(eventId, rawLogoUrl, rawMediaUrl, rawQrBgUrl) {
  const [event_logo_url, invitation_media_url, qr_background_url] = await Promise.all([
    uploadToUploadcare(rawLogoUrl).catch(() => null),
    uploadToUploadcare(rawMediaUrl).catch(() => null),
    uploadToUploadcare(rawQrBgUrl).catch(() => null),
  ]);
  console.log('[events POST] background uploads done:', { event_logo_url, invitation_media_url, qr_background_url });
  await sql`
    UPDATE traheeb_events
    SET
      event_logo_url       = ${event_logo_url},
      invitation_media_url = ${invitation_media_url},
      qr_background_url    = ${qr_background_url}
    WHERE id = ${eventId}
  `;
}
