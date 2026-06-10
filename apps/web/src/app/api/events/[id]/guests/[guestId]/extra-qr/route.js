/**
 * POST /api/events/[id]/guests/[guestId]/extra-qr
 *
 * Sends one extra QR code for a guest — allowed only once per guest.
 * - Increments companions by 1
 * - Creates companion-N token (N = new companions value)
 * - Generates card and sends via Meta + personal WhatsApp if connected
 * - Inserts into traheeb_guest_extra_qr (PRIMARY KEY enforces one-per-guest)
 */
import crypto from 'crypto';
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

    // Load guest + event (verify ownership)
    const rows = await sql`
      SELECT
        g.*,
        e.name  AS event_name,
        e.date  AS event_date,
        e.time  AS event_time,
        e.event_logo_url,
        e.qr_background_url,
        e.user_id AS organizer_user_id
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

    // Check if extra already sent via the dedicated table
    const extraRows = await sql`
      SELECT 1 FROM traheeb_guest_extra_qr WHERE guest_id = ${guest.id} LIMIT 1
    `;
    if (extraRows.length) {
      return Response.json({ error: 'تم إرسال رمز QR الإضافي مسبقاً لهذا الضيف' }, { status: 400 });
    }

    // Increment companions count
    const newCompanions = (guest.companions ?? 0) + 1;
    const label = `companion-${newCompanions}`;

    await sql`
      UPDATE traheeb_guests SET companions = ${newCompanions} WHERE id = ${guest.id}
    `;

    // Record in extra table — PRIMARY KEY prevents duplicates
    await sql`
      INSERT INTO traheeb_guest_extra_qr (guest_id) VALUES (${guest.id})
    `;

    // Create token
    const token = crypto.randomBytes(16).toString('hex');
    const [qt] = await sql`
      INSERT INTO traheeb_qr_tokens (guest_id, event_id, token, label)
      VALUES (${guest.id}, ${guest.event_id}, ${token}, ${label})
      RETURNING id
    `;

    console.log(`[extra-qr] guest=${guest.id} label=${label} token_id=${qt.id}`);

    // Fire generation + sending in background
    sendExtraQR({ ...guest, companions: newCompanions }, { id: qt.id, token, label }).catch((err) =>
      console.error('[extra-qr] background error:', err.message)
    );

    return Response.json({
      success: true,
      message: `جارٍ إرسال رمز QR الإضافي (${label})`,
      label,
    });
  } catch (err) {
    if (err.status) return Response.json({ error: err.message }, { status: err.status });
    console.error('[POST extra-qr]', err);
    return Response.json({ error: 'حدث خطأ، حاول مجدداً' }, { status: 500 });
  }
}

async function sendExtraQR(guest, qt) {
  const [logoBuffer, bgBuffer] = await Promise.all([
    fetchBuffer(guest.event_logo_url),
    fetchBuffer(guest.qr_background_url),
  ]);

  const cardBuffer = await generateQRCard({
    token:     qt.token,
    label:     qt.label,
    eventName: guest.event_name,
    eventDate: guest.event_date,
    eventTime: guest.event_time,
    bgBuffer,
    logoBuffer,
  });

  // Send via Meta
  await sendViaMeta(guest, qt.id, cardBuffer, qt.label);

  // Also send via personal WhatsApp session if connected
  if (isConnected(guest.organizer_user_id)) {
    try {
      const caption = qrConfirmationMessage({
        guestName: guest.name,
        eventName: guest.event_name,
        label: qt.label,
      });
      await sendImages(guest.organizer_user_id, guest.phone, [cardBuffer], caption);
    } catch (err) {
      console.error('[extra-qr] personal WA send error:', err.message);
    }
  }
}

async function sendViaMeta(guest, tokenRowId, cardBuffer, label) {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) { console.warn('[extra-qr] IMGBB_API_KEY not set'); return; }

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
    console.log(`[extra-qr] Meta send ok label=${label} url=${imageUrl}`);
  } catch (err) {
    console.error(`[extra-qr] Meta send failed label=${label}:`, err.message);
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
