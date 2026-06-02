/**
 * Meta WhatsApp Cloud API Webhook
 *
 * GET  — Meta verification challenge (one-time setup)
 * POST — Incoming events: button taps (Quick Reply) from guests
 *
 * When a guest taps "تأكيد الحضور" or "الاعتذار" on the template message,
 * Meta sends a POST here with the button payload and sender phone number.
 * We look up the guest by phone and update their status in the DB.
 */
import sql from '../../utils/sql.js';

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

    // Meta sends a test ping — acknowledge immediately
    if (body.object !== 'whatsapp_business_account') {
      return Response.json({ status: 'ignored' });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const msg of messages) {
          await handleMessage(msg).catch(err =>
            console.error('[Webhook] message handler error:', err.message)
          );
        }
      }
    }

    // Always return 200 quickly — Meta retries if it doesn't get 200 within 20s
    return Response.json({ status: 'ok' });
  } catch (err) {
    console.error('[Webhook] POST error:', err.message);
    return Response.json({ status: 'error' }, { status: 200 }); // still 200 to stop retries
  }
}

async function handleMessage(msg) {
  // We only care about Quick Reply button taps
  if (msg.type !== 'interactive') return;
  if (msg.interactive?.type !== 'button_reply') return;

  const phone   = msg.from;              // e.g. "966538384048"
  const payload = msg.interactive.button_reply?.id ?? ''; // "confirm" or "decline"
  const last9   = phone.replace(/[^0-9]/g, '').slice(-9);

  console.log(`[Webhook] button tap from=${phone} payload=${payload} last9=${last9}`);

  if (!payload.startsWith('confirm') && !payload.startsWith('decline')) return;

  const isConfirm = payload.startsWith('confirm');

  // Look up guest by phone with status = invited
  const guests = await sql`
    SELECT g.id, g.name, g.event_id, e.name AS event_name
    FROM traheeb_guests g
    JOIN traheeb_events e ON e.id = g.event_id
    WHERE g.status = 'invited'
      AND RIGHT(REGEXP_REPLACE(g.phone, '[^0-9]', '', 'g'), 9) = ${last9}
    ORDER BY e.date ASC
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

  console.log(`[Webhook] guest=${guest.id} name="${guest.name}" status → ${newStatus}`);
}
