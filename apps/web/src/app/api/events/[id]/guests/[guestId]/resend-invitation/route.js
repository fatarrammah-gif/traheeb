/**
 * POST /api/events/[id]/guests/[guestId]/resend-invitation
 *
 * Resends the invitation WhatsApp message to a specific guest.
 * Reuses the existing QR token's image URL (qr_url from traheeb_qr_tokens).
 * If qr_url is missing, regenerates the overlay QR image.
 *
 * Updates whatsapp_message_id, sets status='sent', retry_count=0.
 */
import { authenticate } from '../../../../../utils/auth.js';
import sql from '../../../../../utils/sql.js';
import { sendInvitationTemplate } from '../../../../../../../services/whatsapp/metaSender.js';
import { generateOverlayQRForGuest } from '../../../../../../../services/qr/qrService.js';

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);

    // Load guest + event (verify ownership)
    const rows = await sql`
      SELECT
        g.*,
        e.id            AS event_id_col,
        e.name          AS event_name,
        e.date          AS event_date,
        e.time          AS event_time,
        e.venue,
        e.location,
        e.map_lat,
        e.map_lng,
        e.invitation_text,
        e.invitation_media_url,
        e.event_logo_url,
        e.qr_placement
      FROM traheeb_guests g
      JOIN traheeb_events e ON e.id = g.event_id
      WHERE g.id       = ${params.guestId}
        AND g.event_id = ${params.id}
        AND e.user_id  = ${user.id}
      LIMIT 1
    `;

    if (!rows.length) {
      return Response.json({ error: 'الضيف غير موجود' }, { status: 404 });
    }

    const guest = rows[0];
    const isOverlay = guest.qr_placement === 'overlay';

    // Get existing QR image URL
    let imageUrl = guest.invitation_media_url || null;

    if (isOverlay) {
      // Try to reuse existing qr_url
      const [qt] = await sql`
        SELECT qr_url FROM traheeb_qr_tokens
        WHERE guest_id = ${guest.id} AND label = 'main'
        LIMIT 1
      `;

      if (qt?.qr_url) {
        imageUrl = qt.qr_url;
      } else {
        // No existing image — regenerate
        const event = {
          id: guest.event_id_col,
          name: guest.event_name,
          date: guest.event_date,
          time: guest.event_time,
          event_logo_url: guest.event_logo_url,
          invitation_media_url: guest.invitation_media_url,
        };
        const overlayUrl = await generateOverlayQRForGuest(
          { id: guest.id, companions: guest.companions },
          event,
        );
        if (overlayUrl) imageUrl = overlayUrl;
      }
    }

    const result = await sendInvitationTemplate({
      phone: guest.phone,
      guestName: guest.name,
      invitationText: (guest.invitation_text || '-').slice(0, 400),
      date: guest.event_date || '-',
      time: formatTime12Arabic(guest.event_time),
      venueName: guest.venue || '-',
      companionsLabel: String(guest.companions || 0),
      locationLink: buildLocationLink(guest),
      imageUrl,
      invitationToken: guest.invitation_token,
      templateName: isOverlay ? 'attendence_conf_10' : undefined,
    });

    const wamid = result?.messages?.[0]?.id ?? null;

    await sql`
      UPDATE traheeb_guests
      SET whatsapp_message_id = ${wamid},
          status      = 'sent',
          retry_count = 0
      WHERE id = ${guest.id}
    `;

    console.log(`[resend-invitation] guest=${guest.id} wamid=${wamid}`);
    return Response.json({ success: true, wamid });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST resend-invitation]', err);
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
  if (event.map_lat && event.map_lng) {
    return `https://maps.google.com/?q=${event.map_lat},${event.map_lng}`;
  }
  const loc = String(event.location ?? '').trim();
  if (loc && loc.includes('q=')) {
    try {
      const fullUrl = loc.startsWith('http') ? loc : `https://${loc}`;
      const q = new URL(fullUrl).searchParams.get('q');
      if (q) return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
    } catch {}
  }
  return `https://maps.google.com/?q=${encodeURIComponent(event.venue || '')}`;
}
