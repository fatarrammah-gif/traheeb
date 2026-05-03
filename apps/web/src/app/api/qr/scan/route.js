/**
 * POST /api/qr/scan
 * Body: { token, eventId }
 * Auth required (organizer's scanner).
 *
 * Atomically validates and marks a QR token as used.
 * Returns { status: "valid"|"already_used"|"invalid", guest? }.
 */
import { authenticate } from '../../utils/auth.js';
import sql from '../../utils/sql.js';

export async function POST(request) {
  try {
    const { user } = await authenticate(request);
    const body = await request.json();
    const { token, eventId } = body;

    if (!token || !eventId) {
      return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Verify the event belongs to this organizer
    const eventRows = await sql`
      SELECT id FROM traheeb_events
      WHERE id = ${eventId} AND user_id = ${user.id}
      LIMIT 1
    `;

    if (!eventRows.length) {
      return Response.json({ error: 'الفعالية غير موجودة' }, { status: 404 });
    }

    // Atomic read-and-mark with SELECT FOR UPDATE
    const result = await sql.begin(async (tx) => {
      const qtRows = await tx`
        SELECT qt.*, g.name AS guest_name, g.companions
        FROM traheeb_qr_tokens qt
        JOIN traheeb_guests g ON g.id = qt.guest_id
        WHERE qt.token = ${token}
          AND qt.event_id = ${eventId}
        LIMIT 1
        FOR UPDATE
      `;

      if (!qtRows.length) {
        return { status: 'invalid' };
      }

      const qt = qtRows[0];

      if (qt.used) {
        return {
          status: 'already_used',
          usedAt: qt.used_at,
          guest: { name: qt.guest_name, label: qt.label, companions: qt.companions },
        };
      }

      // Mark used
      await tx`
        UPDATE traheeb_qr_tokens
        SET used = true, used_at = now()
        WHERE id = ${qt.id}
      `;

      // Update guest status to attended (only for the main ticket)
      if (qt.label === 'main') {
        await tx`
          UPDATE traheeb_guests
          SET status = 'attended'
          WHERE id = ${qt.guest_id}
        `;
      }

      return {
        status: 'valid',
        guest: { name: qt.guest_name, label: qt.label, companions: qt.companions },
      };
    });

    return Response.json(result);
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST /api/qr/scan]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
