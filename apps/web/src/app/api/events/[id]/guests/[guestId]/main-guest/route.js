/**
 * PUT    /api/events/[id]/guests/[guestId]/main-guest
 *   Body: { main_guest_id: "<uuid>" }
 *   Links this guest to a main guest. Replaces any existing link.
 *
 * DELETE /api/events/[id]/guests/[guestId]/main-guest
 *   Removes the link (guest becomes standalone / main guest).
 */
import { authenticate } from '../../../../../utils/auth.js';
import sql from '../../../../../utils/sql.js';

async function getOwnedGuest(guestId, eventId, userId) {
  const rows = await sql`
    SELECT g.id FROM traheeb_guests g
    JOIN traheeb_events e ON e.id = g.event_id
    WHERE g.id       = ${guestId}
      AND g.event_id = ${eventId}
      AND e.user_id  = ${userId}
    LIMIT 1
  `;
  if (!rows.length) {
    const err = new Error('الضيف غير موجود');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function PUT(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedGuest(params.guestId, params.id, user.id);

    const { main_guest_id } = await request.json();
    if (!main_guest_id) {
      return Response.json({ error: 'main_guest_id مطلوب' }, { status: 400 });
    }
    if (main_guest_id === params.guestId) {
      return Response.json({ error: 'لا يمكن ربط الضيف بنفسه' }, { status: 400 });
    }

    // Verify the main guest belongs to the same event
    const mainRows = await sql`
      SELECT id, name FROM traheeb_guests
      WHERE id = ${main_guest_id} AND event_id = ${params.id}
      LIMIT 1
    `;
    if (!mainRows.length) {
      return Response.json({ error: 'الضيف الرئيسي غير موجود' }, { status: 404 });
    }

    await sql`
      INSERT INTO traheeb_guest_relations (guest_id, main_guest_id, event_id)
      VALUES (${params.guestId}, ${main_guest_id}, ${params.id})
      ON CONFLICT (guest_id) DO UPDATE SET main_guest_id = ${main_guest_id}
    `;

    return Response.json({ main_guest_id, main_guest_name: mainRows[0].name });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[PUT main-guest]', err);
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedGuest(params.guestId, params.id, user.id);

    await sql`DELETE FROM traheeb_guest_relations WHERE guest_id = ${params.guestId}`;

    return Response.json({ success: true });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[DELETE main-guest]', err);
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
