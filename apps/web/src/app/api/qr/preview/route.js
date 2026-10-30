/**
 * POST /api/qr/preview
 * Body: { token, eventId }
 * Auth required (organizer or staff).
 *
 * Validates a QR token and returns guest info WITHOUT marking it as used.
 * Used for the confirmation step before finalizing a scan.
 * Returns { status: "valid"|"already_used"|"invalid", guest? }
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
    } catch {}

    if (!isAuthorized) {
      try {
        await authenticateStaff(request, eventId);
        isAuthorized = true;
      } catch {}
    }

    if (!isAuthorized) {
      return Response.json({ error: 'غير مصرح لك' }, { status: 403 });
    }

    // Read token info WITHOUT marking as used
    const rows = await sql`
      SELECT qt.used, qt.used_at, qt.label, qt.scan_count, qt.max_scans,
             g.name AS guest_name, g.companions, g.status AS guest_status
      FROM traheeb_qr_tokens qt
      JOIN traheeb_guests g ON g.id = qt.guest_id
      WHERE qt.token = ${token}
        AND qt.event_id = ${eventId}
      LIMIT 1
    `;

    if (!rows.length) {
      return previewImportedToken(token, eventId);
    }

    const qt = rows[0];

    if (qt.guest_status === 'declined') {
      return Response.json({ status: 'declined' });
    }

    if (qt.used) {
      return Response.json({
        status: 'already_used',
        usedAt: qt.used_at,
        guest: { name: qt.guest_name, label: qt.label, companions: qt.companions },
      });
    }

    const scanCount = qt.scan_count ?? 0;
    const maxScans  = qt.max_scans  ?? 1;

    return Response.json({
      status: 'valid',
      guest: {
        name: qt.guest_name,
        label: qt.label,
        companions: qt.companions,
        scanCount,
        maxScans,
      },
    });
  } catch (err) {
    console.error('[POST /api/qr/preview]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

// Fallback for tokens with no matching guest — checks the imported-QR table
// (tokens the organizer uploaded from an external Excel sheet).
async function previewImportedToken(token, eventId) {
  const rows = await sql`
    SELECT used, used_at, scan_count, max_scans
    FROM traheeb_imported_qr_tokens
    WHERE token = ${token} AND event_id = ${eventId}
    LIMIT 1
  `;

  if (!rows.length) {
    return Response.json({ status: 'invalid' });
  }

  const it = rows[0];

  if (it.used) {
    return Response.json({
      status: 'already_used',
      usedAt: it.used_at,
      source: 'imported',
      guest: { name: 'بطاقة مستوردة', code: token, companions: 0 },
    });
  }

  return Response.json({
    status: 'valid',
    source: 'imported',
    guest: {
      name: 'بطاقة مستوردة',
      code: token,
      companions: 0,
      scanCount: it.scan_count ?? 0,
      maxScans: it.max_scans ?? 1,
    },
  });
}
