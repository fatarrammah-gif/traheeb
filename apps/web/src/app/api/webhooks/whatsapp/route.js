/**
 * Meta WhatsApp Cloud API Webhook
 *
 * GET  — Meta verification challenge (one-time setup)
 * POST — Incoming events: button taps (Quick Reply) from guests
 */
import sql from '../../utils/sql.js';
import { generateAndSendQRCards, generateOverlayQRForGuest } from '../../../../services/qr/qrService.js';
import { sendInvitationTemplate } from '../../../../services/whatsapp/metaSender.js';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'traheeb_webhook_secret';

// ── GET — webhook verification ───────────────────────────────────────────────
export async function GET(request) {
  const url = new URL(request.url);
  const mode      = url.searchParams.get('hub.mode');
  const token     = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Meta verification successful');
    return new Response(challenge, { status: 200 });
  }
  console.warn('[Webhook] Meta verification failed — token mismatch');
  return new Response('Forbidden', { status: 403 });
}

// ── POST — incoming events ───────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('[Webhook] received:', JSON.stringify(body));

    if (body.object !== 'whatsapp_business_account') {
      return Response.json({ status: 'ignored' });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        console.log('[Webhook] change field:', change.field);
        const messages = change.value?.messages ?? [];
        console.log(`[Webhook] messages count: ${messages.length}`);
        for (const msg of messages) {
          console.log('[Webhook] msg type:', msg.type, 'from:', msg.from);
          await handleMessage(msg).catch(err =>
            console.error('[Webhook] handler error:', err.message)
          );
        }
        const statuses = change.value?.statuses ?? [];
        for (const s of statuses) {
          await handleStatus(s).catch(err =>
            console.error('[Webhook] status error:', err.message)
          );
        }
      }
    }

    return Response.json({ status: 'ok' });
  } catch (err) {
    console.error('[Webhook] POST error:', err.message);
    return Response.json({ status: 'error' }, { status: 200 });
  }
}

async function handleStatus(s) {
  // s.id = wamid, s.status = 'sent'|'delivered'|'read'|'failed'
  if (!['delivered', 'read', 'failed'].includes(s.status)) return;

  // Update reminder tracking (existing)
  await sql`
    UPDATE traheeb_reminders
    SET status = ${s.status}, updated_at = now()
    WHERE message_id = ${s.id}
  `.catch(() => {});

  if (s.status === 'delivered' || s.status === 'read') {
    const res = await sql`
      UPDATE traheeb_guests
      SET status = 'invited'
      WHERE whatsapp_message_id = ${s.id}
        AND status = 'sent'
    `;
    if (res.count > 0) console.log(`[Webhook] invitation ${s.id} delivered → guest status=invited`);
    return;
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  const errorCode = s.errors?.[0]?.code;
  const isMediaError = errorCode === 131053;

  // Load guest + event in one query
  const [guest] = await sql`
    SELECT
      g.id, g.name, g.phone, g.companions, g.event_id,
      g.invitation_token, g.retry_count, g.status AS guest_status,
      e.qr_placement, e.invitation_media_url, e.invitation_text,
      e.name AS event_name, e.date AS event_date, e.time AS event_time,
      e.venue, e.location, e.map_lat, e.map_lng,
      e.event_logo_url, e.id AS event_id_col
    FROM traheeb_guests g
    JOIN traheeb_events e ON e.id = g.event_id
    WHERE g.whatsapp_message_id = ${s.id}
      AND g.status = 'sent'
    LIMIT 1
  `;

  if (!guest) return; // already handled or not a tracked invitation

  // Media error (ImgBB 500) — retry up to 3 times by re-uploading a fresh image
  if (isMediaError && guest.retry_count < 3) {
    console.log(`[Webhook] media error for guest=${guest.id} retry=${guest.retry_count + 1}/3 — retrying`);

    try {
      const isOverlay = guest.qr_placement === 'overlay';
      let imageUrl = guest.invitation_media_url || null;

      if (isOverlay) {
        // Regenerate fresh QR overlay image (new ImgBB upload)
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

      const newWamid = result?.messages?.[0]?.id ?? null;
      await sql`
        UPDATE traheeb_guests
        SET whatsapp_message_id = ${newWamid},
            retry_count = ${guest.retry_count + 1}
        WHERE id = ${guest.id}
      `;
      console.log(`[Webhook] retry sent guest=${guest.id} wamid=${newWamid}`);
    } catch (err) {
      console.error(`[Webhook] retry failed guest=${guest.id}:`, err.message);
      await sql`UPDATE traheeb_guests SET status = 'failed', retry_count = ${guest.retry_count + 1} WHERE id = ${guest.id}`;
    }
    return;
  }

  // Max retries exceeded or non-media error — mark as failed
  await sql`
    UPDATE traheeb_guests SET status = 'failed' WHERE id = ${guest.id}
  `;
  console.log(`[Webhook] invitation ${s.id} failed (code=${errorCode}) → guest status=failed`);
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

async function handleMessage(msg) {
  if (msg.type !== 'button') return;

  const phone   = msg.from;
  const payload = msg.button?.payload ?? msg.button?.text ?? '';
  const last9   = phone.replace(/[^0-9]/g, '').slice(-9);

  console.log(`[Webhook] button tap from=${phone} payload="${payload}" last9=${last9}`);

  const isConfirm = payload.toLowerCase().includes('confirm') || payload.includes('تأكيد');
  const isDecline = payload.toLowerCase().includes('decline') || payload.includes('اعتذار') || payload.includes('معتذر');

  if (!isConfirm && !isDecline) {
    console.log(`[Webhook] unknown payload="${payload}" — skipping`);
    return;
  }

  // Pick the most recently sent/delivered record for this phone that hasn't responded yet
  const guests = await sql`
    SELECT g.id, g.name, g.phone, g.event_id, g.companions
    FROM traheeb_guests g
    WHERE g.status IN ('sent', 'invited', 'failed')
      AND RIGHT(REGEXP_REPLACE(g.phone, '[^0-9]', '', 'g'), 9) = ${last9}
    ORDER BY g.invited_at DESC NULLS LAST, g.created_at DESC
    LIMIT 1
  `;

  if (!guests.length) {
    console.log(`[Webhook] no invited guest found for last9=${last9}`);
    return;
  }

  const guest    = guests[0];
  const newStatus = isConfirm ? 'confirmed' : 'declined';

  await sql`
    UPDATE traheeb_guests
    SET status = ${newStatus}, responded_at = now()
    WHERE id = ${guest.id}
  `;

  console.log(`[Webhook] ✅ guest=${guest.id} "${guest.name}" → ${newStatus}`);

  if (isConfirm) {
    generateAndSendQRCards(guest).catch(err =>
      console.error('[Webhook] QR send error:', err.message)
    );
  }

}
