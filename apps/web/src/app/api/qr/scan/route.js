/**
 * POST /api/qr/scan
 * Body: { token, eventId }
 * Auth required (organizer's scanner).
 *
 * Atomically validates and marks a QR token as used.
 * Returns { status: "valid"|"already_used"|"invalid", guest? }.
 */
import { authenticate, authenticateStaff } from '../../utils/auth.js';
import sql from '../../utils/sql.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, eventId } = body;

    if (!token || !eventId) {
      return Response.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    // Try organizer auth first, then staff auth
    let isAuthorized = false;
    try {
      const { user } = await authenticate(request);
      const eventRows = await sql`
        SELECT id FROM traheeb_events
        WHERE id = ${eventId} AND user_id = ${user.id}
        LIMIT 1
      `;
      if (eventRows.length) isAuthorized = true;
    } catch {
      // Not an organizer — try staff token
    }

    if (!isAuthorized) {
      try {
        await authenticateStaff(request, eventId);
        isAuthorized = true;
      } catch {
        // Not staff either
      }
    }

    if (!isAuthorized) {
      return Response.json({ error: 'غير مصرح لك بمسح هذه الفعالية' }, { status: 403 });
    }

    // Atomic read-and-mark with SELECT FOR UPDATE
    const result = await sql.begin(async (tx) => {
      const qtRows = await tx`
        SELECT qt.*, g.name AS guest_name, g.companions, g.status AS guest_status
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

      if (qtRows[0].guest_status === 'declined') {
        return { status: 'declined' };
      }

      const qt = qtRows[0];

      if (qt.used) {
        return {
          status: 'already_used',
          usedAt: qt.used_at,
          guest: { name: qt.guest_name, label: qt.label, companions: qt.companions },
        };
      }

      const newScanCount = (qt.scan_count ?? 0) + 1;
      const maxScans     = qt.max_scans ?? 1;
      const exhausted    = newScanCount >= maxScans;

      await tx`
        UPDATE traheeb_qr_tokens
        SET scan_count = ${newScanCount},
            used    = ${exhausted},
            used_at = CASE WHEN ${exhausted} THEN now() ELSE used_at END
        WHERE id = ${qt.id}
      `;

      if (qt.label === 'main' && newScanCount === 1) {
        await tx`
          UPDATE traheeb_guests SET status = 'attended' WHERE id = ${qt.guest_id}
        `;
      }

      return {
        status: 'valid',
        guest: {
          name: qt.guest_name,
          label: qt.label,
          companions: qt.companions,
          scanCount: newScanCount,
          maxScans,
        },
      };
    });

    return Response.json(result);
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST /api/qr/scan]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
