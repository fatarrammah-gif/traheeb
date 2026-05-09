/**
 * GET  /api/events/[id]/guests — list guests with qr_tokens
 * POST /api/events/[id]/guests — bulk insert guests, send WhatsApp invitations
 */
import { authenticate } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';
import { isConnected } from '../../../../../services/whatsapp/SessionManager.js';
import { sendText, sendMedia } from '../../../../../services/whatsapp/sender.js';
import { invitationMessage } from '../../../../../services/whatsapp/templates.js';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'https://traheeb.com';

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

    // Send WhatsApp invitations (non-blocking, organizer's session)
    if (isConnected(user.id) && inserted.length) {
      sendInvitations(user.id, event, inserted).catch(err =>
        console.error('[send invitations]', err)
      );
    }

    return Response.json({ guests: inserted, sent: inserted.length }, { status: 201 });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST guests]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

async function sendInvitations(userId, event, guests) {
  for (const guest of guests) {
    const confirmUrl = `${BASE_URL}/confirm/${guest.invitation_token}`;
    const declineUrl = `${BASE_URL}/decline/${guest.invitation_token}`;

    const text = invitationMessage({
      guestName: guest.name,
      invitationText: event.invitation_text,
      event,
      companions: guest.companions,
      confirmUrl,
      declineUrl,
    });

    try {
      if (event.invitation_media_url) {
        try {
          await sendMedia(userId, guest.phone, text, event.invitation_media_url);
        } catch (mediaErr) {
          console.error(`[media failed for ${guest.phone}] ${mediaErr.message} — falling back to text`);
          await sendText(userId, guest.phone, text);
        }
      } else {
        await sendText(userId, guest.phone, text);
      }
    } catch (err) {
      console.error(`[invitation failed for ${guest.phone}]`, err.message);
    }

    // Small delay to avoid WhatsApp rate limiting
    await new Promise(r => setTimeout(r, 800));
  }
}
