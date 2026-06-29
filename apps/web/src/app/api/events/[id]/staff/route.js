/**
 * GET  /api/events/[id]/staff — list staff for this event (organizer only)
 * POST /api/events/[id]/staff — add staff phone (organizer only)
 * DELETE /api/events/[id]/staff — remove staff phone (organizer only)
 */
import { authenticate } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';

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
    await getOwnedEvent(params.id, user.id);

    const staff = await sql`
      SELECT id, phone, name, created_at
      FROM traheeb_event_staff
      WHERE event_id = ${params.id}
      ORDER BY created_at ASC
    `;

    return Response.json({ staff });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[GET staff]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    const body = await request.json();
    let phone = (body.phone ?? '').trim().replace(/[\s\-().]/g, '');
    const name = (body.name ?? '').trim() || null;

    if (!phone) return Response.json({ error: 'رقم الجوال مطلوب' }, { status: 400 });

    // Normalize Saudi phone
    if (phone.startsWith('00')) phone = '+' + phone.slice(2);
    if (phone.startsWith('05') && phone.length === 10) phone = '+966' + phone.slice(1);
    if (phone.startsWith('5') && phone.length === 9) phone = '+966' + phone;
    if (!phone.startsWith('+')) phone = '+' + phone;

    const [row] = await sql`
      INSERT INTO traheeb_event_staff (event_id, phone, name, added_by)
      VALUES (${params.id}, ${phone}, ${name}, ${user.id})
      ON CONFLICT (event_id, phone) DO NOTHING
      RETURNING id, phone, name, created_at
    `;

    if (!row) return Response.json({ error: 'هذا الرقم مضاف مسبقاً' }, { status: 409 });

    return Response.json({ staff: row }, { status: 201 });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST staff]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    const body = await request.json();
    const phone = (body.phone ?? '').trim();

    if (!phone) return Response.json({ error: 'رقم الجوال مطلوب' }, { status: 400 });

    await sql`
      DELETE FROM traheeb_event_staff
      WHERE event_id = ${params.id} AND phone = ${phone}
    `;

    return Response.json({ ok: true });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[DELETE staff]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
