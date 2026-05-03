/**
 * GET    /api/events/[id]  — event detail + full guest list + qr_tokens
 * PUT    /api/events/[id]  — update event fields
 * DELETE /api/events/[id]  — delete event (cascades to guests, qr_tokens)
 */
import { authenticate } from '../../utils/auth.js';
import sql from '../../utils/sql.js';

async function getOwnedEvent(eventId, userId) {
  const rows = await sql`
    SELECT * FROM traheeb_events
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

export async function GET(request, { params }) {
  try {
    const { user } = await authenticate(request);
    const event = await getOwnedEvent(params.id, user.id);

    const guests = await sql`
      SELECT
        g.*,
        COALESCE(
          json_agg(q ORDER BY q.label) FILTER (WHERE q.id IS NOT NULL),
          '[]'
        ) AS qr_tokens
      FROM traheeb_guests g
      LEFT JOIN traheeb_qr_tokens q ON q.guest_id = g.id
      WHERE g.event_id = ${event.id}
      GROUP BY g.id
      ORDER BY g.created_at ASC
    `;

    return Response.json({ event, guests });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[GET /api/events/[id]]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    const body = await request.json();
    const {
      name, date, time, category, capacity,
      venue, location, map_lat, map_lng,
      invitation_text, reminder,
      event_logo_url, invitation_media_url, qr_background_url,
    } = body;

    const [updated] = await sql`
      UPDATE traheeb_events SET
        name               = COALESCE(${name ?? null}, name),
        date               = COALESCE(${date ?? null}, date),
        time               = COALESCE(${time ?? null}, time),
        category           = COALESCE(${category ?? null}, category),
        capacity           = COALESCE(${capacity ?? null}, capacity),
        venue              = COALESCE(${venue ?? null}, venue),
        location           = COALESCE(${location ?? null}, location),
        map_lat            = COALESCE(${map_lat ?? null}, map_lat),
        map_lng            = COALESCE(${map_lng ?? null}, map_lng),
        invitation_text    = COALESCE(${invitation_text ?? null}, invitation_text),
        reminder           = COALESCE(${reminder ?? null}, reminder),
        event_logo_url     = COALESCE(${event_logo_url ?? null}, event_logo_url),
        invitation_media_url = COALESCE(${invitation_media_url ?? null}, invitation_media_url),
        qr_background_url  = COALESCE(${qr_background_url ?? null}, qr_background_url)
      WHERE id = ${params.id}
      RETURNING *
    `;

    return Response.json({ event: updated });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[PUT /api/events/[id]]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    await sql`DELETE FROM traheeb_events WHERE id = ${params.id}`;

    return Response.json({ success: true });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[DELETE /api/events/[id]]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
