/**
 * Meta WhatsApp Cloud API Webhook
 *
 * GET  — Meta verification challenge (one-time setup)
 * POST — Incoming events: button taps (Quick Reply) from guests
 */
import sql from '../../utils/sql.js';
import { generateAndSendQRCards } from '../../../../services/qr/qrService.js';

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
        const messages = change.value?.messages ?? [];
        for (const msg of messages) {
          console.log('[Webhook] msg type:', msg.type, 'from:', msg.from, 'interactive:', JSON.stringify(msg.interactive));
          await handleMessage(msg).catch(err =>
            console.error('[Webhook] handler error:', err.message)
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

async function handleMessage(msg) {
  // Quick Reply button taps arrive as type "button"
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

  // Fetch the most recently invited guest for this phone number
  const guests = await sql`
    SELECT g.id, g.name, g.phone, g.event_id, g.companions, e.name AS event_name
    FROM traheeb_guests g
    JOIN traheeb_events e ON e.id = g.event_id
    WHERE g.status = 'invited'
      AND RIGHT(REGEXP_REPLACE(g.phone, '[^0-9]', '', 'g'), 9) = ${last9}
    ORDER BY g.invited_at DESC NULLS LAST, g.created_at DESC
    LIMIT 1
  `;

  if (!guests.length) {
    console.log(`[Webhook] no invited guest found for last9=${last9}`);
    return;
  }

  const guest = guests[0];
  const newStatus = isConfirm ? 'confirmed' : 'declined';

  await sql`
    UPDATE traheeb_guests
    SET status = ${newStatus}, responded_at = now()
    WHERE id = ${guest.id}
  `;

  console.log(`[Webhook] ✅ guest=${guest.id} "${guest.name}" → ${newStatus}`);

  // If confirmed: generate QR cards and send to guest (fire-and-forget)
  if (isConfirm) {
    console.log(`[QR] triggering for guest=${guest.id} companions=${guest.companions}`);
    generateAndSendQRCards({
      id:         guest.id,
      phone:      guest.phone,
      event_id:   guest.event_id,
      companions: guest.companions ?? 0,
    }).catch(err => console.error('[Webhook] QR generation error:', err.message));
  }
}
