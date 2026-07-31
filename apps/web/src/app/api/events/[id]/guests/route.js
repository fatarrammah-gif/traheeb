/**
 * GET  /api/events/[id]/guests — list guests with qr_tokens
 * POST /api/events/[id]/guests — bulk insert guests, send WhatsApp invitations
 */
import { authenticate, authenticateStaff } from '../../../utils/auth.js';
import sql from '../../../utils/sql.js';
import { sendInvitationTemplate } from '../../../../../services/whatsapp/metaSender.js';
import { generateOverlayQRForGuest } from '../../../../../services/qr/qrService.js';
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
    // Organizer auth or staff auth (read-only)
    try {
      const { user } = await authenticate(request);
      await getOwnedEvent(params.id, user.id);
    } catch (orgErr) {
      if (orgErr.status && orgErr.status !== 401) throw orgErr;
      await authenticateStaff(request, params.id);
    }

    const guests = await sql`
      SELECT
        g.*,
        mg.name AS main_guest_name,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', q.id, 'label', q.label, 'token', q.token, 'used', q.used, 'qr_url', q.qr_url))
          FILTER (WHERE q.id IS NOT NULL),
          '[]'
        ) AS qr_tokens,
        (ex.guest_id IS NOT NULL) AS extra_qr_sent
      FROM traheeb_guests g
      LEFT JOIN traheeb_guests mg ON mg.id = g.main_guest_id
      LEFT JOIN traheeb_qr_tokens q ON q.guest_id = g.id
      LEFT JOIN traheeb_guest_extra_qr ex ON ex.guest_id = g.id
      WHERE g.event_id = ${params.id}
      GROUP BY g.id, mg.name, ex.guest_id
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

    // Capacity enforcement — count existing companions as used QR slots
    if (event.capacity > 0) {
      const [{ used }] = await sql`
        SELECT COALESCE(SUM(companions), 0)::int AS used
        FROM traheeb_guests
        WHERE event_id = ${event.id}
      `;
      const incomingCompanions = guestList.reduce((s, g) => s + Math.max(0, parseInt(g.companions ?? 0, 10)), 0);
      const remaining = event.capacity - used;
      if (incomingCompanions > remaining) {
        return Response.json({
          error: `تجاوزت السعة المتاحة — المتبقي ${remaining} مقعد فقط`,
          remaining,
        }, { status: 400 });
      }
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
        VALUES (${event.id}, ${name}, ${phone}, ${companions}, 'sent', ${invitationToken}, ${invitedAt})
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



function formatTime12Arabic(timeStr) {
  if (!timeStr) return '-';
  const [hStr, mStr] = String(timeStr).split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  const period = h < 12 ? 'صباحاً' : 'مساءً';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function buildLocationLink(event) {
  // Shortest — coordinate-based URL
  if (event.map_lat && event.map_lng) {
    return `https://maps.google.com/?q=${event.map_lat},${event.map_lng}`;
  }

  const loc = String(event.location ?? '').trim();

  // If location is a Google Maps URL, extract just the q= param to keep it short
  if (loc && loc.includes('q=')) {
    try {
      const fullUrl = loc.startsWith('http') ? loc : `https://${loc}`;
      const q = new URL(fullUrl).searchParams.get('q');
      if (q) return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
    } catch {}
  }

  // Fall back to venue name only (always short)
  return `https://maps.google.com/?q=${encodeURIComponent(event.venue || '')}`;
}

async function sendInvitations(event, guests) {
  const locationLink = buildLocationLink(event);
  // Overlay mode: QR is generated at invitation time (not after confirmation).
  // Only requires qr_placement === 'overlay' — image fallback is handled inside generateOverlayQRForGuest.
  const isOverlay = event.qr_placement === 'overlay';

  for (const guest of guests) {
    const companionsLabel = String(guest.companions || 0);

    // Overlay mode: generate QR now and overlay it on the invitation image.
    // generateOverlayQRForGuest handles missing invitation image by generating a plain QR card.
    // Falls back to invitation_media_url if generation fails entirely.
    let imageUrl = event.invitation_media_url || null;
    if (isOverlay) {
      const overlayUrl = await generateOverlayQRForGuest(guest, event);
      console.log(`[invite] overlay QR result guest=${guest.id} overlayUrl=${overlayUrl ?? 'NULL'}`);
      if (overlayUrl) {
        imageUrl = overlayUrl;
      } else {
        console.warn(`[invite] overlay QR generation failed for guest=${guest.id}, falling back to invitation_media_url=${imageUrl ?? 'NULL'}`);
      }
    }

    console.log(`[invite] sending to phone="${guest.phone}" overlay=${isOverlay} imageUrl=${imageUrl ?? 'NULL'} template=${isOverlay ? 'attendence_conf_11' : 'attendance_conf'}`);
    try {
      const result = await sendInvitationTemplate({
        phone: guest.phone,
        guestName: guest.name || '-',
        invitationText: (event.invitation_text || '-').slice(0, 400),
        date: event.date || '-',
        time: formatTime12Arabic(event.time),
        venueName: event.venue || '-',
        companionsLabel: companionsLabel || '0',
        locationLink,
        imageUrl,
        invitationToken: guest.invitation_token,
        templateName: isOverlay ? 'attendence_conf_11' : undefined,
      });
      // Store Meta message ID so delivery-status webhooks can find this guest
      const wamid = result?.messages?.[0]?.id ?? null;
      if (wamid) {
        await sql`
          UPDATE traheeb_guests SET whatsapp_message_id = ${wamid}
          WHERE id = ${guest.id}
        `.catch(e => console.error('[invite] wamid save error:', e.message));
      }
      console.log(`[invite] template sent to ${guest.phone} wamid=${wamid}`);
    } catch (err) {
      console.error(`[invite] FAILED for ${guest.phone}:`, err.message);
      await sql`
        UPDATE traheeb_guests SET status = 'failed'
        WHERE id = ${guest.id}
      `.catch(() => {});
    }

    // Small delay to stay within Meta rate limits
    await new Promise(r => setTimeout(r, 500));
  }
}
