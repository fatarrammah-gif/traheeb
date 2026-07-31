/**
 * POST /api/events/[id]/guests/[guestId]/resend-all-qr
 *
 * Force-resends ALL QR codes (main + companions) for a confirmed guest.
 * Uses existing tokens — does NOT generate new ones.
 * Sends via Meta Cloud API + organizer's personal WhatsApp session if connected.
 */
import { authenticate } from '../../../../../utils/auth.js';
import sql from '../../../../../utils/sql.js';
import { generateQRCard } from '../../../../../../../services/qr/generator.js';
import { isConnected } from '../../../../../../../services/whatsapp/SessionManager.js';
import { sendImages } from '../../../../../../../services/whatsapp/sender.js';
import { sendQRTemplate } from '../../../../../../../services/whatsapp/metaSender.js';
import { qrConfirmationMessage } from '../../../../../../../services/whatsapp/templates.js';

export async function POST(request, { params }) {
  try {
    const { user } = await authenticate(request);

    const rows = await sql`
      SELECT
        g.*,
        e.name            AS event_name,
        e.date            AS event_date,
        e.time            AS event_time,
        e.event_logo_url,
        e.qr_background_url,
        e.user_id         AS organizer_user_id
      FROM traheeb_guests g
      JOIN traheeb_events e ON e.id = g.event_id
      WHERE g.id       = ${params.guestId}
        AND g.event_id = ${params.id}
        AND e.user_id  = ${user.id}
      LIMIT 1
    `;

    if (!rows.length) return Response.json({ error: 'الضيف غير موجود' }, { status: 404 });

    const guest = rows[0];

    if (guest.status !== 'confirmed') {
      return Response.json({ error: 'الضيف لم يؤكد حضوره بعد' }, { status: 400 });
    }

    const tokens = await sql`
      SELECT id, token, label FROM traheeb_qr_tokens
      WHERE guest_id = ${guest.id}
      ORDER BY label
    `;

    if (!tokens.length) {
      return Response.json({ error: 'لا توجد رموز QR لهذا الضيف' }, { status: 404 });
    }

    // Fire in background — don't block the response
    resendAll(guest, tokens).catch((err) =>
      console.error('[resend-all-qr] background error:', err.message)
    );

    return Response.json({ success: true, message: `جارٍ إعادة إرسال ${tokens.length} رمز QR` });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST resend-all-qr]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

async function resendAll(guest, tokens) {
  const [logoBuffer, bgBuffer] = await Promise.all([
    fetchBuffer(guest.event_logo_url),
    fetchBuffer(guest.qr_background_url),
  ]);

  const cardBuffers = [];

  for (const qt of tokens) {
    try {
      const cardBuffer = await generateQRCard({
        token:     qt.token,
        label:     qt.label,
        guestName: guest.name,
        eventName: guest.event_name,
        eventDate: guest.event_date,
        eventTime: guest.event_time,
        bgBuffer,
        logoBuffer,
      });

      cardBuffers.push(cardBuffer);
      await sendViaMeta(guest, qt.id, cardBuffer, qt.label);
      await sleep(1500);
    } catch (err) {
      console.error(`[resend-all-qr] failed label=${qt.label}:`, err.message);
    }
  }

  // Also send via organizer's personal WhatsApp if session is active
  if (cardBuffers.length > 0 && isConnected(guest.organizer_user_id)) {
    try {
      const caption = qrConfirmationMessage({
        guestName: guest.name,
        eventName: guest.event_name,
        label: tokens[0].label,
      });
      await sendImages(guest.organizer_user_id, guest.phone, cardBuffers, caption);
    } catch (err) {
      console.error('[resend-all-qr] personal WA send error:', err.message);
    }
  }
}

async function sendViaMeta(guest, tokenRowId, cardBuffer, label) {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) { console.warn('[resend-all-qr] IMGBB_API_KEY not set'); return; }

  try {
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', cardBuffer.toString('base64'));
    const res  = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error('ImgBB upload failed: ' + JSON.stringify(json.error ?? json));
    const imageUrl = json.data.url;

    await sql`UPDATE traheeb_qr_tokens SET qr_url = ${imageUrl} WHERE id = ${tokenRowId}`;
    await waitForUrl(imageUrl);
    await sendQRTemplate({ phone: guest.phone, imageUrl });
    console.log(`[resend-all-qr] Meta send ok label=${label}`);
  } catch (err) {
    console.error(`[resend-all-qr] Meta send failed label=${label}:`, err.message);
  }
}

async function fetchBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

async function waitForUrl(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch { /* retry */ }
    await sleep(1000);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
