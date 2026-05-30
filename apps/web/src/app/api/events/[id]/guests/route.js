/**
 * GET  /api/events/[id]/guests — list guests with qr_tokens
 * POST /api/events/[id]/guests — bulk insert guests, send WhatsApp invitations
 */
import { authenticate } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';
import { sendInvitationTemplate } from '../../../../../services/whatsapp/metaSender.js';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'https://traheeb-production.up.railway.app';


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

    const guests = await sql`
      SELECT
        g.*,
        COALESCE(
          json_agg(q ORDER BY q.label) FILTER (WHERE q.id IS NOT NULL),
          '[]'
        ) AS qr_tokens
      FROM traheeb_guests g
      LEFT JOIN traheeb_qr_tokens q ON q.guest_id = g.id
      WHERE g.event_id = ${params.id}
      GROUP BY g.id
      ORDER BY g.created_at ASC
    `;

    return Response.json({ guests });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[GET guests]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);
    const event = await getOwnedEvent(params.id, user.id);
    const body = await request.json();

    // body.guests: [{ name, phone, companions? }]
    const guestList = Array.isArray(body.guests) ? body.guests : [];
    if (!guestList.length) {
      return Response.json({ error: 'قائمة المدعوين فارغة' }, { status: 400 });
    }

    const inserted = [];

    for (const g of guestList) {
      const name  = (g.name  ?? '').trim();
      const phone = (g.phone ?? '').trim();
      const companions = Math.max(0, parseInt(g.companions ?? 0, 10));

      if (!name || !phone) continue;

      const invitationToken = crypto.randomUUID();
      const invitedAt = new Date().toISOString();

      const [guest] = await sql`
        INSERT INTO traheeb_guests (event_id, name, phone, companions, status, invitation_token, invited_at)
        VALUES (${event.id}, ${name}, ${phone}, ${companions}, 'invited', ${invitationToken}, ${invitedAt})
        ON CONFLICT DO NOTHING
        RETURNING *
      `;

      if (guest) inserted.push(guest);
    }

    console.log(`[guests] inserted=${inserted.length} media_url=${event.invitation_media_url ?? 'NULL'}`);

    // Send via Meta Cloud API in the background — guests already saved to DB
    sendInvitations(event, inserted).catch(err =>
      console.error('[send invitations error]', err.message)
    );

    return Response.json({ guests: inserted, sent: inserted.length }, { status: 201 });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST guests]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

/** Build a Google Maps link for the event location. */
function buildLocationLink(event) {
  if (event.map_lat && event.map_lng) {
    return `https://maps.google.com/?q=${event.map_lat},${event.map_lng}`;
  }
  const query = [event.venue, event.location].filter(Boolean).join(' ');
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}

async function sendInvitations(event, guests) {
  const locationLink = buildLocationLink(event);

  for (const guest of guests) {
    const confirmUrl = `${BASE_URL}/api/confirm/${guest.invitation_token}`;
    const companionsLabel = String(guest.companions || 0);

    console.log(`[invite] sending Meta template to phone="${guest.phone}"`);
    try {
      await sendInvitationTemplate({
        phone: guest.phone,
        guestName: guest.name,
        invitationText: event.invitation_text || '',
        date: event.date || '',
        time: event.time || '',
        venueName: [event.venue, event.location].filter(Boolean).join('، '),
        companionsLabel,
        confirmUrl,
        imageUrl: event.invitation_media_url || null,
      });
      console.log(`[invite] template sent to ${guest.phone}`);
    } catch (err) {
      console.error(`[invite] FAILED for ${guest.phone}:`, err.message);
    }

    // Small delay to stay within Meta rate limits
    await new Promise(r => setTimeout(r, 500));
  }
}
