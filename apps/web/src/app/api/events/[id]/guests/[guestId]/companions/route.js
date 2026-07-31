/**
 * GET  /api/events/[id]/guests/[guestId]/companions
 *   Returns companion names for this guest.
 *
 * PUT  /api/events/[id]/guests/[guestId]/companions
 *   Body: { companions: [{ label: 'companion-1', name: 'محمد' }, ...] }
 *   Upserts all companion names. Send empty array to clear all.
 */
import { authenticate } from '../../../../../utils/auth.js';
import sql from '../../../../../utils/sql.js';

async function getOwnedGuest(guestId, eventId, userId) {
  const rows = await sql`
    SELECT g.id, g.companions, g.event_id
    FROM traheeb_guests g
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

export async function GET(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedGuest(params.guestId, params.id, user.id);

    const companions = await sql`
      SELECT label, name
      FROM traheeb_companion_names
      WHERE main_guest_id = ${params.guestId}
      ORDER BY label
    `;

    return Response.json({ companions });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[GET companions]', err);
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { user } = await authenticate(request);
    const guest = await getOwnedGuest(params.guestId, params.id, user.id);

    const body = await request.json();
    const list = Array.isArray(body.companions) ? body.companions : [];

    // Validate labels match the guest's companion count
    const maxCompanions = guest.companions ?? 0;
    const validLabels = new Set(
      Array.from({ length: maxCompanions }, (_, i) => `companion-${i + 1}`)
    );

    const validEntries = list.filter(
      (c) => c.label && validLabels.has(c.label) && c.name && c.name.trim()
    );

    await sql.begin(async (tx) => {
      // Clear existing names for this guest
      await tx`DELETE FROM traheeb_companion_names WHERE main_guest_id = ${params.guestId}`;

      // Insert new names
      if (validEntries.length > 0) {
        for (const c of validEntries) {
          await tx`
            INSERT INTO traheeb_companion_names (main_guest_id, event_id, name, label)
            VALUES (${params.guestId}, ${params.id}, ${c.name.trim()}, ${c.label})
          `;
        }
      }
    });

    const updated = await sql`
      SELECT label, name
      FROM traheeb_companion_names
      WHERE main_guest_id = ${params.guestId}
      ORDER BY label
    `;

    return Response.json({ companions: updated });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[PUT companions]', err);
    return Response.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
