/**
 * GET /api/invitation/[token]
 * Public endpoint — returns guest + event info for confirm/decline web pages.
 */
import sql from '../../utils/sql.js';

export async function GET(request, { params }) {
  try {
    const rows = await sql`
      SELECT
        g.id AS guest_id, g.name AS guest_name, g.phone, g.companions, g.status,
        e.id AS event_id, e.name AS event_name, e.date, e.time, e.venue, e.location,
        e.event_logo_url
      FROM traheeb_guests g
      JOIN traheeb_events e ON e.id = g.event_id
      WHERE g.invitation_token = ${params.token}
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.json({ error: 'الدعوة غير موجودة' }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (err) {
    console.error('[GET invitation/token]', err);
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
