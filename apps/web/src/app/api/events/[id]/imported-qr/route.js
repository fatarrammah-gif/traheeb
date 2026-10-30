/**
 * GET  /api/events/[id]/imported-qr — usage summary (organizer or staff)
 * POST /api/events/[id]/imported-qr — apply an import (organizer only)
 *   Body: { newTokens: string[], extendTokens: string[] }
 *   - newTokens: inserted as fresh standalone tokens (max_scans = 1)
 *   - extendTokens: tokens that already exist (guest or imported) — granted
 *     one extra admission (max_scans += 1, used reset to false)
 */
import { authenticate, authenticateStaff } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';

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

export async function GET(request, { params }) {
  try {
    try {
      const { user } = await authenticate(request);
      await getOwnedEvent(params.id, user.id);
    } catch (orgErr) {
      if (orgErr.status && orgErr.status !== 401) throw orgErr;
      await authenticateStaff(request, params.id);
    }

    const [{ total, used }] = await sql`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE used)::int AS used
      FROM traheeb_imported_qr_tokens
      WHERE event_id = ${params.id}
    `;

    return Response.json({ total, used, remaining: total - used });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[GET imported-qr]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);
    await getOwnedEvent(params.id, user.id);

    const body = await request.json();
    const newTokens = Array.isArray(body.newTokens) ? body.newTokens.filter(Boolean) : [];
    const extendTokens = Array.isArray(body.extendTokens) ? body.extendTokens.filter(Boolean) : [];

    if (!newTokens.length && !extendTokens.length) {
      return Response.json({ error: 'لا توجد رموز لمعالجتها' }, { status: 400 });
    }

    const result = await sql.begin(async (tx) => {
      let added = 0;
      for (const token of newTokens) {
        const rows = await tx`
          INSERT INTO traheeb_imported_qr_tokens (event_id, token)
          VALUES (${params.id}, ${token})
          ON CONFLICT (event_id, token) DO NOTHING
          RETURNING id
        `;
        if (rows.length) added++;
      }

      let extended = 0;
      for (const token of extendTokens) {
        const guestRows = await tx`
          UPDATE traheeb_qr_tokens
          SET max_scans = max_scans + 1, used = false
          WHERE event_id = ${params.id} AND token = ${token}
          RETURNING id
        `;
        if (guestRows.length) {
          extended++;
          continue;
        }

        const importedRows = await tx`
          UPDATE traheeb_imported_qr_tokens
          SET max_scans = max_scans + 1, used = false
          WHERE event_id = ${params.id} AND token = ${token}
          RETURNING id
        `;
        if (importedRows.length) extended++;
      }

      return { added, extended };
    });

    return Response.json(result);
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST imported-qr]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}
