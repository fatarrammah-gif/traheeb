/**
 * POST /api/events/[id]/imported-qr/preview
 * Body: { fileBase64 }
 * Auth: organizer only.
 *
 * Parses an uploaded Excel/CSV sheet of QR tokens and classifies each one
 * against the event's existing tokens — writes nothing. The client reviews
 * the result and posts a selection to POST /api/events/[id]/imported-qr.
 */
import { authenticate } from '../../../../utils/auth.js';
import sql from '../../../../utils/sql.js';
import { parseTokenSheet } from '../../../../utils/parseTokenSheet.js';

async function getOwnedEvent(eventId, userId) {
  const rows = await sql`
    SELECT id FROM traheeb_events
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

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    const body = await request.json();
    const { fileBase64 } = body;
    if (!fileBase64) {
      return Response.json({ error: 'لم يتم إرفاق ملف' }, { status: 400 });
    }

    let tokens, skipped;
    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      ({ tokens, skipped } = parseTokenSheet(buffer));
    } catch (err) {
      console.error('[imported-qr/preview] parse error:', err.message);
      return Response.json({ error: 'تعذر قراءة الملف، تأكد من صيغة Excel' }, { status: 400 });
    }

    if (!tokens.length) {
      return Response.json({ error: 'الملف فارغ أو لا يحتوي على رموز' }, { status: 400 });
    }

    const guestRows = await sql`
      SELECT qt.token, qt.scan_count, qt.max_scans, g.name AS guest_name, g.companions
      FROM traheeb_qr_tokens qt
      JOIN traheeb_guests g ON g.id = qt.guest_id
      WHERE qt.event_id = ${params.id} AND qt.token = ANY(${tokens})
    `;
    const guestMap = new Map(guestRows.map((r) => [r.token, r]));

    const importedRows = await sql`
      SELECT token, scan_count, max_scans
      FROM traheeb_imported_qr_tokens
      WHERE event_id = ${params.id} AND token = ANY(${tokens})
    `;
    const importedMap = new Map(importedRows.map((r) => [r.token, r]));

    const newTokens = [];
    const duplicates = [];

    for (const token of tokens) {
      const g = guestMap.get(token);
      if (g) {
        duplicates.push({
          token,
          source: 'guest',
          guestName: g.guest_name,
          companions: g.companions,
          scanCount: g.scan_count,
          maxScans: g.max_scans,
        });
        continue;
      }

      const i = importedMap.get(token);
      if (i) {
        duplicates.push({
          token,
          source: 'imported',
          scanCount: i.scan_count,
          maxScans: i.max_scans,
        });
        continue;
      }

      newTokens.push(token);
    }

    return Response.json({ newTokens, duplicates, skipped });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST imported-qr/preview]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
