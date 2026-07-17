/**
 * PATCH  /api/events/[id]/guests/[guestId] — update name, phone, companions
 * DELETE /api/events/[id]/guests/[guestId] — remove guest
 */
import { authenticate } from '../../../../utils/auth.js';
import sql from '../../../../utils/sql.js';

async function getOwnedGuest(guestId, eventId, userId) {
  const rows = await sql`
    SELECT g.* FROM traheeb_guests g
    JOIN traheeb_events e ON e.id = g.event_id
    WHERE g.id = ${guestId}
      AND g.event_id = ${eventId}
      AND e.user_id = ${userId}
    LIMIT 1
  `;
  if (!rows.length) {
    const err = new Error('الضيف غير موجود');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function PATCH(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedGuest(params.guestId, params.id, user.id);

    const body = await request.json();
    const { name, phone, companions, status } = body;

    const [updated] = await sql`
      UPDATE traheeb_guests SET
        name       = COALESCE(${name       ?? null}, name),
        phone      = COALESCE(${phone      ?? null}, phone),
        companions = COALESCE(${companions ?? null}, companions),
        status     = COALESCE(${status     ?? null}, status)
      WHERE id = ${params.guestId}
      RETURNING *
    `;

    // When companions changes, sync max_scans on the main QR token and
    // recalculate `used` — if companions increased, the token may no longer
    // be exhausted even if it was previously marked used.
    if (companions != null) {
      const newMaxScans = companions + 1;
      await sql`
        UPDATE traheeb_qr_tokens
        SET max_scans = ${newMaxScans},
            used      = (scan_count >= ${newMaxScans})
        WHERE guest_id = ${params.guestId}
          AND label = 'main'
      `;
    }

    return Response.json({ guest: updated });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[PATCH guest]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedGuest(params.guestId, params.id, user.id);

    await sql`DELETE FROM traheeb_guests WHERE id = ${params.guestId}`;

    return Response.json({ success: true });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[DELETE guest]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
